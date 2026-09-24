// Shared by every model adapter (Groq, Gemini) so the assistance framing —
// "never a diagnosis, doctor must review" — is stated identically to every
// model this backend ever talks to, not just the one that happened to be
// configured first.
// Takes no patient name, by design: nothing this backend sends to a
// third-party model should carry an identifier, and the instructions read
// the same without one. The timeline passed in is already built against
// "the patient" (see ai/template.ts), so there is nowhere here to put a
// name even by accident.
//
// This is not a guarantee that no identifier ever reaches a model —
// encounter notes are free text a health worker typed, and nothing stops
// a name appearing inside one. The claim it supports is narrower and
// true: we do not send identifiers.
export function buildSummaryPrompt(templateSummary: string): string {
  return `You are drafting an assistive clinical handoff summary for a rural health worker, from a synthetic demo patient's visit timeline. This is assistance only, never a diagnosis, and a doctor must review it before it means anything.

Read the timeline below and turn it into one structured entry per visit — short and scannable, for someone reading it during an emergency, not a paragraph. The patient is not named; refer to them as "the patient" if you need to.

Timeline:
${templateSummary}

For each visit, extract:
- "date": the visit's date, exactly as given in the timeline
- "bodyPart": the body part or system primarily concerned (e.g. "Cardiovascular", "Head", "Respiratory"); "" if not clear
- "complaint": the chief complaint in a few words (e.g. "Headache, dizziness"); "" if not clear
- "note": what was found or done, in 12 words or fewer

Then give one assistive triage signal for the whole timeline.

Respond with ONLY a JSON object of this exact shape, no other text, no markdown fences:
{"entries": [{"date": "<string>", "bodyPart": "<string>", "complaint": "<string>", "note": "<string>"}], "triageLevel": "routine" | "priority" | "urgent", "triageRationale": "<one plain-language sentence citing what in the timeline drove this level>"}`;
}
