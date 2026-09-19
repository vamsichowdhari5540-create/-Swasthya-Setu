import type { NextFunction, Request, Response } from 'express';
import type { Referral } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { getReferralById } from './repository';
import { canAccessReferral } from './access';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      referral?: Referral;
      referralPatientUserId?: string | null;
    }
  }
}

export async function loadReferral(req: Request, res: Response, next: NextFunction) {
  const supabase = getSupabase()!;
  const result = await getReferralById(supabase, req.params.id);
  if (!result) {
    res.status(404).json({ error: 'Referral not found.' });
    return;
  }
  req.referral = result.referral;
  req.referralPatientUserId = result.patientUserId;
  next();
}

export function requireReferralAccess(req: Request, res: Response, next: NextFunction) {
  const allowed = canAccessReferral(req.user!, req.referral!, req.referralPatientUserId ?? null);
  if (!allowed) {
    res.status(403).json({ error: "You don't have access to this referral." });
    return;
  }
  next();
}
