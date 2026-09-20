interface EncounterForSummary {
  encounterDate: string;
  facilityName: string;
  notes: string;
}

// Phase 7's first build step, per the architecture doc: a deterministic
// summary template, before any model is involved. This is also exactly
// what gets saved whenever Groq is unconfigured, unreachable, or returns
// something that fails schema validation — the feature degrades to a
// working non-AI summary rather than failing outright.
// `subject` is what the timeline calls the person it describes: the real
// name for the copy a clinician reads, the literal string "the patient"
// for the copy sent to a cloud model. Same builder either way, so the two
// can't drift into describing different visits.
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

// The label standing in for the patient's name in anything leaving this
// backend for a third-party model.
export const DEIDENTIFIED_SUBJECT = 'the patient';
