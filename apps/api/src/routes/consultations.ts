import { Router } from 'express';
import type { CreateConsultationRequest } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';
import { loadReferral, requireReferralAccess } from '../referrals/middleware';
import { loadConsultation } from '../consultations/middleware';
import { CONSULTATION_SELECT, toConsultation, type ConsultationRow } from '../consultations/repository';
import { broadcastConsultationChanged } from '../realtime/socket';
import { recordAudit } from '../patients/audit';

export const consultationsRouter = Router();

function broadcast(row: ConsultationRow, referral: { originatingFacilityId: string; receivingFacilityId: string }) {
  broadcastConsultationChanged(toConsultation(row), referral);
}

// A consultation only makes sense once the doctor has accepted the
// referral — the "consultation / assessment" step in the architecture
// doc's data flow sits between ACCEPTED and COMPLETED, never before.
consultationsRouter.post(
  '/referrals/:id/consultations',
  verifyAuth,
  requireRole('anm_asha', 'doctor'),
  loadReferral,
  requireReferralAccess,
  async (req, res) => {
    if (req.referral!.status !== 'accepted') {
      res.status(400).json({ error: 'A consultation can only be started for an accepted referral.' });
      return;
    }

    const body = req.body as Partial<CreateConsultationRequest>;
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('consultations')
      .insert({
        referral_id: req.referral!.id,
        patient_id: req.referral!.patientId,
        created_by: req.user!.id,
        mode: body.mode === 'audio' ? 'audio' : 'video',
      })
      .select(CONSULTATION_SELECT)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const row = data as unknown as ConsultationRow;
    broadcast(row, req.referral!);
    res.status(201).json(toConsultation(row));
  }
);

// The latest consultation for a referral — lets a screen that only knows
// the referral (not a specific consultation id) show "join the call in
// progress" instead of always offering to start a new one.
consultationsRouter.get(
  '/referrals/:id/consultations/latest',
  verifyAuth,
  loadReferral,
  requireReferralAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('consultations')
      .select(CONSULTATION_SELECT)
      .eq('referral_id', req.referral!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ? toConsultation(data as unknown as ConsultationRow) : null);
  }
);

consultationsRouter.get('/consultations/:id', verifyAuth, loadConsultation, (req, res) => {
  res.json(req.consultation);
});

// Idempotent for the same joiner (supports reconnecting on a weak link
// without the second PATCH being treated as an error), but rejects a third
// party once someone else has already joined.
consultationsRouter.patch('/consultations/:id/join', verifyAuth, loadConsultation, async (req, res) => {
  const supabase = getSupabase()!;
  const consultation = req.consultation!;

  if (consultation.status === 'ended') {
    res.status(400).json({ error: 'This consultation has already ended.' });
    return;
  }
  if (consultation.joinedByUserId && consultation.joinedByUserId !== req.user!.id) {
    res.status(409).json({ error: 'Someone else has already joined this consultation.' });
    return;
  }

  const { data, error } = await supabase
    .from('consultations')
    .update({
      joined_by: req.user!.id,
      status: 'active',
      started_at: consultation.startedAt ?? new Date().toISOString(),
    })
    .eq('id', consultation.id)
    .select(CONSULTATION_SELECT)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const row = data as unknown as ConsultationRow;
  broadcast(row, req.consultationReferral!);
  res.json(toConsultation(row));
});

consultationsRouter.patch('/consultations/:id/end', verifyAuth, loadConsultation, async (req, res) => {
  const consultation = req.consultation!;
  if (consultation.status === 'ended') {
    res.json(consultation);
    return;
  }

  const supabase = getSupabase()!;
  const endedAt = new Date();
  const startedAt = consultation.startedAt ? new Date(consultation.startedAt) : new Date(consultation.createdAt);
  const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

  const { data, error } = await supabase
    .from('consultations')
    .update({ status: 'ended', ended_at: endedAt.toISOString(), duration_seconds: durationSeconds })
    .eq('id', consultation.id)
    .select(CONSULTATION_SELECT)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const row = data as unknown as ConsultationRow;
  const finished = toConsultation(row);

  // Return to the patient record with consultation metadata saved — an
  // ordinary append-only encounter, same pattern as a completed referral.
  // Attributed to the receiving facility regardless of which side actually
  // pressed "end" (a patient ending the call has no facility of their own).
  const minutes = Math.round(durationSeconds / 60);
  const { data: encounter } = await supabase
    .from('encounters')
    .insert({
      patient_id: finished.patientId,
      facility_id: req.consultationReferral!.receivingFacilityId,
      recorded_by: req.user!.id,
      notes: `Teleconsultation (${finished.mode}) completed. Duration: ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    })
    .select('id')
    .maybeSingle();

  // This encounter reached the patient's timeline without an audit event,
  // unlike one recorded through the encounters route — same append, so it
  // gets the same entry in the trail.
  if (encounter) {
    await recordAudit(supabase, {
      patientId: finished.patientId,
      actorId: req.user!.id,
      action: 'create_encounter',
      metadata: { encounterId: encounter.id, viaConsultationId: finished.id },
    });
  }

  broadcast(row, req.consultationReferral!);
  res.json(finished);
});
