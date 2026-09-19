import type { SupabaseClient } from '@supabase/supabase-js';
import type { Patient } from '@swasthya-setu/shared-types';

export const PATIENT_COLUMNS = 'id, health_id, full_name, date_of_birth, sex, facility_id, user_id';

interface PatientRow {
  id: string;
  health_id: string;
  full_name: string;
  date_of_birth: string;
  sex: Patient['sex'];
  facility_id: string;
  user_id: string | null;
}

export function toPatient(row: PatientRow): Patient {
  return {
    id: row.id,
    healthId: row.health_id,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    sex: row.sex,
    facilityId: row.facility_id,
    userId: row.user_id,
  };
}

export async function getPatientById(supabase: SupabaseClient, id: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select(PATIENT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return toPatient(data);
}
