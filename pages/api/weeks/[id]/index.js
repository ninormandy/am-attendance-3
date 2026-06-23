import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { withAdminAuth } from '../../../../lib/withAdminAuth';

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  const { data: week, error: weekErr } = await supabaseAdmin
    .from('weeks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (weekErr) return res.status(500).json({ error: weekErr.message });
  if (!week) return res.status(404).json({ error: 'ไม่พบสัปดาห์นี้' });

  // CRITICAL FIX: Explicitly add 'photo_url' and 'verification_status' to the select string
  const { data: records, error: recErr } = await supabaseAdmin
    .from('attendance_records')
    .select('id, student_id, student_name, answer, seconds_taken, submitted_at, photo_url, verification_status')
    .eq('week_id', id)
    .order('submitted_at', { ascending: true });
  if (recErr) return res.status(500).json({ error: recErr.message });

  const { count: totalStudents, error: countErr } = await supabaseAdmin
    .from('students')
    .select('*', { count: 'exact', head: true });
  if (countErr) return res.status(500).json({ error: countErr.message });

  // Standardize naming conventions so frontend templates match seamlessly
  const standardizedRecords = records.map(row => ({
    ...row,
    photoUrl: row.photo_url,
    verificationStatus: row.verification_status
  }));

  // Return the standardized records array back to the frontend dashboard
  return res.status(200).json({ 
    success: true, // Included to match frontend `.then(data => data.success)` gates safely
    week, 
    records: standardizedRecords, 
    total_students: totalStudents ?? 0 
  });
}

export default withAdminAuth(handler);