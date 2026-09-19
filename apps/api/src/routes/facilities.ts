import { Router } from 'express';
import type { Facility } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';
import { verifyAuth } from '../auth/verifyAuth';

export const facilitiesRouter = Router();

// Non-sensitive reference data (names/districts, no patient data) — any
// authenticated user can list facilities, e.g. to pick one when granting
// consent.
facilitiesRouter.get('/facilities', verifyAuth, async (_req, res) => {
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
});
