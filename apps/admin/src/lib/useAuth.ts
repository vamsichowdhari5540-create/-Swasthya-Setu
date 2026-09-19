import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AuthUser } from '@swasthya-setu/shared-types';

import { supabase } from './supabase';
import { apiFetch } from './api';

export type AuthState =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'signedIn'; session: Session; profile: AuthUser };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function resolve(session: Session | null) {
      if (!session) {
        if (!cancelled) setState({ kind: 'signedOut' });
        return;
      }
      try {
        const profile = await apiFetch<AuthUser>(session, '/api/auth/me');
        if (!cancelled) setState({ kind: 'signedIn', session, profile });
      } catch {
        if (!cancelled) setState({ kind: 'signedOut' });
      }
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => resolve(session));

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signOut = () => supabase.auth.signOut();

  return { state, signIn, signOut };
}
