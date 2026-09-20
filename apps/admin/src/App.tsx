import { useState } from 'react';

import { Dashboard } from './Dashboard';
import { ForgotPassword } from './ForgotPassword';
import { Login } from './Login';
import { ResetPassword } from './ResetPassword';
import { useAuth } from './lib/useAuth';

export default function App() {
  const { state, signIn, signOut } = useAuth();
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // This app has no client-side router, so the one other "route" it needs
  // to recognize is just a literal pathname check. vercel.json's SPA
  // rewrite already sends every path to this same index.html, so this is
  // reachable exactly the way any other route would be.
  if (window.location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  if (state.kind === 'loading') {
    return (
      <div className="login-page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (state.kind === 'signedOut') {
    if (showForgotPassword) {
      return <ForgotPassword onBack={() => setShowForgotPassword(false)} />;
    }
    return <Login onSignIn={signIn} onForgotPassword={() => setShowForgotPassword(true)} />;
  }

  // The role check happens here, not just server-side: every dashboard/
  // reset request is independently gated by requireRole('district_admin')
  // in apps/api/src/routes/dashboard.ts, so a non-admin who somehow lands
  // here still can't fetch or mutate anything — this is just so they see a
  // clear message instead of a screen full of failed requests.
  if (state.profile.role !== 'district_admin') {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>SwasthyaSetu</h1>
          <p className="muted">
            Signed in as {state.profile.fullName} ({state.profile.role}) — this console is for district admins only.
          </p>
          <button onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return <Dashboard session={state.session} profile={state.profile} onSignOut={signOut} />;
}
