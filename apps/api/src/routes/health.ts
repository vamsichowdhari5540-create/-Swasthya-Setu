import { Router } from 'express';
import type { HealthCheckResponse } from '@swasthya-setu/shared-types';

import { getSupabase } from '../supabaseClient';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const supabase = getSupabase();
  let database: HealthCheckResponse['database'] = 'not_configured';

  if (supabase) {
    const { error } = await supabase.from('facilities').select('id').limit(1);
    database = error ? 'unreachable' : 'connected';
  }

  const body: HealthCheckResponse = {
    status: database === 'unreachable' ? 'degraded' : 'ok',
    service: 'swasthya-setu-api',
    timestamp: new Date().toISOString(),
    database,
  };
  res.json(body);
});
