import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AuthUser, DashboardResponse, ResetDemoDataResponse } from '@swasthya-setu/shared-types';

import { apiFetch, ApiError } from './lib/api';
import { ResetDemoDataPanel } from './ResetDemoDataPanel';

const RESET_CONFIRM_PHRASE = 'RESET DEMO DATA';

export function Dashboard({
  session,
  profile,
  onSignOut,
}: {
  session: Session;
  profile: AuthUser;
  onSignOut: () => void;
}) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const load = () => {
    apiFetch<DashboardResponse>(session, '/api/admin/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the dashboard.'));
  };

  useEffect(load, [session]);

  const handleReset = async () => {
    setResetMessage(null);
    try {
      const result = await apiFetch<ResetDemoDataResponse>(session, '/api/admin/reset-demo-data', {
        method: 'POST',
        body: JSON.stringify({ confirm: RESET_CONFIRM_PHRASE }),
      });
      setResetMessage(`Cleared: ${result.clearedTables.join(', ')}`);
      setData(null);
      load();
    } catch (err) {
      setResetMessage(err instanceof ApiError ? err.message : 'Reset failed.');
    }
  };

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>District Dashboard</h1>
          <p className="muted">{profile.fullName}</p>
        </div>
        <button className="ghost" onClick={onSignOut}>
          Sign out
        </button>
      </header>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}

      {data && (
        <>
          <section className="cards">
            <Card label="Facilities" value={data.totals.facilities} />
            <Card label="Patients" value={data.totals.patients} />
            <Card label="Referrals" value={data.totals.referrals} />
          </section>

          <section className="panel">
            <h2>Referral bottlenecks</h2>
            <div className="bars">
              {Object.entries(data.referralsByStatus).map(([status, count]) => (
                <BarRow key={status} label={status} value={count} max={data.totals.referrals || 1} />
              ))}
            </div>
            <div className="latency-row">
              <Latency label="Avg. time to accept" minutes={data.avgAcceptanceLatencyMinutes} />
              <Latency label="Avg. time to complete" minutes={data.avgCompletionLatencyMinutes} />
            </div>
          </section>

          <section className="panel">
            <h2>Facility load</h2>
            <table>
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Type</th>
                  <th>Patients</th>
                  <th>Incoming</th>
                  <th>Pending</th>
                  <th>Outgoing</th>
                </tr>
              </thead>
              <tbody>
                {data.facilityLoad.map((f) => (
                  <tr key={f.facilityId}>
                    <td>{f.facilityName}</td>
                    <td className="muted">{f.type}</td>
                    <td>{f.patientCount}</td>
                    <td>{f.incomingReferrals}</td>
                    <td>{f.pendingIncoming}</td>
                    <td>{f.outgoingReferrals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h2>Sync health</h2>
            <p className="muted small">
              Rows created via the on-device offline outbox (Phase 5) vs. created directly online — the only
              server-side signal of that path, since the outbox itself lives on the device.
            </p>
            <div className="sync-grid">
              <SyncStat label="Visits — offline outbox" value={data.syncHealth.encountersViaOfflineOutbox} />
              <SyncStat label="Visits — online" value={data.syncHealth.encountersOnline} />
              <SyncStat label="Referrals — offline outbox" value={data.syncHealth.referralsViaOfflineOutbox} />
              <SyncStat label="Referrals — online" value={data.syncHealth.referralsOnline} />
            </div>
          </section>

          <section className="panel">
            <h2>Audit activity (last {data.recentAuditEventCount})</h2>
            <div className="bars">
              {Object.entries(data.recentAuditActionCounts).map(([action, count]) => (
                <BarRow key={action} label={action} value={count} max={data.recentAuditEventCount || 1} />
              ))}
            </div>
          </section>

          <ResetDemoDataPanel confirmPhrase={RESET_CONFIRM_PHRASE} onConfirm={handleReset} message={resetMessage} />

          <p className="muted small">Generated {new Date(data.generatedAt).toLocaleString()}</p>
        </>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="card-value">{value}</p>
      <p className="card-label">{label}</p>
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
      <span className="bar-value">{value}</span>
    </div>
  );
}

function Latency({ label, minutes }: { label: string; minutes: number | null }) {
  return (
    <div className="latency">
      <p className="muted small">{label}</p>
      <p className="latency-value">{minutes !== null ? `${minutes} min` : '—'}</p>
    </div>
  );
}

function SyncStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="sync-stat">
      <p className="sync-value">{value}</p>
      <p className="muted small">{label}</p>
    </div>
  );
}
