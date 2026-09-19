import type { SupabaseClient } from '@supabase/supabase-js';
import type { Consultation } from '@swasthya-setu/shared-types';

// Two foreign keys to `profiles` (created_by, joined_by) need the explicit
// `!constraint_name` hint, same reasoning as referrals/repository.ts.
export const CONSULTATION_SELECT = `
  id, referral_id, patient_id, created_by, joined_by, mode, status,
  created_at, started_at, ended_at, duration_seconds,
  patients(full_name),
  creator:profiles!consultations_created_by_fkey(full_name),
  joiner:profiles!consultations_joined_by_fkey(full_name)
`;

type One<T> = T | T[] | null;

function first<T>(value: One<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export interface ConsultationRow {
  id: string;
  referral_id: string;
  patient_id: string;
  created_by: string;
  joined_by: string | null;
  mode: Consultation['mode'];
  status: Consultation['status'];
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  patients: One<{ full_name: string }>;
  creator: One<{ full_name: string }>;
  joiner: One<{ full_name: string }>;
}

export function toConsultation(row: ConsultationRow): Consultation {
  const patient = first(row.patients);
  const creator = first(row.creator);
  const joiner = first(row.joiner);

  return {
    id: row.id,
    referralId: row.referral_id,
    patientId: row.patient_id,
    patientName: patient?.full_name ?? 'Unknown',
    createdByUserId: row.created_by,
    createdByName: creator?.full_name ?? 'Unknown',
    joinedByUserId: row.joined_by,
    joinedByName: joiner?.full_name ?? null,
    mode: row.mode,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
  };
}

export async function getConsultationById(
  supabase: SupabaseClient,
  id: string
): Promise<{ consultation: Consultation; row: ConsultationRow } | null> {
  const { data, error } = await supabase
    .from('consultations')
    .select(CONSULTATION_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as ConsultationRow;
  return { consultation: toConsultation(row), row };
}
