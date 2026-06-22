import { supabaseAdmin } from '../../../lib/supabaseAdmin';

// Public endpoint — no auth required.
// Returns which week (if any) is currently open for check-in.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data: week, error } = await supabaseAdmin
    .from('weeks')
    .select('id, week_number, question, opened_at')
    .eq('status', 'open')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!week) return res.status(200).json({ open: false });

  return res.status(200).json({ open: true, week });
}
