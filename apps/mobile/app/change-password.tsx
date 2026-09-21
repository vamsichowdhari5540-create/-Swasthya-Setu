import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';

// Deliberately separate from forgot-password/reset-password: those exist
// for someone who is signed OUT and needs an emailed link back in. This is
// for someone already signed in — most importantly a patient whose login
// was created by a field worker (see apps/api routes/patients.ts's
// :healthId/account endpoint) and handed a temporary password to read off
// a screen or a slip of paper. That patient may have no real inbox at all
// (a derived @patients.swasthyasetu.invalid address), so the emailed-link
// flow can never reach them — updateUser on the existing session is the
// only path that works unconditionally, for every account.
export default function ChangePasswordScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useLanguage();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSave = password.length >= 6 && password === confirmPassword;

  const handleSubmit = async () => {
    setError(null);
    if (password !== confirmPassword) {
      setError(t('changePassword_mismatch'));
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.title}>{t('changePassword_title')}</Text>
        <Text style={[styles.subtitle, { color: colors.tint }]}>{t('changePassword_success')}</Text>
        <Pressable style={[styles.button, { backgroundColor: colors.tint }]} onPress={() => router.replace('/')}>
          <Text style={styles.buttonText}>{t('changePassword_done')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.title}>{t('changePassword_title')}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{t('changePassword_subtitle')}</Text>

      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        placeholder={t('changePassword_newPassword')}
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        placeholder={t('changePassword_confirmPassword')}
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, { backgroundColor: canSave ? colors.tint : colors.border }]}
        disabled={!canSave || submitting}
        onPress={handleSubmit}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('changePassword_submit')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
