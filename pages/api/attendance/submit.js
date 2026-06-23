import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import formidable from 'formidable';
import fs from 'fs';

// Force Next.js core framework middleware tools to stand down from parsing multipart buffers
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(456).json({ error: 'Method not allowed' });

  const form = formidable({});
  
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Failed parsing file data pipeline stream' });

    // Extract values cleanly out of Formidable field arrays
    const week_id = fields.week_id?.[0];
    const student_id = fields.student_id?.[0];
    const answer = fields.answer?.[0];
    const fingerprint = fields.fingerprint?.[0];
    const rawPhotoFile = files.photo?.[0];

    if (!week_id || !student_id || !rawPhotoFile || !fingerprint) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วนหรือไม่พบรหัสกล้องภาพถ่าย' });
    }

    // A. Enforce week session open state logic gates
    const { data: week } = await supabaseAdmin.from('weeks').select('status').eq('id', week_id).maybeSingle();
    if (!week || week.status !== 'open') return res.status(403).json({ error: 'การเช็คชื่อถูกปิดแล้ว' });

    // B. Enforce enrollment checks
    const { data: student } = await supabaseAdmin.from('students').select('student_id, name').eq('student_id', student_id.trim()).maybeSingle();
    if (!student) return res.status(404).json({ error: 'ไม่พบรหัสนักเรียนนี้ในระบบฐานข้อมูล' });

    // C. Stream file binary to Supabase Cloud Buckets
    const fileBuffer = fs.readFileSync(rawPhotoFile.filepath);
    const fileExtension = rawPhotoFile.originalFilename.split('.').pop();
    const storagePath = `${week_id}/${student.student_id}_${Date.now()}.${fileExtension}`;

    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from('attendance-proofs')
      .upload(storagePath, fileBuffer, {
        contentType: rawPhotoFile.mimetype,
        upsert: true
      });

    if (uploadErr) return res.status(500).json({ error: `Storage upload crash: ${uploadErr.message}` });

    // D. Extract file storage public url parameter location keys
    const { data: { publicUrl } } = supabaseAdmin.storage.from('attendance-proofs').getPublicUrl(storagePath);

    // E. Save transaction record to relational database tables
    const { data: record, error: insErr } = await supabaseAdmin
      .from('attendance_records')
      .insert({
        week_id,
        student_id: student.student_id,
        student_name: student.name,
        answer: answer ? String(answer).trim() : null,
        device_fingerprint: fingerprint,
        photo_url: publicUrl, // Save photo reference link destination points
        verification_status: 'pending' // Initialize standard validation audit gate
      })
      .select()
      .single();

    if (insErr) {
      if (insErr.code === '23505') {
        return res.status(409).json({ error: 'อุปกรณ์นี้หรือรหัสนักเรียนนี้ได้ใช้บันทึกเวลาสัปดาห์นี้ไปแล้ว' });
      }
      return res.status(500).json({ error: insErr.message });
    }

    return res.status(201).json({ ok: true, record });
  });
}