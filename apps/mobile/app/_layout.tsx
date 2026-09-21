import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
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

const MAX_WEB_WIDTH = 480;

// This is a mobile app; on a desktop browser (the Vercel-hosted web build,
// or previewing locally) it would otherwise stretch full-width, which
// reads as a broken layout rather than an app. Native is untouched — this
// wrapper is a no-op there. Wraps the whole tree (including the loading
// spinner below) rather than just the Stack, so every state gets framed
// the same way.
function WebFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#dfe5e2' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: MAX_WEB_WIDTH, backgroundColor: '#fff' }}>{children}</View>
    </View>
  );
}

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
    <WebFrame>
      <LanguageProvider>
        <AuthProvider>
          <SyncProvider>
            <RootLayoutNav />
          </SyncProvider>
        </AuthProvider>
      </LanguageProvider>
    </WebFrame>
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
    // Reachable without a session, and kicked to /login if there isn't one.
    const signedOutOnly = segments[0] === 'login' || segments[0] === 'signup' || segments[0] === 'forgot-password';
    // Reachable either way, never redirected. reset-password is the reason
    // this category exists at all: exchangeCodeForSession there creates a
    // real (if narrowly-scoped, recovery-only) session, so treating it like
    // login/signup would bounce the user straight to "/" mid-reset, before
    // they ever see the new-password form.
    const alwaysAllowed = segments[0] === 'consent' || segments[0] === 'reset-password';

    if (!session && !signedOutOnly && !alwaysAllowed) {
      router.replace('/login');
    } else if (session && signedOutOnly) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  // reset-password deliberately keeps rendering through a loading flip:
  // exchangeCodeForSession succeeding is exactly what turns loading true
  // for a moment (AuthContext resolving the new recovery session's
  // profile), and unmounting the Stack here would reset that screen's own
  // state — re-running the exchange against a code Supabase already
  // consumed, which fails and shows "invalid link" for a link that wasn't.
  if (loading && segments[0] !== 'reset-password') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Swasthyasetu' }} />
        <Stack.Screen name="login" options={{ title: t('title_signIn'), headerShown: false }} />
        <Stack.Screen name="signup" options={{ title: t('title_signUp') }} />
        <Stack.Screen name="forgot-password" options={{ title: t('title_forgotPassword') }} />
        <Stack.Screen name="reset-password" options={{ title: t('title_forgotPassword'), headerShown: false }} />
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
