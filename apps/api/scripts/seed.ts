import { getSupabase } from '../src/supabaseClient';

// Synthetic demo data only — see AGENTS.md / the architecture doc's
// free-cost boundary: no real patient or facility data in this environment.
const DEMO_FACILITIES = [
  { name: 'Kondapalli Sub Center', district: 'Krishna', type: 'sub_center' },
  { name: 'Ibrahimpatnam PHC', district: 'Krishna', type: 'phc' },
  { name: 'Vijayawada Government General Hospital', district: 'Krishna', type: 'district_hospital' },
] as const;

async function seed() {
  const supabase = getSupabase();
  if (!supabase) {
    console.error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Copy apps/api/.env.example to apps/api/.env and fill them in first.'
    );
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('facilities')
    .upsert(DEMO_FACILITIES, { onConflict: 'name' })
    .select();

  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log(`Seeded ${data?.length ?? 0} demo facilities.`);
}

seed();
