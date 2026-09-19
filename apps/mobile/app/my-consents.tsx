import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { Consent, Facility } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { useOwnPatient } from '@/lib/useOwnPatient';
import { useLanguage } from '@/lib/i18n';

export default function MyConsentsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session } = useAuth();
  const own = useOwnPatient();
  const { t } = useLanguage();

  const [consents, setConsents] = useState<Consent[] | null>(null);
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [busyFacilityId, setBusyFacilityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (patientId: string) => {
      const [consentData, facilityData] = await Promise.all([
        apiFetch<Consent[]>(session, `/api/patients/${patientId}/consents`),
        apiFetch<Facility[]>(session, '/api/facilities'),
      ]);
      setConsents(consentData);
      setFacilities(facilityData);
    },
    [session]
  );

  useEffect(() => {
    if (own.kind === 'done') reload(own.patient.id);
  }, [own, reload]);

  if (own.kind === 'loading' || (own.kind === 'done' && (consents === null || facilities === null))) {
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

  const patientId = own.patient.id;
  const activeConsents = consents!.filter((c) => !c.revokedAt);
  const activeFacilityIds = new Set(activeConsents.map((c) => c.facilityId));
  const grantableFacilities = facilities!.filter(
    (f) => f.id !== own.patient.facilityId && !activeFacilityIds.has(f.id)
  );

  const grant = async (facilityId: string) => {
    setError(null);
    setBusyFacilityId(facilityId);
    try {
      await apiFetch(session, `/api/patients/${patientId}/consents`, {
        method: 'POST',
        body: JSON.stringify({ facilityId }),
      });
      await reload(patientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not grant consent.');
    } finally {
      setBusyFacilityId(null);
    }
  };

  const revoke = async (consent: Consent) => {
    setError(null);
    setBusyFacilityId(consent.facilityId);
    try {
      await apiFetch(session, `/api/patients/${patientId}/consents/${consent.id}/revoke`, {
        method: 'PATCH',
      });
      await reload(patientId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not revoke consent.');
    } finally {
      setBusyFacilityId(null);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.hint, { color: colors.muted }]}>{t('consent_hint')}</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.sectionTitle}>{t('consent_facilitiesWithAccess')}</Text>
      {activeConsents.length === 0 ? (
        <Text style={[styles.placeholder, { color: colors.muted }]}>{t('consent_noOtherFacility')}</Text>
      ) : (
        activeConsents.map((consent) => (
          <View
            key={consent.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.facilityName}>{consent.facilityName}</Text>
            <Text style={[styles.meta, { color: colors.muted }]}>
              Granted {new Date(consent.grantedAt).toLocaleDateString()}
            </Text>
            <Pressable
              style={[styles.revokeButton, { borderColor: '#c0392b' }]}
              disabled={busyFacilityId === consent.facilityId}
              onPress={() => revoke(consent)}>
              {busyFacilityId === consent.facilityId ? (
                <ActivityIndicator color="#c0392b" />
              ) : (
                <Text style={styles.revokeButtonText}>{t('consent_revokeAccess')}</Text>
              )}
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>{t('consent_grantAccessTitle')}</Text>
      {grantableFacilities.length === 0 ? (
        <Text style={[styles.placeholder, { color: colors.muted }]}>{t('consent_allHaveAccess')}</Text>
      ) : (
        grantableFacilities.map((facility) => (
          <View
            key={facility.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.facilityName}>{facility.name}</Text>
            <Text style={[styles.meta, { color: colors.muted }]}>{facility.district}</Text>
            <Pressable
              style={[styles.grantButton, { backgroundColor: colors.tint }]}
              disabled={busyFacilityId === facility.id}
              onPress={() => grant(facility.id)}>
              {busyFacilityId === facility.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.grantButtonText}>{t('consent_grantAccess')}</Text>
              )}
            </Pressable>
          </View>
        ))
      )}

      <Link href="/my-audit" asChild>
        <Pressable style={StyleSheet.flatten([styles.auditLink, { borderColor: colors.border }])}>
          <Text style={[styles.auditLinkText, { color: colors.tint }]}>{t('consent_viewAuditLog')}</Text>
        </Pressable>
      </Link>
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
  hint: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 19,
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  placeholder: {
    fontSize: 13,
    marginBottom: 20,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  facilityName: {
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  grantButton: {
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  grantButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  revokeButton: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  revokeButtonText: {
    color: '#c0392b',
    fontSize: 13,
    fontWeight: '600',
  },
  auditLink: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  auditLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
