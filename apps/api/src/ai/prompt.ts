// Shared by every model adapter (Groq, Ollama) so the assistance framing —
// "never a diagnosis, doctor must review" — is stated identically to every
// model this backend ever talks to, not just the one that happened to be
// configured first.
export function buildSummaryPrompt(patientName: string, templateSummary: string): string {
  return `You are drafting an assistive clinical handoff summary for a rural health worker, from a synthetic demo patient's visit timeline. This is assistance only, never a diagnosis, and a doctor must review it before it means anything.

Rewrite the timeline below as a concise clinical narrative (2-4 sentences), then give an assistive triage signal.

Patient: ${patientName}
Timeline:
${templateSummary}

Respond with ONLY a JSON object of this exact shape, no other text, no markdown fences:
{"summary": "<string>", "triageLevel": "routine" | "priority" | "urgent", "triageRationale": "<one plain-language sentence citing what in the timeline drove this level>"}`;
}
