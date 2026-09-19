import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Authentication (is this a real Supabase session?) and authorization (does
// this role/facility get to do this?) are deliberately two separate checks,
// per the architecture doc's frozen principles — this middleware only does
// the former plus role *resolution*; requireRole() below does authorization.
export async function verifyAuth(req: Request, res: Response, next: NextFunction) {
  const supabase = getSupabase();
  if (!supabase) {
    res.status(503).json({ error: 'Backend is not connected to Supabase yet.' });
    return;
  }

  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token.' });
    return;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, facility_id')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    res.status(403).json({ error: 'No profile is associated with this account yet.' });
    return;
  }

  req.user = {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    fullName: profile.full_name,
    facilityId: profile.facility_id,
  };
  next();
}
