import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useLanguage } from '@/lib/i18n';

export default function ScanPatientQrScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View style={[styles.center, { backgroundColor: colors.background }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={{ textAlign: 'center', marginBottom: 16 }}>{t('scan_permission')}</Text>
        <Pressable style={[styles.button, { backgroundColor: colors.tint }]} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t('scan_grant')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          scanned
            ? undefined
            : ({ data }) => {
                setScanned(true);
                // The QR encodes only the opaque health_id — see
                // apps/api/src/patients/generateHealthId.ts. Resolving it to
                // an actual record (and enforcing who's allowed to see it)
                // happens entirely server-side.
                router.replace(`/patients/${data.trim()}`);
              }
        }
      />
      <View style={styles.hint} lightColor="rgba(0,0,0,0.55)" darkColor="rgba(0,0,0,0.55)">
        <Text style={styles.hintText}>{t('scan_title')}</Text>
      </View>
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
  hint: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  hintText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
