import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';

type Stage = 'checking' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useLanguage();

  const [stage, setStage] = useState<Stage>(Platform.OS === 'web' ? 'checking' : 'invalid');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // The mobile app's Supabase client sets detectSessionInUrl: false (see
    // lib/supabase.ts) so a URL a native WebView happens to load can never
    // silently sign someone in — which means this one page has to do that
    // exchange itself, explicitly, rather than getting it for free the way
    // a default-configured client would.
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      setStage('invalid');
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      setStage(exchangeError ? 'invalid' : 'ready');
    });
  }, []);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await supabase.auth.signOut();
    setStage('done');
  };

  if (stage === 'checking') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  if (stage === 'invalid') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.title}>{t('title_forgotPassword')}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {Platform.OS === 'web' ? t('reset_invalidLink') : t('reset_webOnly')}
        </Text>
      </View>
    );
  }

  if (stage === 'done') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={styles.title}>{t('title_forgotPassword')}</Text>
        <Text style={[styles.subtitle, { color: colors.tint }]}>{t('reset_success')}</Text>
        <Pressable style={[styles.button, { backgroundColor: colors.tint }]} onPress={() => router.replace('/login')}>
          <Text style={styles.buttonText}>{t('login_signIn')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.title}>{t('reset_title')}</Text>

      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        placeholder={t('reset_newPassword')}
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, { backgroundColor: password.length >= 6 ? colors.tint : colors.border }]}
        disabled={password.length < 6 || submitting}
        onPress={handleSubmit}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('reset_submit')}</Text>}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
