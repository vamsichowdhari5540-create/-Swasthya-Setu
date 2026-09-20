import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { USER_ROLES, type Facility, type UserRole } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';

const ROLE_LABEL_KEYS: Record<
  UserRole,
  'role_patient' | 'role_anm_asha' | 'role_doctor' | 'role_district_admin'
> = {
  patient: 'role_patient',
  anm_asha: 'role_anm_asha',
  doctor: 'role_doctor',
  district_admin: 'role_district_admin',
};

// Only these two roles act on behalf of a facility (registering patients,
// accepting referrals) — a patient or district admin account has no
// facility of its own, same rule the rest of the app already follows.
const NEEDS_FACILITY: UserRole[] = ['anm_asha', 'doctor'];

// District Admin is deliberately excluded from self-signup — it's a
// district-wide privileged role, and letting anyone grant it to themselves
// from a public form would be a privilege-escalation hole. The
// handle_new_user trigger enforces this server-side too (see schema.sql),
// so this is a UX filter, not the actual security boundary.
const SELF_SIGNUP_ROLES: UserRole[] = USER_ROLES.filter((role) => role !== 'district_admin');

export default function SignUpScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { signUp } = useAuth();
  const { t } = useLanguage();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // No session exists yet at signup time, so this hits the one
    // unauthenticated facilities route (apps/api/src/routes/facilities.ts)
    // rather than the normal cached/authenticated lookup used everywhere
    // else in the app.
    apiFetch<Facility[]>(null, '/api/facilities/public')
      .then(setFacilities)
      .catch(() => setFacilities([]));
  }, []);

  const needsFacility = NEEDS_FACILITY.includes(role);
  const canSave =
    fullName.trim().length > 0 &&
    /^\S+@\S+\.\S+$/.test(email.trim()) &&
    password.length >= 6 &&
    (!needsFacility || !!facilityId);

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);
    if (needsFacility && !facilityId) {
      setError(t('signup_facilityRequired'));
      return;
    }
    setSubmitting(true);
    const { error: signUpError, needsEmailConfirmation } = await signUp({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      role,
      facilityId: needsFacility ? facilityId! : undefined,
    });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    if (needsEmailConfirmation) {
      setInfo(t('signup_checkEmail'));
    } else {
      router.replace('/');
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('signup_title')}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{t('signup_subtitle')}</Text>

      <Text style={styles.label}>{t('signup_fullName')}</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        placeholderTextColor={colors.muted}
        value={fullName}
        onChangeText={setFullName}
      />

      <Text style={styles.label}>{t('login_email')}</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>{t('login_password')}</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.card }]}
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Text style={styles.label}>{t('signup_role')}</Text>
      <View style={styles.chipsRow} lightColor="transparent" darkColor="transparent">
        {SELF_SIGNUP_ROLES.map((option) => {
          const active = option === role;
          return (
            <Pressable
              key={option}
              onPress={() => {
                setRole(option);
                setFacilityId(null);
              }}
              style={[
                styles.chip,
                { borderColor: colors.border },
                active && { backgroundColor: colors.tint, borderColor: colors.tint },
              ]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(ROLE_LABEL_KEYS[option])}</Text>
            </Pressable>
          );
        })}
      </View>

      {needsFacility && (
        <>
          <Text style={styles.label}>{t('signup_facility')}</Text>
          <Text style={[styles.hint, { color: colors.muted }]}>{t('signup_facilityHint')}</Text>
          {facilities === null ? (
            <ActivityIndicator color={colors.tint} style={{ marginTop: 8 }} />
          ) : (
            facilities.map((facility) => {
              const active = facility.id === facilityId;
              return (
                <Pressable
                  key={facility.id}
                  onPress={() => setFacilityId(facility.id)}
                  style={[
                    styles.facilityCard,
                    { borderColor: active ? colors.tint : colors.border, backgroundColor: colors.card },
                  ]}>
                  <Text style={styles.facilityName}>{facility.name}</Text>
                  <Text style={[styles.facilityMeta, { color: colors.muted }]}>
                    {facility.district} · {facility.type}
                  </Text>
                </Pressable>
              );
            })
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {info && <Text style={[styles.info, { color: colors.tint }]}>{info}</Text>}

      <Pressable
        style={[styles.button, { backgroundColor: canSave ? colors.tint : colors.border }]}
        disabled={!canSave || submitting}
        onPress={handleSubmit}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('signup_submit')}</Text>}
      </Pressable>

      <Link href="/login" style={styles.link}>
        <Text style={[styles.linkText, { color: colors.tint }]}>{t('signup_alreadyHaveAccount')}</Text>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    marginTop: -4,
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
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  facilityCard: {
    borderWidth: 1,
    borderRadius: 14,
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
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    marginTop: 16,
  },
  info: {
    fontSize: 13,
    marginTop: 16,
    fontWeight: '600',
  },
  button: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
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
