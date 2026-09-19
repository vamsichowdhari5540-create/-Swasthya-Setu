import type { NextFunction, Request, Response } from 'express';
import type { AiSummary } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { getSummaryById } from './repository';
import { getPatientById } from '../patients/repository';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      summary?: AiSummary;
    }
  }
}

// Loads the summary and, via its patient_id, the same `req.patient` that
// requirePatientAccess (apps/api/src/patients/middleware.ts) expects — so a
// summary is gated by exactly the same facility/consent rule as the
// patient record it was drafted from, never a separate rule of its own.
export async function loadSummary(req: Request, res: Response, next: NextFunction) {
  const supabase = getSupabase()!;
  const summary = await getSummaryById(supabase, req.params.id);
  if (!summary) {
    res.status(404).json({ error: 'Summary not found.' });
    return;
  }
  const patient = await getPatientById(supabase, summary.patientId);
  if (!patient) {
    res.status(404).json({ error: 'Patient not found.' });
    return;
  }
  req.summary = summary;
  req.patient = patient;
  next();
}
