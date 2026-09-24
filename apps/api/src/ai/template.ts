import type { SummaryEntry } from '@swasthya-setu/shared-types';

export interface EncounterForSummary {
  encounterDate: string;
  facilityName: string;
  notes: string;
}

// Phase 7's first build step, per the architecture doc: a deterministic
// summary, before any model is involved. `buildTemplateSummary` is the prose
// form sent to a model as context to restructure; `buildTemplateEntries` is
// the structured form saved directly whenever Groq and Gemini are both
// unconfigured, unreachable, or return something that fails schema
// validation — the feature degrades to a working non-AI summary (still one
// row per visit) rather than failing outright.
// `subject` is what the timeline calls the person it describes: the real
// name for the copy a clinician reads, the literal string "the patient" for
// the copy sent to a cloud model. Same builder either way, so the two can't
// drift into describing different visits.
export function buildTemplateSummary(subject: string, encounters: EncounterForSummary[]): string {
  if (encounters.length === 0) {
    return `${subject} has no recorded visits yet.`;
  }
  const lines = encounters.map(
    (e) => `- ${new Date(e.encounterDate).toLocaleDateString()} at ${e.facilityName}: ${e.notes}`
  );
  return [
    `Timeline summary for ${subject} (${encounters.length} recorded visit${
      encounters.length === 1 ? '' : 's'
    }):`,
    ...lines,
  ].join('\n');
}

// The deterministic fallback's structured form. Unlike a model, this can't
// pull a chief complaint or body part out of free text, so those are left
// blank and the UI just doesn't render an empty badge for them — the date,
// facility and full note are still there, one row per visit.
export function buildTemplateEntries(encounters: EncounterForSummary[]): SummaryEntry[] {
  if (encounters.length === 0) {
    return [{ date: '', bodyPart: '', complaint: '', note: 'No recorded visits yet.' }];
  }
  return encounters.map((e) => ({
    date: new Date(e.encounterDate).toLocaleDateString(),
    bodyPart: '',
    complaint: '',
    note: `${e.facilityName}: ${e.notes}`,
  }));
}

// The label standing in for the patient's name in anything leaving this
// backend for a third-party model.
export const DEIDENTIFIED_SUBJECT = 'the patient';
