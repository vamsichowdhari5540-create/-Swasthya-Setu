import { useEffect, useState } from 'react';

import { supabase } from './lib/supabase';

type Stage = 'checking' | 'ready' | 'invalid' | 'done';

export function ResetPassword() {
  // Unlike the mobile app, this client is left at its Supabase default
  // (detectSessionInUrl: true — see lib/supabase.ts), so by the time this
  // component mounts the code in the URL may already be exchanged for a
  // session. Calling exchangeCodeForSession again here would consume a
  // code Supabase already used and fail every time, so this just waits
  // for whatever session that auto-exchange produces instead of doing the
  // exchange itself.
  const [stage, setStage] = useState<Stage>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let settled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !settled) {
        settled = true;
        setStage('ready');
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && !settled) {
        settled = true;
        setStage('ready');
      }
    });

    // The auto-exchange is a network round trip; give it a few seconds
    // before concluding the link itself is bad rather than just slow.
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setStage('invalid');
      }
    }, 5000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await supabase.auth.signOut();
    setStage('done');
  };

  if (stage === 'checking') {
    return (
      <div className="login-page">
        <div className="login-card">
          <p className="muted">Checking your reset link…</p>
        </div>
      </div>
    );
  }

  if (stage === 'invalid') {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>SwasthyaSetu</h1>
          <p className="muted">This reset link is invalid or has expired. Request a new one from the sign-in page.</p>
        </div>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>SwasthyaSetu</h1>
          <p className="muted">Password updated. Reload this page and sign in with your new password.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>SwasthyaSetu</h1>
        <p className="muted">Set a new password</p>
        <input
          type="password"
          placeholder="New password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting || password.length < 6}>
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
