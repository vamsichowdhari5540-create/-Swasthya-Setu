import { requestGroqSummary } from './groqClient';
import { requestGeminiSummary } from './geminiClient';
import type { SummaryResult } from './schema';

const TEMPLATE_VERSION = 'template-v1';
const GROQ_ADAPTER_VERSION = 'groq-adapter-v1';
const GEMINI_ADAPTER_VERSION = 'gemini-adapter-v1';

export interface GeneratedSummary {
  source: 'groq' | 'gemini' | 'template';
  model: string | null;
  modelVersion: string;
  draftText: string;
  triageLevel: SummaryResult['triageLevel'] | null;
  triageRationale: string | null;
}

// The orchestrator behind Phase 7's Build sequence: a deterministic
// template is always available (computed by the caller and passed in as
// the guaranteed fallback text), then two cloud model adapters — Groq
// first, Gemini second — either of which may improve on it with a real
// narrative and a triage signal. Both providers because a single vendor's
// outage or a decommissioned model (which happened to the first Groq model
// id this used) would otherwise take the whole feature down with it. Every
// adapter shares the same JSON Schema (ai/schema.ts), so whichever one
// succeeds produces the same validated shape; the caller never needs to
// know which one it was.
export async function generateSummary(patientName: string, templateSummary: string): Promise<GeneratedSummary> {
  const groq = await requestGroqSummary(patientName, templateSummary);
  if (groq) {
    return {
      source: 'groq',
      model: groq.model,
      modelVersion: GROQ_ADAPTER_VERSION,
      draftText: groq.result.summary,
      triageLevel: groq.result.triageLevel,
      triageRationale: groq.result.triageRationale,
    };
  }

  const gemini = await requestGeminiSummary(patientName, templateSummary);
  if (gemini) {
    return {
      source: 'gemini',
      model: gemini.model,
      modelVersion: GEMINI_ADAPTER_VERSION,
      draftText: gemini.result.summary,
      triageLevel: gemini.result.triageLevel,
      triageRationale: gemini.result.triageRationale,
    };
  }

  return {
    source: 'template',
    model: null,
    modelVersion: TEMPLATE_VERSION,
    draftText: templateSummary,
    triageLevel: null,
    triageRationale: null,
  };
}
