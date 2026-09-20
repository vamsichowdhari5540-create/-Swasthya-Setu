import { Router } from 'express';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';
import { loadPatient, requirePatientAccess } from '../patients/middleware';
import { loadSummary } from '../summaries/middleware';
import { recordAudit } from '../patients/audit';
import { getIdempotencyKey, insertIdempotent } from '../idempotency';
import { SUMMARY_SELECT, toSummary, type SummaryRow } from '../summaries/repository';
import { buildTemplateSummary, DEIDENTIFIED_SUBJECT } from '../ai/template';
import { generateSummary } from '../ai/generate';

export const summariesRouter = Router();

interface EncounterNarrativeRow {
  encounter_date: string;
  notes: string;
  facilities: { name: string }[] | { name: string } | null;
}

// Always rendered as "the patient" — this is both the input sent to Groq
// or Gemini and the saved template fallback if neither produces a
// narrative, so a doctor never sees one summary that names the patient
// and another for the same visit that doesn't. The screen that displays
// this already shows the patient's real name above it, so there's
// nowhere the identity actually goes missing.
async function loadTimelineNarrative(patientId: string): Promise<string> {
  const supabase = getSupabase()!;
  const { data } = await supabase
    .from('encounters')
    .select('encounter_date, notes, facilities(name)')
    .eq('patient_id', patientId)
    .order('encounter_date', { ascending: true });

  const rows = (data ?? []) as unknown as EncounterNarrativeRow[];
  const encounters = rows.map((row) => {
    const facility = Array.isArray(row.facilities) ? row.facilities[0] : row.facilities;
    return {
      encounterDate: row.encounter_date,
      notes: row.notes,
      facilityName: facility?.name ?? 'Unknown facility',
    };
  });

  return buildTemplateSummary(DEIDENTIFIED_SUBJECT, encounters);
}

// Any staff with access to the patient can ask for a draft; per the exit
// test it's specifically the doctor who reviews/edits/approves it below.
summariesRouter.post(
  '/patients/:patientId/summaries',
  verifyAuth,
  requireRole('anm_asha', 'doctor'),
  loadPatient,
  requirePatientAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    const patient = req.patient!;
    const templateSummary = await loadTimelineNarrative(patient.id);
    const generated = await generateSummary(templateSummary);

    const values: Record<string, unknown> = {
      patient_id: patient.id,
      created_by: req.user!.id,
      status: 'draft',
      source: generated.source,
      model: generated.model,
      model_version: generated.modelVersion,
      draft_text: generated.draftText ?? templateSummary,
      triage_level: generated.triageLevel,
      triage_rationale: generated.triageRationale,
    };

    const { data, error, replayed } = await insertIdempotent<SummaryRow>(
      supabase,
      'ai_summaries',
      values,
      getIdempotencyKey(req),
      SUMMARY_SELECT
    );

    if (error || !data) {
      res.status(500).json({ error: error ?? 'Could not generate a summary.' });
      return;
    }

    if (!replayed) {
      await recordAudit(supabase, {
        patientId: patient.id,
        actorId: req.user!.id,
        action: 'generate_summary',
        metadata: { summaryId: data.id, source: values.source },
      });
    }

    res.status(replayed ? 200 : 201).json(toSummary(data));
  }
);

// Draft summaries are assistive content pending review — a patient sees
// one only once a doctor has approved it (Phase 7 guardrail: "AI is
// assistance, not autonomous diagnosis").
summariesRouter.get(
  '/patients/:patientId/summaries',
  verifyAuth,
  requireRole('patient', 'anm_asha', 'doctor'),
  loadPatient,
  requirePatientAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    let query = supabase
      .from('ai_summaries')
      .select(SUMMARY_SELECT)
      .eq('patient_id', req.patient!.id)
      .order('created_at', { ascending: false });

    if (req.user!.role === 'patient') {
      query = query.eq('status', 'approved');
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data as unknown as SummaryRow[]).map(toSummary));
  }
);

summariesRouter.get(
  '/summaries/:id',
  verifyAuth,
  requireRole('patient', 'anm_asha', 'doctor'),
  loadSummary,
  requirePatientAccess,
  async (req, res) => {
    const summary = req.summary!;
    if (req.user!.role === 'patient' && summary.status !== 'approved') {
      res.status(403).json({ error: 'This summary has not been approved yet.' });
      return;
    }
    res.json(summary);
  }
);

// Editing is a doctor's call, matching the exit test's "doctor
// reviews/edits" — an ANM/ASHA can request a draft but not sign off on it.
summariesRouter.patch(
  '/summaries/:id',
  verifyAuth,
  requireRole('doctor'),
  loadSummary,
  requirePatientAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    const summary = req.summary!;
    if (summary.status !== 'draft') {
      res.status(409).json({ error: 'This summary has already been approved and can no longer be edited.' });
      return;
    }
    const editedText = (req.body as { editedText?: string }).editedText?.trim();
    if (!editedText) {
      res.status(400).json({ error: 'editedText is required.' });
      return;
    }

    const { data, error } = await supabase
      .from('ai_summaries')
      .update({ edited_text: editedText })
      .eq('id', summary.id)
      .select(SUMMARY_SELECT)
      .single();

    if (error || !data) {
      res.status(500).json({ error: error?.message ?? 'Could not save the edit.' });
      return;
    }

    await recordAudit(supabase, {
      patientId: summary.patientId,
      actorId: req.user!.id,
      action: 'edit_summary',
      metadata: { summaryId: summary.id },
    });

    res.json(toSummary(data as unknown as SummaryRow));
  }
);

summariesRouter.patch(
  '/summaries/:id/approve',
  verifyAuth,
  requireRole('doctor'),
  loadSummary,
  requirePatientAccess,
  async (req, res) => {
    const supabase = getSupabase()!;
    const summary = req.summary!;
    if (summary.status !== 'draft') {
      res.status(409).json({ error: 'This summary has already been approved.' });
      return;
    }

    const editedText = (req.body as { editedText?: string }).editedText?.trim();

    const { data, error } = await supabase
      .from('ai_summaries')
      .update({
        status: 'approved',
        reviewed_by: req.user!.id,
        approved_at: new Date().toISOString(),
        ...(editedText ? { edited_text: editedText } : {}),
      })
      .eq('id', summary.id)
      .select(SUMMARY_SELECT)
      .single();

    if (error || !data) {
      res.status(500).json({ error: error?.message ?? 'Could not approve this summary.' });
      return;
    }

    await recordAudit(supabase, {
      patientId: summary.patientId,
      actorId: req.user!.id,
      action: 'approve_summary',
      metadata: { summaryId: summary.id },
    });

    res.json(toSummary(data as unknown as SummaryRow));
  }
);
