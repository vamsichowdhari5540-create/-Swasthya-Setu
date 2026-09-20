import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser, UserRole } from '@swasthya-setu/shared-types';

import { supabase } from '@/lib/supabase';
import { disconnectSocket } from '@/lib/socket';

export interface SignUpDetails {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  facilityId?: string;
}

interface AuthContextValue {
  session: Session | null;
  profile: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  // Returns needsEmailConfirmation: true when Supabase requires clicking a
  // confirmation link before a session exists — the caller can't tell in
  // advance which the project is configured for, since that's an
  // Authentication setting, not something the client controls.
  signUp: (details: SignUpDetails) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;
    setLoading(true);

    // Role resolution: the RLS policy `profiles_select_own` is what makes
    // this safe to query directly from the mobile app.
    supabase
      .from('profiles')
      .select('id, email, full_name, role, facility_id')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setProfile(null);
        } else {
          setProfile({
            id: data.id,
            email: data.email,
            fullName: data.full_name,
            role: data.role,
            facilityId: data.facility_id,
          });
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signUp: async ({ fullName, email, password, role, facilityId }) => {
        // full_name/role/facility_id land in raw_user_meta_data, which the
        // handle_new_user trigger (supabase/schema.sql) reads to create the
        // matching profiles row in the same transaction as auth.users —
        // there's no window between "account exists" and "role assigned".
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role, facility_id: facilityId },
            // Where the confirmation link (not the password-reset one)
            // lands after clicking it. Without this it uses the Supabase
            // project's default Site URL, which points nowhere useful for
            // this app.
            emailRedirectTo: process.env.EXPO_PUBLIC_WEB_URL ?? 'https://swasthya-sethu.vercel.app',
          },
        });
        if (error) return { error: error.message, needsEmailConfirmation: false };
        return { error: null, needsEmailConfirmation: !data.session };
      },
      signOut: async () => {
        disconnectSocket();
        await supabase.auth.signOut();
      },
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
