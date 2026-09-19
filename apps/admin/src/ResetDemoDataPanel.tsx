import { useState } from 'react';

// Deliberately typed-confirmation, not a plain "are you sure?" button —
// this wipes every synthetic transactional row (encounters, referrals,
// consultations, summaries, consents, audit log, patients). Facilities and
// login accounts survive; everything created *through* the app doesn't. A
// misclick during a live demo would otherwise be unrecoverable.
export function ResetDemoDataPanel({
  confirmPhrase,
  onConfirm,
  message,
}: {
  confirmPhrase: string;
  onConfirm: () => Promise<void>;
  message: string | null;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    await onConfirm();
    setBusy(false);
    setTyped('');
  };

  return (
    <section className="panel danger">
      <h2>Reset demo data</h2>
      <p className="muted small">
        Clears every patient, visit, referral, consultation, AI summary, consent and audit entry — back to a clean
        slate for the next demo run. Facilities and login accounts are not touched. This cannot be undone.
      </p>
      <input
        placeholder={`Type "${confirmPhrase}" to enable`}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
      />
      <button className="danger-button" disabled={typed !== confirmPhrase || busy} onClick={handleClick}>
        {busy ? 'Resetting…' : 'Reset demo data'}
      </button>
      {message && <p className="muted small">{message}</p>}
    </section>
  );
}
