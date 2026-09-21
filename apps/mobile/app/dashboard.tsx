import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { DashboardResponse } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { LoadingScreen } from '@/components/LoadingScreen';

// Phase 9: District Dashboard & Hardening. Read-only, aggregated view for
// district_admin — bottlenecks (pending/accepted/completed counts,
// acceptance latency) and facility load, with no patient names or clinical
// detail on this screen at all, per the guardrail.
export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DashboardResponse>(session, '/api/admin/dashboard')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the dashboard.'));
  }, [session]);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={{ color: '#c0392b', textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!data) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>{t('dash_totals')}</Text>
        <Row label={t('dash_facilities')} value={String(data.totals.facilities)} colors={colors} />
        <Row label={t('dash_patients')} value={String(data.totals.patients)} colors={colors} />
        <Row label={t('dash_referrals')} value={String(data.totals.referrals)} colors={colors} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>{t('dash_byStatus')}</Text>
        {Object.entries(data.referralsByStatus).map(([status, count]) => (
          <Row key={status} label={status} value={String(count)} colors={colors} />
        ))}
        <Row
          label={t('dash_avgAccept')}
          value={data.avgAcceptanceLatencyMinutes !== null ? `${data.avgAcceptanceLatencyMinutes} min` : '—'}
          colors={colors}
        />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>{t('dash_facilityLoad')}</Text>
        {data.facilityLoad.map((f) => (
          <View key={f.facilityId} style={[styles.facilityRow, { borderColor: colors.border }]} lightColor="transparent" darkColor="transparent">
            <Text style={[styles.facilityName, { color: colors.tint }]}>{f.facilityName}</Text>
            <Text style={[styles.facilityMeta, { color: colors.muted }]}>
              {f.type} · {f.district} · {f.patientCount} patients · {f.incomingReferrals} incoming (
              {f.pendingIncoming} pending) · {f.outgoingReferrals} outgoing
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>
          {t('dash_auditActivity')} ({data.recentAuditEventCount})
        </Text>
        {Object.entries(data.recentAuditActionCounts).map(([action, count]) => (
          <Row key={action} label={action} value={String(count)} colors={colors} />
        ))}
      </View>

      <Text style={[styles.footer, { color: colors.muted }]}>Generated {new Date(data.generatedAt).toLocaleString()}</Text>
    </ScrollView>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: (typeof Colors)['light'] }) {
  return (
    <View style={styles.row} lightColor="transparent" darkColor="transparent">
      <Text style={[styles.rowLabel, { color: colors.muted, textTransform: 'capitalize' }]}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 16 },
  cardLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 13 },
  rowValue: { fontSize: 13, fontWeight: '700' },
  facilityRow: { borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
  facilityName: { fontSize: 14, fontWeight: '700' },
  facilityMeta: { fontSize: 12, marginTop: 2 },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 8 },
});
