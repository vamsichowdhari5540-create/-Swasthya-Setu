import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import type { Facility } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { loadFacilities } from '@/lib/facilitiesCache';
import { useLanguage } from '@/lib/i18n';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';

export default function NewReferralScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { session, profile } = useAuth();
  const { queueReferral } = useSync();
  const { t } = useLanguage();
  const { patientId, patientName } = useLocalSearchParams<{ patientId: string; patientName?: string }>();

  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFacilities(session).then(setFacilities);
  }, [session]);

  const options = facilities?.filter((f) => f.id !== profile?.facilityId) ?? [];
  const canSave = !!facilityId && reason.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSave) return;
    const facility = options.find((f) => f.id === facilityId);
    if (!facility) return;
    setError(null);
    try {
      // Local-first, same as recording a visit: this queues to the
      // on-device outbox and returns immediately, online or not.
      await queueReferral(patientId, {
        patientName: patientName ?? 'Patient',
        receivingFacilityId: facility.id,
        receivingFacilityName: facility.name,
        reason: reason.trim(),
      });
      router.replace('/sync-status');
    } catch {
      setError('Could not queue the referral.');
    }
  };

  if (facilities === null) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      {!!patientName && <Text style={[styles.subtitle, { color: colors.muted }]}>Referring {patientName}</Text>}

      <Text style={styles.label}>{t('referral_receivingFacility')}</Text>
      {options.length === 0 && (
        <EmptyState
          icon="cloud-offline-outline"
          message="No other facilities cached yet — connect once so this list is available offline later."
        />
      )}
      {options.map((facility) => {
        const active = facility.id === facilityId;
        return (
          <Pressable
            key={facility.id}
            onPress={() => setFacilityId(facility.id)}
            style={[
              styles.facilityRow,
              { borderColor: active ? colors.tint : colors.border, backgroundColor: colors.card },
            ]}>
            <Text style={[styles.facilityName, active && { color: colors.tint }]}>{facility.name}</Text>
            <Text style={[styles.facilityMeta, { color: colors.muted }]}>
              {facility.district} · {facility.type.replace('_', ' ')}
            </Text>
          </Pressable>
        );
      })}

      <Text style={styles.label}>{t('referral_reason')}</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>{t('referral_reasonHint')}</Text>
      <View style={styles.inputRow} lightColor="transparent" darkColor="transparent">
        <TextInput
          style={[
            styles.input,
            styles.inputWithVoice,
            { borderColor: colors.border, color: colors.text, backgroundColor: colors.card },
          ]}
          placeholder="synthetic demo data only"
          placeholderTextColor={colors.muted}
          value={reason}
          onChangeText={setReason}
          multiline
        />
        <VoiceInputButton onResult={(text) => setReason((prev) => (prev ? `${prev} ${text}` : text))} />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, { backgroundColor: canSave ? colors.tint : colors.border }]}
        disabled={!canSave}
        onPress={handleSubmit}>
        <Text style={styles.buttonText}>{t('referral_submit')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
  },
  hint: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 8,
  },
  facilityRow: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  facilityName: {
    fontSize: 14,
    fontWeight: '700',
  },
  facilityMeta: {
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  inputWithVoice: {
    flex: 1,
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    marginTop: 16,
  },
  button: {
    marginTop: 28,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
