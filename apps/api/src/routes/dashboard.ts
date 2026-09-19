import { Router } from 'express';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';

export const dashboardRouter = Router();

// Phase 9: District Dashboard & Hardening. Read-optimized and aggregated
// only — no patient names, notes or other clinical detail cross the wire
// here, per the guardrail ("keep the dashboard read-optimized and
// aggregated"). Small demo dataset, so aggregating in JS after a handful
// of cheap queries is simpler and just as correct as SQL-side grouping.
dashboardRouter.get('/admin/dashboard', verifyAuth, requireRole('district_admin'), async (_req, res) => {
  const supabase = getSupabase()!;

  const [facilitiesRes, patientsRes, referralsRes, auditRes] = await Promise.all([
    supabase.from('facilities').select('id, name, district, type'),
    supabase.from('patients').select('id, facility_id'),
    supabase
      .from('referrals')
      .select('status, originating_facility_id, receiving_facility_id, created_at, accepted_at, completed_at'),
    supabase
      .from('audit_events')
      .select('id, action, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  if (facilitiesRes.error || patientsRes.error || referralsRes.error || auditRes.error) {
    res.status(500).json({
      error:
        facilitiesRes.error?.message ??
        patientsRes.error?.message ??
        referralsRes.error?.message ??
        auditRes.error?.message,
    });
    return;
  }

  const facilities = facilitiesRes.data ?? [];
  const patients = patientsRes.data ?? [];
  const referrals = referralsRes.data ?? [];
  const auditEvents = auditRes.data ?? [];

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
    facilityLoad,
    recentAuditActionCounts: auditActionCounts,
    recentAuditEventCount: auditEvents.length,
  });
});
