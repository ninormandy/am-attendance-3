import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  // Don't throw at import time (it would crash `next build`); routes that
  // actually use this client will fail loudly with a clear Supabase error
  // until the env vars are set.
  console.warn(
    'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Copy .env.local.example to .env.local and fill them in.'
  );
}

// Server-side only. This uses the service_role key, which bypasses Row
// Level Security, so this file must never be imported from client code.
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
