import { StyleSheet } from 'react-native';
import type { ReferralStatus } from '@swasthya-setu/shared-types';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const STATUS_COLORS: Record<ReferralStatus, string> = {
  pending: '#b7791f',
  accepted: '#2b6cb0',
  completed: '#0f8a6f',
  cancelled: '#c0392b',
};

export function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const color = STATUS_COLORS[status];
  return (
    <View
      style={[styles.badge, { backgroundColor: colors.background, borderColor: color }]}
      lightColor={colors.background}
      darkColor={colors.background}>
      <Text style={[styles.text, { color }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
