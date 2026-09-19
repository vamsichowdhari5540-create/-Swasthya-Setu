import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { UserRole } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const ROLE_LABELS: Record<UserRole, string> = {
  patient: 'Patient',
  anm_asha: 'ANM / ASHA Field Worker',
  doctor: 'Doctor',
  district_admin: 'District Admin',
};

// `href` present = a real Phase 2 screen. No `href` = still a placeholder
// for a later phase, shown so navigation visibly differs by role from
// Phase 1 onward even before every screen behind it exists.
type NavItem = { label: string; href?: '/my-health-id' | '/patients/register' | '/patients/search' | '/patients/scan' };

const ROLE_NAV: Record<UserRole, NavItem[]> = {
  patient: [
    { label: 'My Health ID (QR)', href: '/my-health-id' },
    { label: 'My Health Timeline (Phase 3)' },
    { label: 'My Referrals (Phase 4)' },
  ],
  anm_asha: [
    { label: 'Register Patient', href: '/patients/register' },
    { label: 'Search Patients', href: '/patients/search' },
    { label: 'Scan Patient QR', href: '/patients/scan' },
    { label: 'Field Visits (Phase 5)' },
    { label: 'Create Referral (Phase 4)' },
  ],
  doctor: [
    { label: 'Search Patients', href: '/patients/search' },
    { label: 'Scan Patient QR', href: '/patients/scan' },
    { label: 'Incoming Referrals (Phase 4)' },
    { label: 'Teleconsultation (Phase 6)' },
  ],
  district_admin: [{ label: 'District Dashboard (Phase 9)' }, { label: 'Facility Load (Phase 9)' }],
};

type PingState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'done'; status: number; body: string };

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { session, profile, signOut } = useAuth();
  const [meState, setMeState] = useState<PingState>({ kind: 'idle' });
  const [adminState, setAdminState] = useState<PingState>({ kind: 'idle' });

  const callApi = useCallback(
    async (path: string, setState: (s: PingState) => void) => {
      if (!session) return;
      setState({ kind: 'loading' });
      const response = await fetch(`${API_URL}${path}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.text();
      setState({ kind: 'done', status: response.status, body });
    },
    [session]
  );

  useEffect(() => {
    callApi('/api/auth/me', setMeState);
  }, [callApi]);

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
        <Text style={[styles.muted, { color: colors.muted, marginTop: 12 }]}>
          Loading your profile...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>Welcome, {profile.fullName}</Text>
      <Text style={[styles.subtitle, { color: colors.tint }]}>{ROLE_LABELS[profile.role]}</Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>Your navigation</Text>
        {ROLE_NAV[profile.role].map((item) =>
          item.href ? (
            <Link key={item.label} href={item.href} asChild>
              <Pressable>
                <Text style={[styles.navItem, styles.navItemLink, { color: colors.tint }]}>
                  •  {item.label}
                </Text>
              </Pressable>
            </Link>
          ) : (
            <Text key={item.label} style={[styles.navItem, { color: colors.muted }]}>
              •  {item.label}
            </Text>
          )
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>GET /api/auth/me</Text>
        {meState.kind === 'loading' && <ActivityIndicator color={colors.tint} />}
        {meState.kind === 'done' && (
          <Text style={[styles.mono, { color: colors.muted }]}>
            {meState.status} {meState.body}
          </Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>RBAC check — GET /api/admin/ping</Text>
        <Text style={[styles.rowText, { color: colors.muted }]}>
          Every role can press this button; only district_admin should get a 200.
        </Text>
        {adminState.kind === 'done' && (
          <Text
            style={[
              styles.mono,
              { color: adminState.status === 200 ? colors.tint : '#c0392b', marginBottom: 10 },
            ]}>
            {adminState.status} {adminState.body}
          </Text>
        )}
        <Pressable
          style={[styles.secondaryButton, { borderColor: colors.tint }]}
          onPress={() => callApi('/api/admin/ping', setAdminState)}>
          {adminState.kind === 'loading' ? (
            <ActivityIndicator color={colors.tint} />
          ) : (
            <Text style={[styles.secondaryButtonText, { color: colors.tint }]}>Call admin endpoint</Text>
          )}
        </Pressable>
      </View>

      <Pressable
        style={[styles.signOutButton, { borderColor: colors.border }]}
        onPress={async () => {
          await signOut();
          router.replace('/login');
        }}>
        <Text style={[styles.signOutText, { color: colors.muted }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 24,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    fontSize: 13,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 24,
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
    marginBottom: 10,
  },
  navItem: {
    fontSize: 14,
    marginBottom: 4,
  },
  navItemLink: {
    fontWeight: '600',
  },
  rowText: {
    fontSize: 13,
    marginBottom: 10,
  },
  mono: {
    fontSize: 12,
    fontFamily: 'SpaceMono',
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  signOutButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
