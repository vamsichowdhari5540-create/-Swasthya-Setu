import { useState } from 'react';

export function Login({
  onSignIn,
  onForgotPassword,
}: {
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onForgotPassword: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await onSignIn(email, password);
    setSubmitting(false);
    if (err) setError(err);
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>SwasthyaSetu</h1>
        <p className="muted">District Admin Console</p>
        <input
          type="email"
          placeholder="Email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting || !email || !password}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
        <button type="button" className="ghost" onClick={onForgotPassword}>
          Forgot password?
        </button>
        <p className="muted small">
          No account yet? District Admin accounts are provisioned directly by the system operator, not through
          self-signup — contact them for access.
        </p>
      </form>
    </div>
  );
}
