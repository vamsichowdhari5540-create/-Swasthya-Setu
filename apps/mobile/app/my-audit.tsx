import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import type { AuditAction, AuditEvent } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { useOwnPatient } from '@/lib/useOwnPatient';
import { useLanguage } from '@/lib/i18n';

const ACTION_LABEL_KEYS: Record<
  AuditAction,
  | 'audit_viewPatient'
  | 'audit_createEncounter'
  | 'audit_grantConsent'
  | 'audit_revokeConsent'
  | 'audit_generateSummary'
  | 'audit_editSummary'
  | 'audit_approveSummary'
  | 'audit_createReferral'
  | 'audit_acceptReferral'
  | 'audit_completeReferral'
  | 'audit_reassignReferral'
  | 'audit_cancelReferral'
  | 'audit_createPatientAccount'
> = {
  view_patient: 'audit_viewPatient',
  create_encounter: 'audit_createEncounter',
  grant_consent: 'audit_grantConsent',
  revoke_consent: 'audit_revokeConsent',
  generate_summary: 'audit_generateSummary',
  edit_summary: 'audit_editSummary',
  approve_summary: 'audit_approveSummary',
  create_referral: 'audit_createReferral',
  accept_referral: 'audit_acceptReferral',
  complete_referral: 'audit_completeReferral',
  reassign_referral: 'audit_reassignReferral',
  cancel_referral: 'audit_cancelReferral',
  create_patient_account: 'audit_createPatientAccount',
};

export default function MyAuditScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session } = useAuth();
  const own = useOwnPatient();
  const { t } = useLanguage();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);

  useEffect(() => {
    if (own.kind !== 'done') return;
    apiFetch<AuditEvent[]>(session, `/api/patients/${own.patient.id}/audit`).then(setEvents);
  }, [own, session]);

  if (own.kind === 'loading' || (own.kind === 'done' && events === null)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  if (own.kind === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>{own.message}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      {events?.length === 0 && (
        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>{t('audit_empty')}</Text>
      )}
      {events?.map((event) => (
        <View
          key={event.id}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.action}>{t(ACTION_LABEL_KEYS[event.action])}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {event.actorName} · {new Date(event.createdAt).toLocaleString()}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  action: {
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 4,
  },
});
