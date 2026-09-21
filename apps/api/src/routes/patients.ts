import { Router } from 'express';
import {
  healthIdToLoginEmail,
  type CreatePatientAccountRequest,
  type CreatePatientAccountResponse,
  type CreatePatientRequest,
} from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';
import { generateHealthId } from '../patients/generateHealthId';
import { generateTempPassword } from '../patients/generateTempPassword';
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

// Give a patient their own login, from the field worker's phone, while the
// patient is still in front of them. The alternative this replaces — the
// patient signs up separately and an operator links the two records
// afterwards — needs a human with service-role access for every single
// registration, and leaves days where the record exists but the person it
// belongs to can't reach it.
//
// email_confirm is set because the field worker has just met this person:
// the confirmation round-trip would only prove control of an inbox, which
// is neither the identity check that matters here nor something many
// patients have. That's also what makes the derived-email path work at
// all, since nothing is ever delivered to it.
patientsRouter.post(
  '/patients/:healthId/account',
  verifyAuth,
  requireRole('anm_asha', 'doctor'),
  async (req, res) => {
    const supabase = getSupabase()!;
    const body = req.body as Partial<CreatePatientAccountRequest>;
    const providedEmail = body.email?.trim().toLowerCase();

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
      res.status(404).json({ error: 'No patient matches that health ID.' });
      return;
    }

    const patient = toPatient(data);
    if (patient.userId) {
      res.status(409).json({ error: 'This patient already has an app login.' });
      return;
    }
    const allowed = await canAccessPatient(supabase, req.user!, patient);
    if (!allowed) {
      res.status(403).json({
        error: "Your facility doesn't have access to this patient's record.",
        needsConsent: true,
      });
      return;
    }

    const email = providedEmail || healthIdToLoginEmail(patient.healthId);
    const temporaryPassword = generateTempPassword();

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: patient.fullName, role: 'patient' },
    });
    if (createError || !created.user) {
      res.status(400).json({ error: createError?.message ?? 'Could not create the login.' });
      return;
    }

    // Filtering on user_id being null makes this the point where two field
    // workers pressing the button at once resolve: the loser matches no
    // row and cleans up after itself, rather than silently stranding an
    // account nobody can reach.
    const { data: linked, error: linkError } = await supabase
      .from('patients')
      .update({ user_id: created.user.id })
      .eq('id', patient.id)
      .is('user_id', null)
      .select('id')
      .maybeSingle();

    if (linkError || !linked) {
      await supabase.auth.admin.deleteUser(created.user.id);
      res.status(500).json({ error: 'Could not link the new login to this patient. Please try again.' });
      return;
    }

    await recordAudit(supabase, {
      patientId: patient.id,
      actorId: req.user!.id,
      action: 'create_patient_account',
      metadata: { derivedLogin: !providedEmail },
    });

    res.status(201).json({
      loginId: providedEmail || patient.healthId,
      temporaryPassword,
    } satisfies CreatePatientAccountResponse);
  }
);

patientsRouter.get('/patients/search', verifyAuth, requireRole('anm_asha', 'doctor'), async (req, res) => {
  const supabase = getSupabase()!;
  // Strip characters that are syntactically meaningful in PostgREST's
  // .or() filter grammar (`,()`) so the query can't be reshaped by input,
  // and the LIKE wildcards so a query can't widen its own match — `?q=%`
  // would otherwise walk the whole patient directory 20 rows at a time.
  // PostgREST treats `*` as an alias for `%` specifically so a caller
  // doesn't have to URL-encode `%` (see their docs on the `ilike` filter),
  // so both have to be stripped or `?q=**` reopens the exact same hole.
  // A directory lookup has to be a lookup, not an enumeration.
  const q = String(req.query.q ?? '')
    .trim()
    .replace(/[,()%_*]/g, '');
  // Two characters is the shortest that still narrows anything; a
  // single letter is a directory dump by another name.
  if (q.length < 2) {
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

  // The query above finds candidates by name/ID alone — it has no idea yet
  // whether this caller is allowed to see them. Without this, search was
  // the one patient-touching action in the app that bypassed the facility/
  // consent rule everything else enforces: a self-registered "doctor"
  // could sweep name/DOB/sex/health-ID for any patient nationwide. Reusing
  // canAccessPatient here (rather than a second copy of the rule) keeps it
  // the single enforcement point the rest of the app already relies on;
  // the candidate list from the query above is capped at 20, so this is at
  // most 20 small indexed lookups, not an unbounded fan-out.
  const candidates = data.map(toPatient);
  const visible = [];
  for (const candidate of candidates) {
    if (await canAccessPatient(supabase, req.user!, candidate)) {
      visible.push(candidate);
    }
  }

  // Every patient actually disclosed to this searcher is a real access to
  // their identity, same as a QR scan — logged the same way, so "who has
  // looked me up" (My Audit Log) can't be walked around by using search
  // instead of the scanner.
  for (const patient of visible) {
    await recordAudit(supabase, {
      patientId: patient.id,
      actorId: req.user!.id,
      action: 'view_patient',
      metadata: { via: 'search' },
    });
  }

  res.json(visible);
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
