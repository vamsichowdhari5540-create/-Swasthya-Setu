import type { AuthUser, Referral } from '@swasthya-setu/shared-types';

// A referral is visible to staff at either the originating or receiving
// facility, or to the patient it's about (their own account only) — never
// to staff elsewhere, even if they can otherwise see the patient.
export function canAccessReferral(user: AuthUser, referral: Referral, patientUserId: string | null): boolean {
  if (user.role === 'patient') {
    return patientUserId === user.id;
  }
  return canActOnEitherSide(user, referral);
}

export function canActOnReceivingSide(user: AuthUser, referral: Referral): boolean {
  return !!user.facilityId && user.facilityId === referral.receivingFacilityId;
}

export function canActOnEitherSide(user: AuthUser, referral: Referral): boolean {
  return (
    !!user.facilityId &&
    (user.facilityId === referral.originatingFacilityId || user.facilityId === referral.receivingFacilityId)
  );
}
