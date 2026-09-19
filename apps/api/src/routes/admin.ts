import { Router } from 'express';

import { verifyAuth } from '../auth/verifyAuth';
import { requireRole } from '../auth/requireRole';

export const adminRouter = Router();

// Exists purely to prove RBAC is enforced server-side (Phase 1 exit test):
// any authenticated user can call this, but only district_admin gets a 200.
adminRouter.get('/admin/ping', verifyAuth, requireRole('district_admin'), (req, res) => {
  res.json({ message: `Welcome, district admin ${req.user!.fullName}.` });
});
