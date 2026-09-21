import type { Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

// The offline outbox (Phase 5) retries a queued mutation until it gets a
// response — including retries after the *first* attempt actually
// succeeded but the device never saw the response (e.g. connection dropped
// mid-flight). This header is the client-generated id that makes replaying
// that request land on the same row instead of creating a duplicate.
export function getIdempotencyKey(req: Request): string | null {
  const header = req.header('Idempotency-Key');
  return header?.trim() || null;
}

// Insert with a client_mutation_id, treating a unique-constraint hit on
// that column as "this exact mutation already succeeded" rather than an
// error: re-fetch and hand back the existing row so the caller can't tell
// the difference between "created now" and "created on an earlier attempt
// of this same request".
export async function insertIdempotent<T>(
  supabase: SupabaseClient,
  table: string,
  values: Record<string, unknown>,
  clientMutationId: string | null,
  select: string
): Promise<{ data: T | null; error: string | null; replayed: boolean }> {
  const { data, error } = await supabase
    .from(table)
    .insert(clientMutationId ? { ...values, client_mutation_id: clientMutationId } : values)
    .select(select)
    .single();

  if (!error) {
    return { data: data as T, error: null, replayed: false };
  }

  if (error.code === '23505' && clientMutationId) {
    const { data: existing, error: fetchError } = await supabase
      .from(table)
      .select(select)
      .eq('client_mutation_id', clientMutationId)
      .single();
    if (fetchError || !existing) {
      return { data: null, error: error.message, replayed: false };
    }
    // The unique-constraint hit only proves *some* row already has this
    // client_mutation_id, not that it's the caller's own retry — every
    // caller of this function passes a client-supplied header value as
    // the key, and client_mutation_id is unique per table, not scoped to
    // the patient the request has already been authorized against. Without
    // this check, colliding with (or knowing) another patient's mutation
    // id would hand back that patient's row instead of the caller's own,
    // straight past requirePatientAccess. A genuine retry always matches
    // the row it originally created, so this only ever rejects a
    // collision, never a real replay.
    const row = existing as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(values)) {
      if (key === 'client_mutation_id') continue;
      if (row[key] !== value) {
        return { data: null, error: 'This idempotency key was already used for a different request.', replayed: false };
      }
    }
    return { data: existing as T, error: null, replayed: true };
  }

  return { data: null, error: error.message, replayed: false };
}
