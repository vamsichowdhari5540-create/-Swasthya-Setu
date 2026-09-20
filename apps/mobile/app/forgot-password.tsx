import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';

// Where Supabase sends the reset link. This has to be the web build, not a
// native deep link: the recipient opens the email on whatever device they
// have handy, which usually isn't the one with the app installed, and a
// mailto link can only ever open in a browser reliably. Configurable so a
// local dev build can point at a local web server instead.
const RESET_REDIRECT_URL = `${process.env.EXPO_PUBLIC_WEB_URL ?? 'https://swasthya-sethu.vercel.app'}/reset-password`;

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    // Supabase doesn't reveal whether the email exists either way (avoids
    // leaking which addresses have accounts), so the UI shows the same
    // "check your inbox" message regardless of the actual outcome.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_REDIRECT_URL,
    });
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.title}>{t('forgot_title')}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{t('forgot_subtitle')}</Text>

      {sent ? (
        <Text style={[styles.info, { color: colors.tint }]}>{t('forgot_sent')}</Text>
      ) : (
        <>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
            placeholder={t('login_email')}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, { backgroundColor: email.trim() ? colors.tint : colors.border }]}
            disabled={!email.trim() || submitting}
            onPress={handleSubmit}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('forgot_submit')}</Text>}
          </Pressable>
        </>
      )}

      <Link href="/login" style={styles.link}>
        <Text style={[styles.linkText, { color: colors.tint }]}>{t('forgot_backToSignIn')}</Text>
      </Link>
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
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 28,
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
  info: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 12,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  link: {
    marginTop: 24,
    alignSelf: 'center',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
