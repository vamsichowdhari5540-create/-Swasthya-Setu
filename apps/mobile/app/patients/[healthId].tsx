import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import type { Patient } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; patient: Patient };

export default function PatientDetailScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session } = useAuth();
  const { healthId } = useLocalSearchParams<{ healthId: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    apiFetch<Patient>(session, `/api/patients/health-id/${healthId}`)
      .then((patient) => {
        if (!cancelled) setState({ kind: 'done', patient });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err instanceof ApiError ? err.message : 'Could not load this patient.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, healthId]);

  if (state.kind === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={{ color: '#c0392b', textAlign: 'center' }}>{state.message}</Text>
      </View>
    );
  }

  const { patient } = state;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.name}>{patient.fullName}</Text>
      <Text style={[styles.healthId, { color: colors.tint }]}>{patient.healthId}</Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Row label="Date of birth" value={patient.dateOfBirth} colors={colors} />
        <Row label="Sex" value={patient.sex} colors={colors} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>Timeline</Text>
        <Text style={[styles.placeholder, { color: colors.muted }]}>
          Encounters and consent-controlled history arrive in Phase 3.
        </Text>
      </View>
    </View>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: (typeof Colors)['light'] }) {
  return (
    <View style={styles.row} lightColor="transparent" darkColor="transparent">
      <Text style={[styles.rowLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  healthId: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
    marginTop: 4,
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  placeholder: {
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 13,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
