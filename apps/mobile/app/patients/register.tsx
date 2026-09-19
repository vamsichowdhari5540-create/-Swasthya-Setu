import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import type { CreatePatientRequest, Patient, Sex } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';

const SEX_OPTIONS: Sex[] = ['female', 'male', 'other'];
const SEX_LABEL_KEYS: Record<Sex, 'sex_female' | 'sex_male' | 'sex_other'> = {
  female: 'sex_female',
  male: 'sex_male',
  other: 'sex_other',
};

export default function RegisterPatientScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { session } = useAuth();
  const { t } = useLanguage();

  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState<Sex>('female');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSave = fullName.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const body: CreatePatientRequest = { fullName: fullName.trim(), dateOfBirth, sex };
      const patient = await apiFetch<Patient>(session, '/api/patients', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      router.replace(`/patients/${patient.healthId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register the patient.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.label}>{t('register_fullName')}</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>{t('register_fullNameHint')}</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        placeholder="e.g. Lakshmi Devi"
        placeholderTextColor={colors.muted}
        value={fullName}
        onChangeText={setFullName}
      />

      <Text style={styles.label}>{t('register_dob')}</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>{t('register_dobHint')}</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.muted}
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
      />

      <Text style={styles.label}>{t('register_sex')}</Text>
      <Text style={[styles.hint, { color: colors.muted }]}>{t('register_sexHint')}</Text>
      <View style={styles.chipsRow} lightColor="transparent" darkColor="transparent">
        {SEX_OPTIONS.map((option) => {
          const active = option === sex;
          return (
            <Pressable
              key={option}
              onPress={() => setSex(option)}
              style={[
                styles.chip,
                { borderColor: colors.border },
                active && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(SEX_LABEL_KEYS[option])}</Text>
            </Pressable>
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, { backgroundColor: canSave ? colors.tint : colors.border }]}
        disabled={!canSave || submitting}
        onPress={handleSubmit}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('register_submit')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
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
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 15,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 18,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: '#fff',
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    marginTop: 16,
  },
  button: {
    marginTop: 32,
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
