import { env } from '../env';
import { buildSummaryPrompt } from './prompt';
import { withRetry } from './retry';
import { validateSummaryResult, type SummaryResult } from './schema';

// Requested via the "-latest" alias so this adapter never goes stale the
// way the Groq model id did (that one 404'd after being quietly
// decommissioned) — Google resolves the alias to a concrete version, which
// the response's own `modelVersion` field reports back for us to record.
const GEMINI_MODEL_ALIAS = 'gemini-flash-lite-latest';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  modelVersion?: string;
}

// The concrete model version resolved from the call, e.g.
// "gemini-3.5-flash-lite" behind the "-latest" alias — carried alongside
// the result so the caller can record real provenance, not just the alias.
interface GeminiCallResult {
  result: SummaryResult;
  model: string;
}

async function callGeminiOnce(patientName: string, templateSummary: string): Promise<GeminiCallResult | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ALIAS}:generateContent?key=${env.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildSummaryPrompt(patientName, templateSummary) }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      }
    );
    if (!response.ok) {
      console.warn(`Gemini call failed: ${response.status} ${await response.text().catch(() => '')}`);
      return null;
    }

    const body = (await response.json()) as GeminiResponse;
    const content = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return null;

    const validated = validateSummaryResult(JSON.parse(content));
    if ('error' in validated) {
      console.warn(`Gemini reply failed schema validation: ${validated.error}`);
      return null;
    }
    return { result: validated.result, model: body.modelVersion ?? GEMINI_MODEL_ALIAS };
  } catch (err) {
    console.warn('Gemini call threw:', err instanceof Error ? err.message : err);
    return null;
  }
}

// Second cloud adapter, tried when Groq is unset or fails. Unlike a local
// Ollama fallback, this one also works once the backend is deployed
// (Render has no local model to reach, but it can always reach Google's
// API) — same never-throws contract as every other adapter in the chain.
export async function requestGeminiSummary(
  patientName: string,
  templateSummary: string
): Promise<GeminiCallResult | null> {
  if (!env.geminiApiKey) return null;
  return withRetry(() => callGeminiOnce(patientName, templateSummary));
}
