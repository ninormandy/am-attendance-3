import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { withAdminAuth } from '../../../lib/withAdminAuth';

async function handler(req, res) {
  if (req.method === 'GET') {
    const { data: weeks, error } = await supabaseAdmin
      .from('weeks')
      .select('id, week_number, question, status, opened_at, closed_at, created_at')
      .order('week_number', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    const { data: counts, error: countErr } = await supabaseAdmin
      .from('attendance_records')
      .select('week_id');
    if (countErr) return res.status(500).json({ error: countErr.message });

    const countMap = {};
    for (const r of counts) countMap[r.week_id] = (countMap[r.week_id] || 0) + 1;

    const weeksWithCounts = weeks.map((w) => ({ ...w, present_count: countMap[w.id] || 0 }));
    return res.status(200).json({ weeks: weeksWithCounts });
  }

  if (req.method === 'POST') {
    const { week_number, question } = req.body || {};
    if (!week_number || !question) {
      return res.status(400).json({ error: 'กรุณากรอกสัปดาห์และคำถาม' });
    }
    const { data, error } = await supabaseAdmin
      .from('weeks')
      .insert({ week_number: Number(week_number), question: String(question).trim(), status: 'closed' })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'มีสัปดาห์นี้อยู่แล้ว' });
      }
      return res.status(500).json({ error: error.message });
    }
    return res.status(201).json({ week: data });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}

export default withAdminAuth(handler);
