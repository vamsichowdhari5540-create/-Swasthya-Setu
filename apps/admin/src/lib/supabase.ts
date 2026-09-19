import { createClient } from '@supabase/supabase-js';

// This console only ever uses Supabase Auth directly (sign in/out). Every
// other read/write goes through the Express API, same rule as the mobile
// app — see apps/mobile/lib/supabase.ts and AGENTS.md.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
