import { Dashboard } from './Dashboard';
import { Login } from './Login';
import { useAuth } from './lib/useAuth';

export default function App() {
  const { state, signIn, signOut } = useAuth();

  if (state.kind === 'loading') {
    return (
      <div className="login-page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (state.kind === 'signedOut') {
    return <Login onSignIn={signIn} />;
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
