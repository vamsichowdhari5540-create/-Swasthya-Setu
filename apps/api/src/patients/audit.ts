import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuditAction } from '@swasthya-setu/shared-types';

// Fire-and-forget by design: a logging failure must never block the
// underlying clinical action (recording a visit, granting consent). It's
// still awaited by callers so ordering in the audit trail matches the
// order actions actually happened.
export async function recordAudit(
  supabase: SupabaseClient,
  event: {
    patientId: string;
    actorId: string;
    action: AuditAction;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from('audit_events').insert({
    patient_id: event.patientId,
    actor_id: event.actorId,
    action: event.action,
    metadata: event.metadata ?? null,
  });
  if (error) {
    console.error('Failed to record audit event:', error.message, event);
  }
}
