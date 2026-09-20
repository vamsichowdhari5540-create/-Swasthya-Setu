import { Router, type Response } from 'express';
import type { Facility } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';

export const facilitiesRouter = Router();

async function listFacilities(_req: unknown, res: Response) {
  const supabase = getSupabase()!;
  const { data, error } = await supabase
    .from('facilities')
    .select('id, name, district, type')
    .order('name');

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json(data as Facility[]);
}

// Non-sensitive reference data (names/districts, no patient data) — any
// authenticated user can list facilities, e.g. to pick one when granting
// consent.
facilitiesRouter.get('/facilities', verifyAuth, listFacilities);

// Same data, deliberately reachable without a session: the signup form
// needs to show a facility picker before an ANM/ASHA or doctor account
// exists to authenticate as. Nothing here is more sensitive than what
// the authenticated route already returns to anyone with any account.
facilitiesRouter.get('/facilities/public', listFacilities);
