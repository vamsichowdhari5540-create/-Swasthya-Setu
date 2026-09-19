import type { TriageLevel } from '@swasthya-setu/shared-types';

import { env } from '../env';

// Groq's free-tier model lineup changes over time; verified live against
// this account's key at build time (`GET /openai/v1/models`) rather than
// assumed. If this ever 404s again, that endpoint is the fastest way to
// find the current replacement.
const GROQ_MODEL = 'openai/gpt-oss-20b';
const TRIAGE_LEVELS: TriageLevel[] = ['routine', 'priority', 'urgent'];

export interface GroqSummaryResult {
  summary: string;
  triageLevel: TriageLevel;
  triageRationale: string;
}

// The JSON Schema validation the architecture doc's free stack calls for —
// hand-rolled rather than pulling in a library, since the shape is small
// and fixed. Anything that doesn't match this exactly is treated as a
// failed call, never partially trusted.
function isGroqSummaryResult(value: unknown): value is GroqSummaryResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.summary === 'string' &&
    v.summary.trim().length > 0 &&
    typeof v.triageRationale === 'string' &&
    v.triageRationale.trim().length > 0 &&
    typeof v.triageLevel === 'string' &&
    TRIAGE_LEVELS.includes(v.triageLevel as TriageLevel)
  );
}

// Thin backend adapter around Groq's OpenAI-compatible chat completions
// endpoint (no SDK dependency needed). Never throws: every failure mode
// (no key configured, network error, non-JSON reply, schema mismatch)
// returns null so callers fall back to the deterministic template — per
// the guardrail, a model outage must never block getting a summary at all.
export async function requestGroqSummary(
  patientName: string,
  templateSummary: string
): Promise<{ result: GroqSummaryResult; model: string } | null> {
  if (!env.groqApiKey) return null;

  const prompt = `You are drafting an assistive clinical handoff summary for a rural health worker, from a synthetic demo patient's visit timeline. This is assistance only, never a diagnosis, and a doctor must review it before it means anything.

Rewrite the timeline below as a concise clinical narrative (2-4 sentences), then give an assistive triage signal.

Patient: ${patientName}
Timeline:
${templateSummary}

Respond with ONLY a JSON object of this exact shape, no other text:
{"summary": "<string>", "triageLevel": "routine" | "priority" | "urgent", "triageRationale": "<one plain-language sentence citing what in the timeline drove this level>"}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.groqApiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed: unknown = JSON.parse(content);
    if (!isGroqSummaryResult(parsed)) return null;

    return { result: parsed, model: GROQ_MODEL };
  } catch {
    return null;
  }
}
