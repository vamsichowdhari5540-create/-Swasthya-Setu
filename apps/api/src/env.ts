import path from 'node:path';
import dotenv from 'dotenv';

// Load apps/api/.env relative to this file, not process.cwd(), so the API
// finds its env whether it's started from the repo root (npm workspace
// scripts) or from within apps/api directly.
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  supabaseUrl: optional('SUPABASE_URL'),
  supabaseServiceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),
  groqApiKey: optional('GROQ_API_KEY'),
};
