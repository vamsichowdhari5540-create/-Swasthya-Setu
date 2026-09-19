import { Router } from 'express';
import type { AuditEvent } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';
import { loadPatient } from '../patients/middleware';

export const auditRouter = Router();

const AUDIT_SELECT = 'id, patient_id, actor_id, action, metadata, created_at, profiles(full_name)';

function toAuditEvent(row: {
  id: string;
  patient_id: string;
  actor_id: string;
  action: AuditEvent['action'];
  metadata: Record<string, unknown> | null;
  created_at: string;
  profiles: { full_name: string }[] | { full_name: string } | null;
}): AuditEvent {
  const actor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    patientId: row.patient_id,
    actorId: row.actor_id,
    actorName: actor?.full_name ?? 'Unknown',
    action: row.action,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

// Per the consent explanation screen: the patient can review who has
// accessed or changed access to their record, and so can a district admin
// (oversight) — but no other staff role.
auditRouter.get(
  '/patients/:patientId/audit',
  verifyAuth,
  requireRole('patient', 'district_admin'),
  loadPatient,
  async (req, res) => {
    if (req.user!.role === 'patient' && req.patient!.userId !== req.user!.id) {
      res.status(403).json({ error: 'You can only view your own audit history.' });
      return;
    }

    const supabase = getSupabase()!;
    const { data, error } = await supabase
      .from('audit_events')
      .select(AUDIT_SELECT)
      .eq('patient_id', req.patient!.id)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data.map(toAuditEvent));
  }
);
