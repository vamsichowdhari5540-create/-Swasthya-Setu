import type { SupabaseClient } from '@supabase/supabase-js';
import type { Referral } from '@swasthya-setu/shared-types';

// Two foreign keys to `facilities` and two to `profiles` mean PostgREST
// needs the explicit `!constraint_name` hint below to know which one each
// embed refers to — Postgres names them `<table>_<column>_fkey` by default.
export const REFERRAL_SELECT = `
  id, patient_id, originating_facility_id, receiving_facility_id, created_by, accepted_by,
  reason, status, completion_notes, client_mutation_id, created_at, accepted_at, completed_at, cancelled_at,
  patients(full_name, health_id, user_id),
  originating_facility:facilities!referrals_originating_facility_id_fkey(name),
  receiving_facility:facilities!referrals_receiving_facility_id_fkey(name),
  creator:profiles!referrals_created_by_fkey(full_name),
  acceptor:profiles!referrals_accepted_by_fkey(full_name)
`;

type One<T> = T | T[] | null;

function first<T>(value: One<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export interface ReferralRow {
  id: string;
  patient_id: string;
  originating_facility_id: string;
  receiving_facility_id: string;
  created_by: string;
  accepted_by: string | null;
  reason: string;
  status: Referral['status'];
  completion_notes: string | null;
  client_mutation_id: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  patients: One<{ full_name: string; health_id: string; user_id: string | null }>;
  originating_facility: One<{ name: string }>;
  receiving_facility: One<{ name: string }>;
  creator: One<{ full_name: string }>;
  acceptor: One<{ full_name: string }>;
}

export function toReferral(row: ReferralRow): Referral {
  const patient = first(row.patients);
  const originatingFacility = first(row.originating_facility);
  const receivingFacility = first(row.receiving_facility);
  const creator = first(row.creator);
  const acceptor = first(row.acceptor);

  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: patient?.full_name ?? 'Unknown',
    patientHealthId: patient?.health_id ?? '',
    originatingFacilityId: row.originating_facility_id,
    originatingFacilityName: originatingFacility?.name ?? 'Unknown facility',
    receivingFacilityId: row.receiving_facility_id,
    receivingFacilityName: receivingFacility?.name ?? 'Unknown facility',
    createdByUserId: row.created_by,
    createdByName: creator?.full_name ?? 'Unknown',
    acceptedByUserId: row.accepted_by,
    acceptedByName: acceptor?.full_name ?? null,
    status: row.status,
    reason: row.reason,
    completionNotes: row.completion_notes,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    clientMutationId: row.client_mutation_id,
  };
}

export function toPatientUserId(row: ReferralRow): string | null {
  return first(row.patients)?.user_id ?? null;
}

export async function getReferralById(
  supabase: SupabaseClient,
  id: string
): Promise<{ referral: Referral; patientUserId: string | null } | null> {
  const { data, error } = await supabase.from('referrals').select(REFERRAL_SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as ReferralRow;
  return { referral: toReferral(row), patientUserId: toPatientUserId(row) };
}
