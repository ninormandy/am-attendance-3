import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { withAdminAuth } from '../../../../lib/withAdminAuth';

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const now = new Date().toISOString();

  // Only one week may be open at a time — close any other open week first.
  const { error: closeErr } = await supabaseAdmin
    .from('weeks')
    .update({ status: 'closed', closed_at: now })
    .eq('status', 'open')
    .neq('id', id);
  if (closeErr) return res.status(500).json({ error: closeErr.message });

  const { data, error } = await supabaseAdmin
    .from('weeks')
    .update({ status: 'open', opened_at: now })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ week: data });
}

export default withAdminAuth(handler);
