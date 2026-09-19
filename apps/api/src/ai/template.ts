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
export function buildTemplateSummary(
  patient: { fullName: string },
  encounters: EncounterForSummary[]
): string {
  if (encounters.length === 0) {
    return `${patient.fullName} has no recorded visits yet.`;
  }
  const lines = encounters.map(
    (e) => `- ${new Date(e.encounterDate).toLocaleDateString()} at ${e.facilityName}: ${e.notes}`
  );
  return [
    `Timeline summary for ${patient.fullName} (${encounters.length} recorded visit${
      encounters.length === 1 ? '' : 's'
    }):`,
    ...lines,
  ].join('\n');
}
