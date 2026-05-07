import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Service-role Supabase client. Bypasses RLS. ONLY use server-side, in
 * route handlers, cron jobs, or webhooks. Never expose to the client.
 *
 * Always pass an explicit `firmId` filter when querying tenant data.
 */
let _admin: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — admin client unavailable');
  }
  _admin = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
