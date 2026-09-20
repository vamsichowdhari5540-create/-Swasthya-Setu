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
    // A null expires_at is a pre-expiry grant, grandfathered rather than
    // treated as already expired; every grant created after the column
    // was added always sets a real one (see routes/consent.ts).
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .limit(1);

  return !error && (data?.length ?? 0) > 0;
}
