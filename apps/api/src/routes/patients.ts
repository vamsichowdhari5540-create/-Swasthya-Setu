import { Router } from 'express';
import type { CreatePatientRequest } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';
import { generateHealthId } from '../patients/generateHealthId';
import { PATIENT_COLUMNS, toPatient } from '../patients/repository';
import { canAccessPatient } from '../patients/access';
import { recordAudit } from '../patients/audit';

export const patientsRouter = Router();

// Registration is a staff action (field worker or doctor). Search stays
// staff-only and directory-only — it returns just enough identity to find
// the right person to scan/request consent from, not clinical content, so
// it isn't access-gated the way the health-id lookup and timeline are.
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
// the opaque health_id, and calls this to reach the authorized record. This
// is where the architecture doc's data flow puts the consent check — right
// after the scan, before any record content is read.
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

    const patient = toPatient(data);
    const allowed = await canAccessPatient(supabase, req.user!, patient);
    if (!allowed) {
      res.status(403).json({
        error: "Your facility doesn't have access to this patient's record.",
        needsConsent: true,
      });
      return;
    }

    await recordAudit(supabase, { patientId: patient.id, actorId: req.user!.id, action: 'view_patient' });
    res.json(patient);
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
