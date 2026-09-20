import { Router } from 'express';
import type { CompleteReferralRequest, CreateReferralRequest, ReassignReferralRequest } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';
import { loadPatient, requirePatientAccess } from '../patients/middleware';
import { loadReferral, requireReferralAccess } from '../referrals/middleware';
import { canActOnEitherSide, canActOnReceivingSide } from '../referrals/access';
import { REFERRAL_SELECT, toPatientUserId, toReferral, type ReferralRow } from '../referrals/repository';
import { broadcastReferralChanged } from '../realtime/socket';
import { recordAudit } from '../patients/audit';
import { getIdempotencyKey, insertIdempotent } from '../idempotency';

export const referralsRouter = Router();

// Create — tied to a patient the caller already has access to (Phase 3's
// rule applies here too, via requirePatientAccess), from that patient's
// current facility, snapshotted so the referral's history stays correct
// even if the creator later moves facilities.
referralsRouter.post(
  '/patients/:patientId/referrals',
  verifyAuth,
  requireRole('anm_asha', 'doctor'),
  loadPatient,
  requirePatientAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    const body = req.body as Partial<CreateReferralRequest>;
    if (!body.receivingFacilityId || !body.reason?.trim()) {
      res.status(400).json({ error: 'receivingFacilityId and reason are required.' });
      return;
    }
    if (!req.user!.facilityId) {
      res.status(400).json({ error: 'Your account has no facility assigned; cannot create a referral.' });
      return;
    }

    const { data, error, replayed } = await insertIdempotent<ReferralRow>(
      supabase,
      'referrals',
      {
        patient_id: req.patient!.id,
        originating_facility_id: req.user!.facilityId,
        receiving_facility_id: body.receivingFacilityId,
        created_by: req.user!.id,
        reason: body.reason.trim(),
      },
      getIdempotencyKey(req),
      REFERRAL_SELECT
    );

    if (error || !data) {
      res.status(500).json({ error: error ?? 'Could not create the referral.' });
      return;
    }

    const referral = toReferral(data);
    // A replayed create shouldn't re-notify everyone as if this were a
    // second, brand-new referral landing in their queue, or log a second
    // audit event for one thing that happened once.
    if (!replayed) {
      await recordAudit(supabase, {
        patientId: referral.patientId,
        actorId: req.user!.id,
        action: 'create_referral',
        metadata: { referralId: referral.id, receivingFacilityId: referral.receivingFacilityId },
      });
      broadcastReferralChanged(referral, toPatientUserId(data));
    }
    res.status(replayed ? 200 : 201).json(referral);
  }
);

// Facility-level queues: "incoming" is what you might accept/complete;
// "outgoing" is what your facility has sent elsewhere and is tracking.
referralsRouter.get('/referrals', verifyAuth, requireRole('anm_asha', 'doctor'), async (req, res) => {
  const supabase = getSupabase()!;
  if (!req.user!.facilityId) {
    res.json([]);
    return;
  }
  const box = req.query.box === 'outgoing' ? 'outgoing' : 'incoming';
  const column = box === 'outgoing' ? 'originating_facility_id' : 'receiving_facility_id';

  const { data, error } = await supabase
    .from('referrals')
    .select(REFERRAL_SELECT)
    .eq(column, req.user!.facilityId)
    .order('created_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json((data as unknown as ReferralRow[]).map(toReferral));
});

// A patient's own referrals.
referralsRouter.get(
  '/patients/:patientId/referrals',
  verifyAuth,
  requireRole('patient'),
  loadPatient,
  requirePatientAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('referrals')
      .select(REFERRAL_SELECT)
      .eq('patient_id', req.patient!.id)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data as unknown as ReferralRow[]).map(toReferral));
  }
);

referralsRouter.get('/referrals/:id', verifyAuth, loadReferral, requireReferralAccess, (req, res) => {
  res.json(req.referral);
});

referralsRouter.patch(
  '/referrals/:id/accept',
  verifyAuth,
  requireRole('doctor'),
  loadReferral,
  requireReferralAccess,
  async (req, res) => {
    if (!canActOnReceivingSide(req.user!, req.referral!)) {
      res.status(403).json({ error: 'Only the receiving facility can accept this referral.' });
      return;
    }
    if (req.referral!.status !== 'pending') {
      res.status(400).json({ error: `Cannot accept a referral that is ${req.referral!.status}.` });
      return;
    }

    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('referrals')
      .update({ status: 'accepted', accepted_by: req.user!.id, accepted_at: new Date().toISOString() })
      .eq('id', req.referral!.id)
      .eq('status', 'pending')
      .select(REFERRAL_SELECT)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(409).json({ error: 'This referral was already updated by someone else.' });
      return;
    }

    const row = data as unknown as ReferralRow;
    const referral = toReferral(row);
    await recordAudit(supabase, {
      patientId: referral.patientId,
      actorId: req.user!.id,
      action: 'accept_referral',
      metadata: { referralId: referral.id },
    });
    broadcastReferralChanged(referral, toPatientUserId(row));
    res.json(referral);
  }
);

referralsRouter.patch(
  '/referrals/:id/complete',
  verifyAuth,
  requireRole('doctor'),
  loadReferral,
  requireReferralAccess,
  async (req, res) => {
    if (!canActOnReceivingSide(req.user!, req.referral!)) {
      res.status(403).json({ error: 'Only the receiving facility can complete this referral.' });
      return;
    }
    if (req.referral!.status !== 'accepted') {
      res.status(400).json({ error: `Cannot complete a referral that is ${req.referral!.status}.` });
      return;
    }

    const body = req.body as Partial<CompleteReferralRequest>;
    const supabase = getSupabase()!;

    const { data, error } = await supabase
      .from('referrals')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completion_notes: body.completionNotes?.trim() || null,
      })
      .eq('id', req.referral!.id)
      .eq('status', 'accepted')
      .select(REFERRAL_SELECT)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(409).json({ error: 'This referral was already updated by someone else.' });
      return;
    }

    const row = data as unknown as ReferralRow;
    const referral = toReferral(row);

    // Completion updates the patient timeline too — the architecture doc's
    // data flow is explicit that this is what "sees updated status +
    // timeline" means. It's an ordinary append-only encounter, same as any
    // other recorded visit.
    const { data: encounter } = await supabase
      .from('encounters')
      .insert({
        patient_id: referral.patientId,
        facility_id: referral.receivingFacilityId,
        recorded_by: req.user!.id,
        notes: `Referral completed: ${referral.reason}.${
          referral.completionNotes ? ` ${referral.completionNotes}` : ''
        }`,
      })
      .select('id')
      .maybeSingle();

    // Two things happened here and the trail should show both: the
    // referral closed, and a visit was appended to the patient's record.
    // The encounter written above reached the timeline without an audit
    // event, unlike one recorded through the encounters route.
    await recordAudit(supabase, {
      patientId: referral.patientId,
      actorId: req.user!.id,
      action: 'complete_referral',
      metadata: { referralId: referral.id },
    });
    if (encounter) {
      await recordAudit(supabase, {
        patientId: referral.patientId,
        actorId: req.user!.id,
        action: 'create_encounter',
        metadata: { encounterId: encounter.id, viaReferralId: referral.id },
      });
    }

    broadcastReferralChanged(referral, toPatientUserId(row));
    res.json(referral);
  }
);

referralsRouter.patch(
  '/referrals/:id/reassign',
  verifyAuth,
  requireRole('anm_asha', 'doctor'),
  loadReferral,
  requireReferralAccess,
  async (req, res) => {
    if (!canActOnReceivingSide(req.user!, req.referral!)) {
      res.status(403).json({ error: 'Only the current receiving facility can reassign this referral.' });
      return;
    }
    if (req.referral!.status !== 'pending') {
      res.status(400).json({ error: 'Only a pending referral can be reassigned.' });
      return;
    }

    const facilityId = (req.body as Partial<ReassignReferralRequest>).facilityId;
    if (!facilityId) {
      res.status(400).json({ error: 'facilityId is required.' });
      return;
    }

    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('referrals')
      .update({ receiving_facility_id: facilityId })
      .eq('id', req.referral!.id)
      .eq('status', 'pending')
      .select(REFERRAL_SELECT)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(409).json({ error: 'This referral was already updated by someone else.' });
      return;
    }

    const row = data as unknown as ReferralRow;
    const referral = toReferral(row);
    await recordAudit(supabase, {
      patientId: referral.patientId,
      actorId: req.user!.id,
      action: 'reassign_referral',
      metadata: { referralId: referral.id, toFacilityId: facilityId },
    });
    broadcastReferralChanged(referral, toPatientUserId(row));
    res.json(referral);
  }
);

referralsRouter.patch(
  '/referrals/:id/cancel',
  verifyAuth,
  requireRole('anm_asha', 'doctor'),
  loadReferral,
  requireReferralAccess,
  async (req, res) => {
    if (!canActOnEitherSide(req.user!, req.referral!)) {
      res.status(403).json({ error: "You don't have access to this referral." });
      return;
    }
    if (req.referral!.status !== 'pending' && req.referral!.status !== 'accepted') {
      res.status(400).json({ error: `Cannot cancel a referral that is ${req.referral!.status}.` });
      return;
    }

    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('referrals')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', req.referral!.id)
      .in('status', ['pending', 'accepted'])
      .select(REFERRAL_SELECT)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(409).json({ error: 'This referral was already updated by someone else.' });
      return;
    }

    const row = data as unknown as ReferralRow;
    const referral = toReferral(row);
    await recordAudit(supabase, {
      patientId: referral.patientId,
      actorId: req.user!.id,
      action: 'cancel_referral',
      metadata: { referralId: referral.id },
    });
    broadcastReferralChanged(referral, toPatientUserId(row));
    res.json(referral);
  }
);
