import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import type { ComponentProps } from 'react';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Replaces a bare line of muted text with an icon + message, consistently,
// wherever a list or timeline has nothing in it yet — "nothing here" reads
// as a broken screen the first time someone sees it; an icon signals "this
// is the expected empty state," not an error.
export function EmptyState({ icon, message }: { icon: IconName; message: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={styles.container} lightColor="transparent" darkColor="transparent">
      <View style={[styles.iconCircle, { backgroundColor: colors.border }]}>
        <Ionicons name={icon} size={22} color={colors.muted} />
      </View>
      <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
  },
});
