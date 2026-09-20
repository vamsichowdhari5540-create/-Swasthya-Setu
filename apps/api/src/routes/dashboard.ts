import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';
import { env } from '../env';

export const dashboardRouter = Router();

// PostgREST caps a single .select() at 1000 rows by default, silently —
// no error, just a truncated result — so anything counted or averaged in
// JS after a plain .select() is quietly wrong once a table passes that
// size. This pages through in fixed-size chunks so every row this
// dashboard aggregates over is actually accounted for, however large the
// table gets; only worth doing here because a district's full patient or
// referral history is exactly the kind of table that outgrows 1000 rows
// while a hackathon demo's isn't.
const PAGE_SIZE = 1000;

async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  order = 'id'
): Promise<{ data: T[]; error: string | null }> {
  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: rows, error: error.message };
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return { data: rows, error: null };
}

// Phase 9: District Dashboard & Hardening. Read-optimized and aggregated
// only — no patient names, notes or other clinical detail cross the wire
// here, per the guardrail ("keep the dashboard read-optimized and
// aggregated"). Aggregating in JS after fetching every row (not a plain
// .select(), see fetchAll above) is still simpler than SQL-side grouping
// and correct at any table size, just at the cost of more round trips.
dashboardRouter.get('/admin/dashboard', verifyAuth, requireRole('district_admin'), async (_req, res) => {
  const supabase = getSupabase()!;

  const [facilitiesRes, patientsRes, referralsRes, auditRes, encountersRes] = await Promise.all([
    fetchAll<{ id: string; name: string; district: string; type: string }>(
      supabase,
      'facilities',
      'id, name, district, type'
    ),
    fetchAll<{ id: string; facility_id: string }>(supabase, 'patients', 'id, facility_id'),
    fetchAll<{
      status: string;
      originating_facility_id: string;
      receiving_facility_id: string;
      created_at: string;
      accepted_at: string | null;
      completed_at: string | null;
      client_mutation_id: string | null;
    }>(
      supabase,
      'referrals',
      'status, originating_facility_id, receiving_facility_id, created_at, accepted_at, completed_at, client_mutation_id'
    ),
    // The dashboard's activity feed only ever shows the most recent 200,
    // so unlike the tables above there's no aggregate to get wrong by
    // capping this one — it's a display limit, not a counting limit.
    supabase
      .from('audit_events')
      .select('id, action, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    // client_mutation_id is set only when a row arrived through the
    // on-device offline outbox (Phase 5) — the one server-side signal of
    // whether that path is actually being exercised, since the outbox
    // itself lives on the device, not in this database.
    fetchAll<{ id: string; client_mutation_id: string | null }>(
      supabase,
      'encounters',
      'id, client_mutation_id'
    ),
  ]);

  if (facilitiesRes.error || patientsRes.error || referralsRes.error || auditRes.error || encountersRes.error) {
    res.status(500).json({
      error:
        facilitiesRes.error ??
        patientsRes.error ??
        referralsRes.error ??
        auditRes.error?.message ??
        encountersRes.error,
    });
    return;
  }

  const facilities = facilitiesRes.data;
  const patients = patientsRes.data;
  const referrals = referralsRes.data;
  const auditEvents = auditRes.data ?? [];
  const encounters = encountersRes.data;

  const referralsByStatus: Record<string, number> = { pending: 0, accepted: 0, completed: 0, cancelled: 0 };
  for (const r of referrals) {
    referralsByStatus[r.status] = (referralsByStatus[r.status] ?? 0) + 1;
  }

  // Bottleneck signal: average minutes a referral waited before being
  // accepted, only over referrals that actually reached that state.
  const acceptedLatencies = referrals
    .filter((r) => r.accepted_at)
    .map((r) => (new Date(r.accepted_at as string).getTime() - new Date(r.created_at).getTime()) / 60000);
  const avgAcceptanceLatencyMinutes = acceptedLatencies.length
    ? Math.round(acceptedLatencies.reduce((a, b) => a + b, 0) / acceptedLatencies.length)
    : null;

  // Second bottleneck signal: how long a referral sits accepted before
  // it's actually completed, i.e. the "assessment in progress" stage —
  // distinct from the wait-to-be-accepted stage above.
  const completionLatencies = referrals
    .filter((r) => r.accepted_at && r.completed_at)
    .map((r) => (new Date(r.completed_at as string).getTime() - new Date(r.accepted_at as string).getTime()) / 60000);
  const avgCompletionLatencyMinutes = completionLatencies.length
    ? Math.round(completionLatencies.reduce((a, b) => a + b, 0) / completionLatencies.length)
    : null;

  const syncHealth = {
    encountersViaOfflineOutbox: encounters.filter((e) => e.client_mutation_id).length,
    encountersOnline: encounters.filter((e) => !e.client_mutation_id).length,
    referralsViaOfflineOutbox: referrals.filter((r) => r.client_mutation_id).length,
    referralsOnline: referrals.filter((r) => !r.client_mutation_id).length,
  };

  const facilityLoad = facilities.map((f) => ({
    facilityId: f.id,
    facilityName: f.name,
    district: f.district,
    type: f.type,
    patientCount: patients.filter((p) => p.facility_id === f.id).length,
    outgoingReferrals: referrals.filter((r) => r.originating_facility_id === f.id).length,
    incomingReferrals: referrals.filter((r) => r.receiving_facility_id === f.id).length,
    pendingIncoming: referrals.filter((r) => r.receiving_facility_id === f.id && r.status === 'pending').length,
  }));

  const auditActionCounts: Record<string, number> = {};
  for (const e of auditEvents) {
    auditActionCounts[e.action] = (auditActionCounts[e.action] ?? 0) + 1;
  }

  res.json({
    generatedAt: new Date().toISOString(),
    totals: {
      facilities: facilities.length,
      patients: patients.length,
      referrals: referrals.length,
    },
    referralsByStatus,
    avgAcceptanceLatencyMinutes,
    avgCompletionLatencyMinutes,
    syncHealth,
    facilityLoad,
    recentAuditActionCounts: auditActionCounts,
    recentAuditEventCount: auditEvents.length,
  });
});

// Test-data reset & demo-mode control, per Phase 9's Build list. Wipes
// every synthetic transactional row (encounters, referrals, consultations,
// AI summaries, consents, audit log, patients) back to the clean seeded
// state — facilities and demo login accounts are untouched, since those
// aren't test data, they're the environment itself. Deletes in FK-safe
// order (children before the patients/referrals they reference).
// Requires an explicit confirm phrase in the body, not just the role
// check, so a misclick can't wipe the demo mid-presentation.
const RESET_CONFIRM_PHRASE = 'RESET DEMO DATA';

dashboardRouter.post('/admin/reset-demo-data', verifyAuth, requireRole('district_admin'), async (req, res) => {
  // Deletes the append-only audit trail along with everything else, on
  // request, from a route that's live on the deployed API. Fine during a
  // demo period; not something that should stay reachable indefinitely.
  // Defaults to enabled (see env.ts) so this doesn't change behavior
  // until ALLOW_DEMO_RESET=false is set once judging is over.
  if (!env.allowDemoReset) {
    res.status(403).json({ error: 'Demo data reset is disabled on this deployment.' });
    return;
  }

  const { confirm } = req.body as { confirm?: string };
  if (confirm !== RESET_CONFIRM_PHRASE) {
    res.status(400).json({ error: `Send { "confirm": "${RESET_CONFIRM_PHRASE}" } to proceed.` });
    return;
  }

  const supabase = getSupabase()!;
  const tables = ['audit_events', 'ai_summaries', 'consultations', 'consents', 'encounters', 'referrals', 'patients'];

  for (const table of tables) {
    // Supabase requires a filter on delete; this matches every row without
    // relying on a specific column existing across all seven tables.
    const { error } = await supabase.from(table).delete().not('id', 'is', null);
    if (error) {
      res.status(500).json({ error: `Failed clearing ${table}: ${error.message}` });
      return;
    }
  }

  res.json({ reset: true, clearedTables: tables });
});
