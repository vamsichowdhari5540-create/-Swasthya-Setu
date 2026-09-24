import Ajv, { type JSONSchemaType } from 'ajv';
import type { TriageLevel, SummaryEntry } from '@swasthya-setu/shared-types';

const TRIAGE_LEVELS: TriageLevel[] = ['routine', 'priority', 'urgent'];

export interface SummaryResult {
  entries: SummaryEntry[];
  triageLevel: TriageLevel;
  triageRationale: string;
}

// The JSON Schema validation the architecture doc's Phase 7 free stack
// explicitly calls for. Both model adapters (Groq, Gemini) run their raw
// JSON reply through this exact schema — a model's own "structured output"
// mode is a hint to the model, not a guarantee about what it actually
// returns, so this is the one place a malformed or hallucinated shape is
// caught before it ever reaches the database. `entries` is one item per
// visit rather than a paragraph, so a doctor can scan it in an emergency.
const SUMMARY_RESULT_SCHEMA: JSONSchemaType<SummaryResult> = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', minLength: 1 },
          bodyPart: { type: 'string' },
          complaint: { type: 'string' },
          note: { type: 'string', minLength: 1 },
        },
        required: ['date', 'bodyPart', 'complaint', 'note'],
        additionalProperties: false,
      },
      minItems: 1,
    },
    triageLevel: { type: 'string', enum: TRIAGE_LEVELS },
    triageRationale: { type: 'string', minLength: 1 },
  },
  required: ['entries', 'triageLevel', 'triageRationale'],
  additionalProperties: true,
};

const ajv = new Ajv();
const validate = ajv.compile(SUMMARY_RESULT_SCHEMA);

// Returns the validated, correctly-typed result, or null with the ajv
// error text for logging — never throws, never returns a partially-trusted
// object. Callers treat null exactly like a network failure: fall back to
// the next adapter in the chain.
export function validateSummaryResult(value: unknown): { result: SummaryResult } | { error: string } {
  if (validate(value)) {
    return { result: value };
  }
  const error = ajv.errorsText(validate.errors, { separator: '; ' });
  return { error };
}
