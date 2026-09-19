import { Router } from 'express';

import { verifyAuth } from '../auth/verifyAuth';

export const authRouter = Router();

// Role resolution endpoint: the mobile app calls this right after sign-in
// to find out which role/facility it's operating as.
authRouter.get('/auth/me', verifyAuth, (req, res) => {
  res.json(req.user);
});
