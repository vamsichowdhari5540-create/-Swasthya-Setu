import { getSupabase } from '../src/supabaseClient';
import type { UserRole } from '@swasthya-setu/shared-types';

// Controlled demo credentials only — see the architecture doc's Phase 1
// guardrail (no paid SMS OTP, no real accounts in the free/SIH environment).
// Password is intentionally simple and documented in the README: this is
// synthetic data behind a free Supabase project, not a production secret.
const DEMO_PASSWORD = 'Demo@1234';

const DEMO_USERS: { email: string; fullName: string; role: UserRole; facility?: string }[] = [
  { email: 'patient@demo.swasthyasetu.app', fullName: 'Demo Patient', role: 'patient' },
  {
    email: 'anm@demo.swasthyasetu.app',
    fullName: 'Demo ANM/ASHA Worker',
    role: 'anm_asha',
    facility: 'Kondapalli Sub Center',
  },
  {
    email: 'doctor@demo.swasthyasetu.app',
    fullName: 'Demo Doctor',
    role: 'doctor',
    facility: 'Vijayawada Government General Hospital',
  },
  { email: 'admin@demo.swasthyasetu.app', fullName: 'Demo District Admin', role: 'district_admin' },
];

async function seedUsers() {
  const supabase = getSupabase();
  if (!supabase) {
    console.error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Copy apps/api/.env.example to apps/api/.env and fill them in first.'
    );
    process.exit(1);
  }

  const { data: facilities, error: facilitiesError } = await supabase
    .from('facilities')
    .select('id, name');
  if (facilitiesError) {
    console.error('Could not read facilities — run npm run seed first:', facilitiesError.message);
    process.exit(1);
  }

  for (const demoUser of DEMO_USERS) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: demoUser.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });

    let userId = created?.user?.id;

    if (createError) {
      // Already exists from a previous run — look it up instead of failing.
      const { data: existing, error: listError } = await supabase.auth.admin.listUsers();
      const match = listError
        ? undefined
        : existing.users.find((u) => u.email === demoUser.email);
      if (!match) {
        console.error(`Failed to create or find ${demoUser.email}:`, createError.message);
        continue;
      }
      userId = match.id;
    }

    const facilityId = demoUser.facility
      ? facilities?.find((f) => f.name === demoUser.facility)?.id ?? null
      : null;

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      email: demoUser.email,
      full_name: demoUser.fullName,
      role: demoUser.role,
      facility_id: facilityId,
    });

    if (profileError) {
      console.error(`Failed to upsert profile for ${demoUser.email}:`, profileError.message);
      continue;
    }

    console.log(`✓ ${demoUser.role.padEnd(14)} ${demoUser.email}`);
  }

  console.log(`\nAll demo accounts use the password: ${DEMO_PASSWORD}`);
}

seedUsers();
