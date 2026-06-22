import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { withAdminAuth } from '../../../lib/withAdminAuth';

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PUT') {
    const { student_id, name } = req.body || {};
    if (!student_id || !name) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสนักเรียนและชื่อ' });
    }
    const { data, error } = await supabaseAdmin
      .from('students')
      .update({ student_id: String(student_id).trim(), name: String(name).trim() })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'มีรหัสนักเรียนนี้อยู่แล้ว' });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ student: data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin.from('students').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAdminAuth(handler);
