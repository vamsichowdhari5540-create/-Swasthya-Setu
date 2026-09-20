import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/lib/i18n';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { signIn } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) setError(signInError);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={styles.title}>SwasthyaSetu</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{t('login_subtitle')}</Text>

      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        placeholder={t('login_email')}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        placeholder={t('login_password')}
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, { backgroundColor: colors.tint, opacity: submitting ? 0.7 : 1 }]}
        disabled={submitting || !email || !password}
        onPress={handleSignIn}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('login_signIn')}</Text>}
      </Pressable>

      <Link href="/forgot-password" style={styles.link}>
        <Text style={[styles.linkText, { color: colors.tint }]}>{t('login_forgotPassword')}</Text>
      </Link>

      <Link href="/signup" style={styles.link}>
        <Text style={[styles.linkText, { color: colors.tint }]}>{t('login_createAccount')}</Text>
      </Link>

      <Link href="/consent" style={styles.link}>
        <Text style={[styles.linkText, { color: colors.tint }]}>{t('login_dataAccess')}</Text>
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
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 32,
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
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  link: {
    marginTop: 20,
    alignSelf: 'center',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
