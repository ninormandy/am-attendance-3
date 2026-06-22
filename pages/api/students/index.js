import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { withAdminAuth } from '../../../lib/withAdminAuth';

async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('students')
      .select('id, student_id, name, created_at')
      .order('student_id', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ students: data });
  }

  if (req.method === 'POST') {
    const { student_id, name } = req.body || {};
    if (!student_id || !name) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสนักเรียนและชื่อ' });
    }
    const { data, error } = await supabaseAdmin
      .from('students')
      .insert({ student_id: String(student_id).trim(), name: String(name).trim() })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'มีรหัสนักเรียนนี้อยู่แล้ว' });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ student: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAdminAuth(handler);
