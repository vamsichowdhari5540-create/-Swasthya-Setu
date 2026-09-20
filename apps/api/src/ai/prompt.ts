// Shared by every model adapter (Groq, Ollama) so the assistance framing —
// "never a diagnosis, doctor must review" — is stated identically to every
// model this backend ever talks to, not just the one that happened to be
// configured first.
// Takes no patient name, by design: nothing this backend sends to a
// third-party model should carry an identifier, and the narrative reads
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

Rewrite the timeline below as a concise clinical narrative (2-4 sentences), then give an assistive triage signal. The patient is not named; refer to them as "the patient".

Timeline:
${templateSummary}

Respond with ONLY a JSON object of this exact shape, no other text, no markdown fences:
{"summary": "<string>", "triageLevel": "routine" | "priority" | "urgent", "triageRationale": "<one plain-language sentence citing what in the timeline drove this level>"}`;
}
