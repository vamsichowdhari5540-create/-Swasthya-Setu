import { Router } from 'express';
import type { CreatePatientRequest, Patient } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';
import { generateHealthId } from '../patients/generateHealthId';

export const patientsRouter = Router();

function toPatient(row: {
  id: string;
  health_id: string;
  full_name: string;
  date_of_birth: string;
  sex: Patient['sex'];
  facility_id: string;
  user_id: string | null;
}): Patient {
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

const PATIENT_COLUMNS = 'id, health_id, full_name, date_of_birth, sex, facility_id, user_id';

// Registration + lookup are staff actions (field worker or doctor). Search
// and QR resolution stay staff-only in Phase 2 — Phase 3 adds the
// consent/minimum-necessary layer that will refine exactly what each staff
// member is allowed to see, rather than "any staff sees any patient".
patientsRouter.post('/patients', verifyAuth, requireRole('anm_asha', 'doctor'), async (req, res) => {
  const supabase = getSupabase()!;
  const body = req.body as Partial<CreatePatientRequest>;

  if (!body.fullName?.trim() || !body.dateOfBirth || !body.sex) {
    res.status(400).json({ error: 'fullName, dateOfBirth and sex are required.' });
    return;
  }
  if (!req.user!.facilityId) {
    res.status(400).json({ error: 'Your account has no facility assigned; cannot register a patient.' });
    return;
  }

  // Unique constraint on health_id makes a collision self-correcting: retry
  // a handful of times rather than pre-checking (check-then-insert would
  // race under concurrent registrations anyway).
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('patients')
      .insert({
        health_id: generateHealthId(),
        full_name: body.fullName.trim(),
        date_of_birth: body.dateOfBirth,
        sex: body.sex,
        facility_id: req.user!.facilityId,
        created_by: req.user!.id,
      })
      .select(PATIENT_COLUMNS)
      .single();

    if (!error) {
      res.status(201).json(toPatient(data));
      return;
    }
    if (error.code !== '23505') {
      res.status(500).json({ error: error.message });
      return;
    }
    // 23505 = unique_violation on health_id — loop and try a fresh one.
  }

  res.status(500).json({ error: 'Could not generate a unique health ID. Please try again.' });
});

patientsRouter.get('/patients/search', verifyAuth, requireRole('anm_asha', 'doctor'), async (req, res) => {
  const supabase = getSupabase()!;
  // Strip characters that are syntactically meaningful in PostgREST's
  // .or() filter grammar (`,()`) so the query can't be reshaped by input.
  const q = String(req.query.q ?? '').trim().replace(/[,()]/g, '');
  if (!q) {
    res.json([]);
    return;
  }

  const { data, error } = await supabase
    .from('patients')
    .select(PATIENT_COLUMNS)
    .or(`full_name.ilike.%${q}%,health_id.eq.${q.toUpperCase()}`)
    .limit(20);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data.map(toPatient));
});

// The QR scan resolution endpoint: the mobile app scans a code, extracts
// the opaque health_id, and calls this to reach the authorized record.
patientsRouter.get(
  '/patients/health-id/:healthId',
  verifyAuth,
  requireRole('anm_asha', 'doctor'),
  async (req, res) => {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('patients')
      .select(PATIENT_COLUMNS)
      .eq('health_id', req.params.healthId.toUpperCase())
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'No patient matches that QR code.' });
      return;
    }
    res.json(toPatient(data));
  }
);

// A patient viewing their own record (e.g. to display their QR code).
patientsRouter.get('/patients/me', verifyAuth, requireRole('patient'), async (req, res) => {
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('patients')
    .select(PATIENT_COLUMNS)
    .eq('user_id', req.user!.id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: 'No patient record is linked to this account yet.' });
    return;
  }
  res.json(toPatient(data));
});
