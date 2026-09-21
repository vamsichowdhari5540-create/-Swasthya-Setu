import { ScrollView, StyleSheet } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function ConsentScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.scroll}>
      <Text style={styles.heading}>What Swasthyasetu accesses</Text>

      <Text style={[styles.paragraph, { color: colors.muted }]}>
        Swasthyasetu keeps one shared health record per patient so an ANM/ASHA worker, a doctor
        and the patient themselves are always looking at the same continuity-of-care history —
        instead of the patient re-explaining it at every visit.
      </Text>

      <Text style={styles.subheading}>Who can see what</Text>
      <Text style={[styles.paragraph, { color: colors.muted }]}>
        Field workers and doctors only see the minimum record needed for the visit they're
        recording, and only for patients they have an active reason to access. Every access to a
        patient's record is written to an audit log the patient (and district admin) can review.
      </Text>

      <Text style={styles.subheading}>Consent</Text>
      <Text style={[styles.paragraph, { color: colors.muted }]}>
        Sharing your record with a specific facility is something you grant, and can revoke at
        any time. Revoking consent immediately removes that facility's access.
      </Text>

      <Text style={styles.subheading}>This prototype</Text>
      <Text style={[styles.paragraph, { color: colors.muted }]}>
        This build uses synthetic demo data only, for a hackathon prototype (SIH 2026). No real
        patient information is stored here.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 24,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 6,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 21,
  },
});
