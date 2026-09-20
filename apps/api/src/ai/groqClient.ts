import { env } from '../env';
import { buildSummaryPrompt } from './prompt';
import { withRetry } from './retry';
import { validateSummaryResult, type SummaryResult } from './schema';

// Groq's free-tier model lineup changes over time; verified live against
// this account's key at build time (`GET /openai/v1/models`) rather than
// assumed. If this ever 404s again, that endpoint is the fastest way to
// find the current replacement.
const GROQ_MODEL = 'openai/gpt-oss-20b';

// Without this, a hung connection rides Node's ~300s default, doubled by
// withRetry and again by the Gemini leg — a summary request could sit for
// minutes before falling back to the template. The chain is only useful if
// each leg gives up fast enough for the next one to still matter.
const REQUEST_TIMEOUT_MS = 10_000;

async function callGroqOnce(patientName: string, templateSummary: string): Promise<SummaryResult | null> {
  if (!env.groqApiKey) return null;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.groqApiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: buildSummaryPrompt(patientName, templateSummary) }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`Groq call failed: ${response.status} ${await response.text().catch(() => '')}`);
      return null;
    }

    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;

    const validated = validateSummaryResult(JSON.parse(content));
    if ('error' in validated) {
      console.warn(`Groq reply failed schema validation: ${validated.error}`);
      return null;
    }
    return validated.result;
  } catch (err) {
    console.warn('Groq call threw:', err instanceof Error ? err.message : err);
    return null;
  }
}

// Adapter around Groq's OpenAI-compatible chat completions endpoint (no SDK
// dependency needed). Never throws: every failure mode (no key configured,
// network error, non-JSON reply, schema mismatch) returns null so the
// orchestrator (ai/generate.ts) moves on to the next adapter in the chain —
// per the guardrail, a model outage must never block getting a summary.
export async function requestGroqSummary(
  patientName: string,
  templateSummary: string
): Promise<{ result: SummaryResult; model: string } | null> {
  if (!env.groqApiKey) return null;
  const result = await withRetry(() => callGroqOnce(patientName, templateSummary));
  return result ? { result, model: GROQ_MODEL } : null;
}
