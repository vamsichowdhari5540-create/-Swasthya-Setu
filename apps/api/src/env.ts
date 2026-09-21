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
  geminiApiKey: optional('GEMINI_API_KEY'),
  // Comma-separated list of allowed origins for CORS and Socket.IO (e.g.
  // "https://swasthyasetu.vercel.app,https://swasthyasetu-admin.vercel.app").
  // Undefined means "no restriction" — the wide-open default this
  // replaces — so a deployment that hasn't set it yet doesn't break, but
  // it should always be set once the real frontend URLs are known.
  corsOrigins: optional('CORS_ORIGINS')?.split(',').map((s) => s.trim()).filter(Boolean),
  // Defaults to disabled: this endpoint deletes the append-only audit
  // trail along with every patient/referral/consent row, on request, from
  // a route reachable by the district_admin credentials this repo's own
  // README used to publish. An opt-in default means a deployment nobody
  // has touched yet — including this one, until the value is set on
  // Render — can't be reset by anyone who just read the public repo. Set
  // ALLOW_DEMO_RESET=true only for the window a live demo actually needs it.
  allowDemoReset: optional('ALLOW_DEMO_RESET') === 'true',
};
