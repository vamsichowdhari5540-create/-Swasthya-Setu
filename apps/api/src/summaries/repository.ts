import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiSummary } from '@swasthya-setu/shared-types';

// Two foreign keys to `profiles` (creator, reviewer) need the explicit
// `!constraint_name` hint, same reasoning as referrals/repository.ts.
export const SUMMARY_SELECT = `
  id, patient_id, created_by, status, source, model, model_version,
  draft_text, edited_text, triage_level, triage_rationale, reviewed_by,
  approved_at, client_mutation_id, created_at,
  creator:profiles!ai_summaries_created_by_fkey(full_name),
  reviewer:profiles!ai_summaries_reviewed_by_fkey(full_name)
`;

type One<T> = T | T[] | null;

function first<T>(value: One<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export interface SummaryRow {
  id: string;
  patient_id: string;
  created_by: string;
  status: AiSummary['status'];
  source: AiSummary['source'];
  model: string | null;
  model_version: string | null;
  draft_text: string;
  edited_text: string | null;
  triage_level: AiSummary['triageLevel'];
  triage_rationale: string | null;
  reviewed_by: string | null;
  approved_at: string | null;
  client_mutation_id: string | null;
  created_at: string;
  creator: One<{ full_name: string }>;
  reviewer: One<{ full_name: string }>;
}

export function toSummary(row: SummaryRow): AiSummary {
  const creator = first(row.creator);
  const reviewer = first(row.reviewer);
  return {
    id: row.id,
    patientId: row.patient_id,
    createdByUserId: row.created_by,
    createdByName: creator?.full_name ?? 'Unknown',
    status: row.status,
    source: row.source,
    model: row.model,
    modelVersion: row.model_version,
    draftText: row.draft_text,
    editedText: row.edited_text,
    triageLevel: row.triage_level,
    triageRationale: row.triage_rationale,
    reviewedByUserId: row.reviewed_by,
    reviewedByName: reviewer?.full_name ?? null,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    clientMutationId: row.client_mutation_id,
  };
}

export async function getSummaryById(supabase: SupabaseClient, id: string): Promise<AiSummary | null> {
  const { data, error } = await supabase.from('ai_summaries').select(SUMMARY_SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return toSummary(data as unknown as SummaryRow);
}
