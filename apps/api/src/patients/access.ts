import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '@swasthya-setu/shared-types';

// The single place Phase 3's access rule is enforced (see schema.sql):
// a staff member reaches a patient's record if their own facility
// registered that patient (home facility), or the patient has an active
// (non-revoked) consent grant to that facility. Never duplicated into RLS.
export async function canAccessPatient(
  supabase: SupabaseClient,
  user: AuthUser,
  patient: { facilityId: string; id: string }
): Promise<boolean> {
  if (user.facilityId && user.facilityId === patient.facilityId) {
    return true;
  }
  if (!user.facilityId) return false;

  const { data, error } = await supabase
    .from('consents')
    .select('id')
    .eq('patient_id', patient.id)
    .eq('facility_id', user.facilityId)
    .is('revoked_at', null)
    .limit(1);

  return !error && (data?.length ?? 0) > 0;
}
