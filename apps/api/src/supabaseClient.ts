import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { env } from './env';

let client: SupabaseClient | null = null;

// Returns null when Supabase isn't configured yet so the API can still boot
// and answer /api/health with `database: "not_configured"` during local
// setup, instead of crashing before a developer has created a project.
export function getSupabase(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return null;
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}
