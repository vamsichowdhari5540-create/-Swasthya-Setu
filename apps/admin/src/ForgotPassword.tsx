import { useState } from 'react';

import { supabase } from './lib/supabase';

// Same reasoning as the mobile app's forgot-password screen: the redirect
// has to land back on this same origin, since this console has no native
// counterpart to hand off to.
const RESET_REDIRECT_URL = `${window.location.origin}/reset-password`;

export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    // Supabase never reveals whether the email exists, so the UI shows the
    // same "check your inbox" message regardless of the real outcome.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: RESET_REDIRECT_URL,
    });
    setSubmitting(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>SwasthyaSetu</h1>
        <p className="muted">Reset your password</p>
        {sent ? (
          <p className="muted small">If an account exists for that email, a reset link is on its way.</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
            <input
              type="email"
              placeholder="Email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={submitting || !email}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <button type="button" className="ghost" onClick={onBack}>
          Back to sign in
        </button>
      </div>
    </div>
  );
}
