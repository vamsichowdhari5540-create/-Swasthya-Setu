import { Router } from 'express';
import type { Consent } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';
import { loadPatient, requirePatientAccess } from '../patients/middleware';
import { recordAudit } from '../patients/audit';

export const consentRouter = Router();

const CONSENT_SELECT = 'id, patient_id, facility_id, granted_at, expires_at, revoked_at, facilities(name)';

// ABDM-style consent artifacts always carry a validity period; this is
// the one this backend grants by default. Re-granting after expiry (or
// after revoking) starts a fresh window rather than extending the old one.
const CONSENT_VALIDITY_DAYS = 90;

function toConsent(row: {
  id: string;
  patient_id: string;
  facility_id: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  facilities: { name: string }[] | { name: string } | null;
}): Consent {
  const facility = Array.isArray(row.facilities) ? row.facilities[0] : row.facilities;
  return {
    id: row.id,
    patientId: row.patient_id,
    facilityId: row.facility_id,
    facilityName: facility?.name ?? 'Unknown facility',
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

// Consent is something only the patient themselves controls — see the
// consent explanation screen. `requirePatientAccess` enforces the
// ownership check (patient role + patient.userId === caller) for every
// route below.
consentRouter.get(
  '/patients/:patientId/consents',
  verifyAuth,
  requireRole('patient'),
  loadPatient,
  requirePatientAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('consents')
      .select(CONSENT_SELECT)
      .eq('patient_id', req.patient!.id)
      .order('granted_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data.map(toConsent));
  }
);

consentRouter.post(
  '/patients/:patientId/consents',
  verifyAuth,
  requireRole('patient'),
  loadPatient,
  requirePatientAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    const facilityId = req.body?.facilityId as string | undefined;
    if (!facilityId) {
      res.status(400).json({ error: 'facilityId is required.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const { data: existing, error: existingError } = await supabase
      .from('consents')
      .select('id')
      .eq('patient_id', req.patient!.id)
      .eq('facility_id', facilityId)
      .is('revoked_at', null)
      // An expired-but-never-revoked grant shouldn't block re-granting —
      // only a currently active one should.
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .limit(1);

    if (existingError) {
      res.status(500).json({ error: existingError.message });
      return;
    }
    if (existing.length > 0) {
      res.status(400).json({ error: 'This facility already has active access.' });
      return;
    }

    const expiresAt = new Date(Date.now() + CONSENT_VALIDITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('consents')
      .insert({
        patient_id: req.patient!.id,
        facility_id: facilityId,
        granted_by: req.user!.id,
        expires_at: expiresAt,
      })
      .select(CONSENT_SELECT)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await recordAudit(supabase, {
      patientId: req.patient!.id,
      actorId: req.user!.id,
      action: 'grant_consent',
      metadata: { facilityId },
    });

    res.status(201).json(toConsent(data));
  }
);

consentRouter.patch(
  '/patients/:patientId/consents/:consentId/revoke',
  verifyAuth,
  requireRole('patient'),
  loadPatient,
  requirePatientAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('consents')
      .update({ revoked_at: new Date().toISOString(), revoked_by: req.user!.id })
      .eq('id', req.params.consentId)
      .eq('patient_id', req.patient!.id)
      .is('revoked_at', null)
      .select(CONSENT_SELECT)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'No active consent with that ID.' });
      return;
    }

    await recordAudit(supabase, {
      patientId: req.patient!.id,
      actorId: req.user!.id,
      action: 'revoke_consent',
      metadata: { facilityId: data.facility_id },
    });

    res.json(toConsent(data));
  }
);
