import { supabaseAdmin } from '../../../lib/supabaseAdmin';

// Public endpoint — no auth required.
// Used by the student check-in page to verify a student ID before
// starting the quiz timer.  Returns the student's name so the UI can
// show a "ยืนยันตัวตน" confirmation screen without the student typing
// their own name (prevents typos).
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { student_id } = req.query;
  if (!student_id) {
    return res.status(400).json({ error: 'กรุณาระบุรหัสนักเรียน' });
  }

  const { data: student, error } = await supabaseAdmin
    .from('students')
    .select('student_id, name')
    .eq('student_id', String(student_id).trim())
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!student) {
    return res.status(404).json({ error: 'ไม่พบรหัสนักเรียนนี้ในระบบ' });
  }

  return res.status(200).json({ student });
}
