import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import type { Referral } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { useReferralUpdates } from '@/lib/socket';
import { ReferralStatusBadge } from '@/components/ReferralStatusBadge';
import { useLanguage } from '@/lib/i18n';

export default function IncomingReferralsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session } = useAuth();
  const { t } = useLanguage();
  const [referrals, setReferrals] = useState<Referral[] | null>(null);

  const load = useCallback(() => {
    apiFetch<Referral[]>(session, '/api/referrals?box=incoming').then(setReferrals);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  useReferralUpdates(session?.access_token, load);

  if (referrals === null) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={referrals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>
            {t('list_empty')}
          </Text>
        }
        renderItem={({ item }) => (
          <Link href={`/referrals/${item.id}`} asChild>
            <Pressable
              style={StyleSheet.flatten([styles.card, { backgroundColor: colors.card, borderColor: colors.border }])}>
              <ReferralStatusBadge status={item.status} />
              <Text style={styles.patientName}>{item.patientName}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>From {item.originatingFacilityName}</Text>
              <Text style={styles.reason} numberOfLines={2}>
                {item.reason}
              </Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 24,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  patientName: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 6,
  },
  reason: {
    fontSize: 13,
  },
});
