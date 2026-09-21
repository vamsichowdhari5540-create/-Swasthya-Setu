import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// The drop-in replacement for a bare centered ActivityIndicator: same
// "screen is loading" job, but every screen gets it consistently instead
// of each one re-centering its own spinner slightly differently.
export function LoadingScreen({ label }: { label?: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <LoadingSpinner size={40} />
      {label && <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    marginTop: 14,
  },
});
