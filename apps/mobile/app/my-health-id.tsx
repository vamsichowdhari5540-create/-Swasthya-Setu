import { ActivityIndicator, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useOwnPatient } from '@/lib/useOwnPatient';
import { useLanguage } from '@/lib/i18n';

export default function MyHealthIdScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const state = useOwnPatient();
  const { t } = useLanguage();

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
      <Text style={[styles.hint, { color: colors.muted }]}>{t('healthid_hint')}</Text>
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
