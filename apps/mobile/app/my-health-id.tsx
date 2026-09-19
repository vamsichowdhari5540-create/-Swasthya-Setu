import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { Patient } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; patient: Patient };

export default function MyHealthIdScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    apiFetch<Patient>(session, '/api/patients/me')
      .then((patient) => {
        if (!cancelled) setState({ kind: 'done', patient });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message:
              err instanceof ApiError && err.status === 404
                ? 'No patient record is linked to your account yet. Ask a field worker to register you.'
                : 'Could not load your health ID.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

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
        <Text style={{ color: colors.muted, textAlign: 'center' }}>{state.message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <View style={styles.qrCard}>
        <QRCode value={state.patient.healthId} size={220} />
      </View>
      <Text style={styles.name}>{state.patient.fullName}</Text>
      <Text style={[styles.healthId, { color: colors.tint }]}>{state.patient.healthId}</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>
        Show this to a field worker or doctor to let them find your record.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  qrCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
  },
  healthId: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
    marginTop: 4,
    marginBottom: 16,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
  },
});
