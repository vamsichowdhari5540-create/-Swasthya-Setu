import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SyncProvider } from '@/context/SyncContext';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import Colors from '@/constants/Colors';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <LanguageProvider>
      <AuthProvider>
        <SyncProvider>
          <RootLayoutNav />
        </SyncProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

// Protected routes: every screen except /login and /consent requires a
// session. This is a UI convenience only — the real enforcement is
// server-side (see apps/api/src/auth), since a mobile route guard can
// always be bypassed by calling the API directly.
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'consent';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'SwasthyaSetu' }} />
        <Stack.Screen name="login" options={{ title: t('title_signIn'), headerShown: false }} />
        <Stack.Screen name="consent" options={{ title: t('title_consent') }} />
        <Stack.Screen name="my-health-id" options={{ title: t('nav_myHealthId') }} />
        <Stack.Screen name="my-timeline" options={{ title: t('nav_myTimeline') }} />
        <Stack.Screen name="my-consents" options={{ title: t('nav_myConsents') }} />
        <Stack.Screen name="my-audit" options={{ title: t('title_myAudit') }} />
        <Stack.Screen name="patients/register" options={{ title: t('nav_registerPatient') }} />
        <Stack.Screen name="patients/search" options={{ title: t('nav_searchPatients') }} />
        <Stack.Screen name="patients/scan" options={{ title: t('title_scanQr') }} />
        <Stack.Screen name="patients/[healthId]" options={{ title: t('title_patient') }} />
        <Stack.Screen name="referrals/new" options={{ title: t('referral_submit') }} />
        <Stack.Screen name="referrals/incoming" options={{ title: t('list_incoming') }} />
        <Stack.Screen name="referrals/outgoing" options={{ title: t('list_outgoing') }} />
        <Stack.Screen name="referrals/mine" options={{ title: t('list_mine') }} />
        <Stack.Screen name="referrals/[id]" options={{ title: t('title_referral') }} />
        <Stack.Screen name="sync-status" options={{ title: t('nav_syncStatus') }} />
        <Stack.Screen name="consultations/[id]" options={{ title: t('title_consultation'), headerShown: false }} />
        <Stack.Screen name="summaries/[patientId]" options={{ title: t('title_aiSummary') }} />
        <Stack.Screen name="dashboard" options={{ title: t('nav_dashboard') }} />
      </Stack>
    </ThemeProvider>
  );
}
