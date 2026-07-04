import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { withAdminAuth } from '../../../../lib/withAdminAuth';

async function handler(req, res) {
  // Only allow POST or DELETE requests for safety
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query; // Get the week UUID from the route parameter

  if (!id) {
    return res.status(400).json({ error: 'ไม่พบรหัสสัปดาห์' });
  }

  // Delete the week row from the database
  const { error } = await supabaseAdmin
    .from('weeks')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, message: 'ลบสัปดาห์สำเร็จ' });
}

export default withAdminAuth(handler);