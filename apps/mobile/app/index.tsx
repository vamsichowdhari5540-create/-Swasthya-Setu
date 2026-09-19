import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { UserRole } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { LANGUAGES, useLanguage } from '@/lib/i18n';

const ROLE_LABEL_KEYS: Record<UserRole, 'role_patient' | 'role_anm_asha' | 'role_doctor' | 'role_district_admin'> = {
  patient: 'role_patient',
  anm_asha: 'role_anm_asha',
  doctor: 'role_doctor',
  district_admin: 'role_district_admin',
};

// `href` present = a real screen. No `href` = still a placeholder for a
// later phase, shown so navigation visibly differs by role even before
// every screen behind it exists.
type NavItem = {
  label: Parameters<ReturnType<typeof useLanguage>['t']>[0];
  href?:
    | '/my-health-id'
    | '/my-timeline'
    | '/my-consents'
    | '/my-audit'
    | '/referrals/mine'
    | '/referrals/incoming'
    | '/referrals/outgoing'
    | '/patients/register'
    | '/patients/search'
    | '/patients/scan'
    | '/sync-status'
    | '/dashboard';
};

const ROLE_NAV: Record<UserRole, NavItem[]> = {
  patient: [
    { label: 'nav_myHealthId', href: '/my-health-id' },
    { label: 'nav_myTimeline', href: '/my-timeline' },
    { label: 'nav_myConsents', href: '/my-consents' },
    { label: 'nav_myReferrals', href: '/referrals/mine' },
  ],
  anm_asha: [
    { label: 'nav_registerPatient', href: '/patients/register' },
    { label: 'nav_searchPatients', href: '/patients/search' },
    { label: 'nav_scanQr', href: '/patients/scan' },
    { label: 'nav_sentReferrals', href: '/referrals/outgoing' },
    { label: 'nav_syncStatus', href: '/sync-status' },
  ],
  doctor: [
    { label: 'nav_searchPatients', href: '/patients/search' },
    { label: 'nav_scanQr', href: '/patients/scan' },
    { label: 'nav_incomingReferrals', href: '/referrals/incoming' },
    { label: 'nav_sentReferrals', href: '/referrals/outgoing' },
    { label: 'nav_syncStatus', href: '/sync-status' },
  ],
  district_admin: [{ label: 'nav_dashboard', href: '/dashboard' }],
};

function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { pendingCount } = useSync();
  const { language, setLanguage, t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace('/login');
  };

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
      <View style={styles.headerRow} lightColor="transparent" darkColor="transparent">
        <View style={styles.headerText} lightColor="transparent" darkColor="transparent">
          <Text style={styles.title}>{t('welcome')}</Text>
          <Text style={[styles.subtitle, { color: colors.tint }]}>{profile.fullName}</Text>
          <Text style={[styles.roleLabel, { color: colors.muted }]}>{t(ROLE_LABEL_KEYS[profile.role])}</Text>
        </View>

        <View lightColor="transparent" darkColor="transparent">
          <Pressable
            onPress={() => setMenuOpen((open) => !open)}
            style={[styles.avatar, { backgroundColor: colors.tint }]}>
            <Text style={styles.avatarText}>{initialsOf(profile.fullName)}</Text>
          </Pressable>
          {menuOpen && (
            <View style={[styles.avatarMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Pressable style={styles.avatarMenuItem} onPress={handleSignOut}>
                <Text style={{ color: '#c0392b', fontWeight: '700', fontSize: 13 }}>{t('signOut')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      <View style={styles.langRow} lightColor="transparent" darkColor="transparent">
        {LANGUAGES.map((lang) => (
          <Pressable
            key={lang.code}
            onPress={() => setLanguage(lang.code)}
            style={[
              styles.langChip,
              {
                borderColor: colors.border,
                backgroundColor: language === lang.code ? colors.tint : 'transparent',
              },
            ]}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: language === lang.code ? '#fff' : colors.muted }}>
              {lang.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {pendingCount > 0 && (
        <Link href="/sync-status" asChild>
          <Pressable style={StyleSheet.flatten([styles.syncBanner, { borderColor: '#b7791f' }])}>
            <Text style={styles.syncBannerText}>
              {pendingCount} item{pendingCount === 1 ? '' : 's'} waiting to sync →
            </Text>
          </Pressable>
        </Link>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.cardLabel}>{t('yourNavigation')}</Text>
        {ROLE_NAV[profile.role].map((item) =>
          item.href ? (
            <Link key={item.label} href={item.href} asChild>
              <Pressable>
                <Text style={[styles.navItem, styles.navItemLink, { color: colors.tint }]}>
                  •  {t(item.label)}
                </Text>
              </Pressable>
            </Link>
          ) : (
            <Text key={item.label} style={[styles.navItem, { color: colors.muted }]}>
              •  {t(item.label)}
            </Text>
          )
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 24,
    paddingBottom: 48,
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  langChip: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    fontSize: 13,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerText: {
    flexShrink: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  avatarMenu: {
    position: 'absolute',
    top: 56,
    right: 0,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 120,
    zIndex: 10,
    elevation: 4,
  },
  avatarMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  syncBanner: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  syncBannerText: {
    color: '#b7791f',
    fontWeight: '700',
    fontSize: 13,
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
});
