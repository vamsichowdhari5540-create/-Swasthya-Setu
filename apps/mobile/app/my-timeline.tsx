import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { Encounter } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { useOwnPatient } from '@/lib/useOwnPatient';
import { useLanguage } from '@/lib/i18n';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';

export default function MyTimelineScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session } = useAuth();
  const own = useOwnPatient();
  const { t } = useLanguage();
  const [encounters, setEncounters] = useState<Encounter[] | null>(null);

  useEffect(() => {
    if (own.kind !== 'done') return;
    apiFetch<Encounter[]>(session, `/api/patients/${own.patient.id}/encounters`).then(setEncounters);
  }, [own, session]);

  if (own.kind === 'loading' || (own.kind === 'done' && encounters === null)) {
    return <LoadingScreen />;
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
      {encounters?.length === 0 && <EmptyState icon="time-outline" message={t('patient_noVisits')} />}
      {encounters?.map((encounter) => (
        <View
          key={encounter.id}
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {new Date(encounter.encounterDate).toLocaleString()}
          </Text>
          <Text style={[styles.facility, { color: colors.tint }]}>{encounter.facilityName}</Text>
          <Text style={styles.notes}>{encounter.notes}</Text>
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
    marginBottom: 12,
  },
  meta: {
    fontSize: 11,
    marginBottom: 4,
  },
  facility: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  notes: {
    fontSize: 14,
  },
});
