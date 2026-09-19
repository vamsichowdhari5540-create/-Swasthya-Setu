import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useSync } from '@/context/SyncContext';
import type { EncounterPayload, ReferralPayload } from '@/context/SyncContext';
import type { OutboxRow, OutboxStatus } from '@/lib/outbox';
import { useLanguage } from '@/lib/i18n';

const STATUS_LABEL: Record<OutboxStatus, string> = {
  pending: 'Waiting to sync',
  syncing: 'Syncing…',
  synced: 'Synced',
  failed: 'Failed',
};

const STATUS_COLOR: Record<OutboxStatus, string> = {
  pending: '#b7791f',
  syncing: '#2b6cb0',
  synced: '#0f8a6f',
  failed: '#c0392b',
};

function describe(item: OutboxRow): { title: string; subtitle: string } {
  const payload = JSON.parse(item.payload) as EncounterPayload | ReferralPayload;
  if (item.type === 'encounter') {
    const p = payload as EncounterPayload;
    return { title: `Visit — ${p.patientName}`, subtitle: p.notes };
  }
  const p = payload as ReferralPayload;
  return { title: `Referral — ${p.patientName}`, subtitle: `To ${p.receivingFacilityName}: ${p.reason}` };
}

export default function SyncStatusScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { items, flush, retry } = useSync();
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setIsOnline(!!state.isConnected));
    return unsubscribe;
  }, []);

  const handleSyncNow = async () => {
    setFlushing(true);
    try {
      await flush();
    } finally {
      setFlushing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.banner, { backgroundColor: isOnline === false ? '#fdecea' : colors.card, borderColor: colors.border }]}
        lightColor={isOnline === false ? '#fdecea' : colors.card}
        darkColor={isOnline === false ? '#3a2323' : colors.card}>
        <Text style={[styles.bannerText, { color: isOnline === false ? '#c0392b' : colors.muted }]}>
          {isOnline === false
            ? 'You are offline — visits and referrals are saved on this device and will sync automatically once you reconnect.'
            : 'Connected. New visits and referrals sync immediately.'}
        </Text>
        <Pressable style={[styles.syncButton, { borderColor: colors.tint }]} disabled={flushing} onPress={handleSyncNow}>
          {flushing ? <ActivityIndicator color={colors.tint} /> : <Text style={[styles.syncButtonText, { color: colors.tint }]}>Sync Now</Text>}
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>{t('sync_empty')}</Text>
        }
        renderItem={({ item }) => {
          const { title, subtitle } = describe(item);
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader} lightColor="transparent" darkColor="transparent">
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={[styles.status, { color: STATUS_COLOR[item.status] }]}>
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>
              <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={2}>
                {subtitle}
              </Text>
              {item.error && <Text style={styles.error}>{item.error}</Text>}
              {item.status === 'failed' && (
                <Pressable style={[styles.retryButton, { borderColor: colors.tint }]} onPress={() => retry(item.id)}>
                  <Text style={[styles.retryButtonText, { color: colors.tint }]}>{t('sync_retry')}</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    borderBottomWidth: 1,
    padding: 16,
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  syncButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  syncButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  status: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  error: {
    color: '#c0392b',
    fontSize: 12,
    marginTop: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 10,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
