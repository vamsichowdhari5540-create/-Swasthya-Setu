import { useEffect, useState } from 'react';
import type { Patient } from '@swasthya-setu/shared-types';

import { useAuth } from '@/context/AuthContext';
import { apiFetch, ApiError } from '@/lib/api';

export type OwnPatientState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; patient: Patient };

// Shared by every "patient views their own record" screen (timeline,
// consent management, audit log) since all three need the patient row's
// UUID, which the account itself doesn't otherwise know.
export function useOwnPatient(): OwnPatientState {
  const { session } = useAuth();
  const [state, setState] = useState<OwnPatientState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    apiFetch<Patient>(session, '/api/patients/me')
      .then((patient) => {
        if (!cancelled) setState({ kind: 'done', patient });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message:
            err instanceof ApiError && err.status === 404
              ? 'No patient record is linked to your account yet. Ask a field worker to register you.'
              : 'Could not load your record.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return state;
}
