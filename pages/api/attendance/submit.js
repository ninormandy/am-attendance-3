import { supabaseAdmin } from '../../../lib/supabaseAdmin';

// Public endpoint — no auth required.
// Validates that the week is open, the student is enrolled, and they
// haven't already checked in this week. Then records their attendance.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { week_id, student_id, answer, seconds_taken, fingerprint } = req.body || {};

  // Require hardware footprint parameter verification along standard inputs
  if (!week_id || !student_id || !fingerprint) {
    return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วนหรือไม่พบรหัสเครื่อง' });
  }

  // Verify the week is still open
  const { data: week, error: weekErr } = await supabaseAdmin
    .from('weeks')
    .select('id, status')
    .eq('id', week_id)
    .maybeSingle();

  if (weekErr) return res.status(500).json({ error: weekErr.message });
  if (!week) return res.status(404).json({ error: 'ไม่พบสัปดาห์นี้' });
  if (week.status !== 'open') {
    return res.status(403).json({ error: 'การเช็คชื่อถูกปิดแล้ว' });
  }

  // Verify student is enrolled
  const { data: student, error: stuErr } = await supabaseAdmin
    .from('students')
    .select('student_id, name')
    .eq('student_id', String(student_id).trim())
    .maybeSingle();

  if (stuErr) return res.status(500).json({ error: stuErr.message });
  if (!student) {
    return res.status(404).json({ error: 'ไม่พบรหัสนักเรียนนี้ในระบบ' });
  }

  // Insert record — dynamic checks on unique indices for both (week_id, student_id) 
  // AND the anti-proxy composite (week_id, device_fingerprint) constraint rules.
  const { data: record, error: insErr } = await supabaseAdmin
    .from('attendance_records')
    .insert({
      week_id,
      student_id: student.student_id,
      student_name: student.name,
      answer: answer ? String(answer).trim() : null,
      seconds_taken: typeof seconds_taken === 'number' ? seconds_taken : null,
      device_fingerprint: fingerprint // Log hardware signature onto row record
    })
    .select()
    .single();

  if (insErr) {
    // Handle PostgreSQL unique constraint violations (code 23505)
    if (insErr.code === '23505') {
      // Differentiate between checking in twice with the same ID vs checking in with a used phone/device
      if (insErr.message?.includes('device') || insErr.details?.includes('device') || insErr.hint?.includes('device_fingerprint')) {
        return res.status(409).json({ error: 'อุปกรณ์นี้ได้ทำการเช็คชื่อไปแล้ว ไม่สามารถเช็คชื่อให้นักเรียนคนอื่นซ้ำได้' });
      }
      return res.status(409).json({ error: 'คุณเช็คชื่อสัปดาห์นี้ไปแล้ว' });
    }
    return res.status(500).json({ error: insErr.message });
  }

  return res.status(201).json({ ok: true, name: student.name, record });
}