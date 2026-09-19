import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@swasthya-setu/shared-types';

// Must run after verifyAuth. Kept as its own middleware (rather than a flag
// on verifyAuth) so a route can require authentication without requiring a
// specific role, and so the two checks stay independently testable.
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Missing bearer token.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: `Role '${req.user.role}' cannot access this resource.` });
      return;
    }
    next();
  };
}
