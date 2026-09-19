import type { NextFunction, Request, Response } from 'express';
import type { Patient } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { getPatientById } from './repository';
import { canAccessPatient } from './access';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      patient?: Patient;
    }
  }
}

export async function loadPatient(req: Request, res: Response, next: NextFunction) {
  const supabase = getSupabase()!;
  const patient = await getPatientById(supabase, req.params.patientId);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }
  req.patient = patient;
  next();
}

// Must run after verifyAuth and loadPatient. A patient may only reach their
// own linked record; every other role goes through the same facility/consent
// check used by the QR lookup — one rule, enforced once.
export async function requirePatientAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.user!;
  const patient = req.patient!;

  if (user.role === 'patient') {
    if (patient.userId !== user.id) {
      res.status(403).json({ error: 'You can only access your own record.' });
      return;
    }
    next();
    return;
  }

  const supabase = getSupabase()!;
  const allowed = await canAccessPatient(supabase, user, patient);
  if (!allowed) {
    res.status(403).json({
      error: "Your facility doesn't have access to this patient's record.",
      needsConsent: true,
    });
    return;
  }
  next();
}
