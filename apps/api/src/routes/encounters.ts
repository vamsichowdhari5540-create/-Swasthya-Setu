import { Router } from 'express';
import type { CreateEncounterRequest, Encounter } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';
import { loadPatient, requirePatientAccess } from '../patients/middleware';
import { recordAudit } from '../patients/audit';
import { getIdempotencyKey, insertIdempotent } from '../idempotency';

export const encountersRouter = Router();

const ENCOUNTER_SELECT =
  'id, patient_id, facility_id, encounter_date, notes, recorded_by, client_mutation_id, facilities(name), profiles(full_name)';

interface EncounterRow {
  id: string;
  patient_id: string;
  facility_id: string;
  encounter_date: string;
  notes: string;
  recorded_by: string;
  client_mutation_id: string | null;
  facilities: { name: string }[] | { name: string } | null;
  profiles: { full_name: string }[] | { full_name: string } | null;
}

function toEncounter(row: EncounterRow): Encounter {
  const facility = Array.isArray(row.facilities) ? row.facilities[0] : row.facilities;
  const recorder = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    patientId: row.patient_id,
    facilityId: row.facility_id,
    facilityName: facility?.name ?? 'Unknown facility',
    recordedBy: row.recorded_by,
    recordedByName: recorder?.full_name ?? 'Unknown',
    encounterDate: row.encounter_date,
    notes: row.notes,
    clientMutationId: row.client_mutation_id,
  };
}

// Recording a visit is a staff action; who may record one for this
// particular patient is exactly the same access rule as reading them.
encountersRouter.post(
  '/patients/:patientId/encounters',
  verifyAuth,
  requireRole('anm_asha', 'doctor'),
  loadPatient,
  requirePatientAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    const body = req.body as Partial<CreateEncounterRequest>;
    if (!body.notes?.trim()) {
      res.status(400).json({ error: 'notes is required.' });
      return;
    }
    if (!req.user!.facilityId) {
      res.status(400).json({ error: 'Your account has no facility assigned; cannot record a visit.' });
      return;
    }

    const { data, error, replayed } = await insertIdempotent<EncounterRow>(
      supabase,
      'encounters',
      {
        patient_id: req.patient!.id,
        facility_id: req.user!.facilityId,
        recorded_by: req.user!.id,
        notes: body.notes.trim(),
      },
      getIdempotencyKey(req),
      ENCOUNTER_SELECT
    );

    if (error || !data) {
      res.status(500).json({ error: error ?? 'Could not save this visit.' });
      return;
    }

    // A replayed request already recorded its audit event the first time
    // it was processed — logging it again would be a false second "view"
    // of nothing that actually happened twice.
    if (!replayed) {
      await recordAudit(supabase, {
        patientId: req.patient!.id,
        actorId: req.user!.id,
        action: 'create_encounter',
        metadata: { encounterId: data.id },
      });
    }

    res.status(replayed ? 200 : 201).json(toEncounter(data));
  }
);

// The "minimum-necessary" timeline: append-only encounters for one patient,
// visible to that patient and to any staff currently authorized for them.
encountersRouter.get(
  '/patients/:patientId/encounters',
  verifyAuth,
  requireRole('patient', 'anm_asha', 'doctor'),
  loadPatient,
  requirePatientAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('encounters')
      .select(ENCOUNTER_SELECT)
      .eq('patient_id', req.patient!.id)
      .order('encounter_date', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Staff reading the timeline is a sensitive view worth its own audit
    // entry, distinct from the QR-scan "found this patient" event.
    if (req.user!.role !== 'patient') {
      await recordAudit(supabase, {
        patientId: req.patient!.id,
        actorId: req.user!.id,
        action: 'view_patient',
        metadata: { via: 'timeline' },
      });
    }

    res.json(data.map(toEncounter));
  }
);
