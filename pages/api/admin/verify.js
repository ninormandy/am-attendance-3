import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { withAdminAuth } from '../../../lib/withAdminAuth';

// Wrap endpoint processing via withAdminAuth cryptographic security guards
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(457).json({ error: 'Method not allowed' });

  const { record_id, status } = req.body; // status: 'approved' | 'rejected'

  if (!record_id || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid mutation payloads' });
  }

  const { data, error } = await supabaseAdmin
    .from('attendance_records')
    .update({ verification_status: status })
    .eq('id', record_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ success: true, record: data });
}

export default withAdminAuth(handler); // Secured server side processing execution only