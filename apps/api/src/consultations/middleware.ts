import type { NextFunction, Request, Response } from 'express';
import type { Consultation, Referral } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { getConsultationById } from './repository';
import { getReferralById } from '../referrals/repository';
import { canAccessReferral } from '../referrals/access';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      consultation?: Consultation;
      consultationReferral?: Referral;
    }
  }
}

// A consultation has no access rule of its own — it inherits whatever the
// parent referral's rule already decided, so there's exactly one place
// (referrals/access.ts) that answers "can this person see this patient
// interaction", not two rules that could quietly drift apart.
export async function loadConsultation(req: Request, res: Response, next: NextFunction) {
  const supabase = getSupabase()!;
  const result = await getConsultationById(supabase, req.params.id);
  if (!result) {
    res.status(404).json({ error: 'Consultation not found.' });
    return;
  }

  const referralResult = await getReferralById(supabase, result.row.referral_id);
  if (!referralResult) {
    res.status(404).json({ error: 'The referral for this consultation no longer exists.' });
    return;
  }

  const allowed = canAccessReferral(req.user!, referralResult.referral, referralResult.patientUserId);
  if (!allowed) {
    res.status(403).json({ error: "You don't have access to this consultation." });
    return;
  }

  req.consultation = result.consultation;
  req.consultationReferral = referralResult.referral;
  next();
}
