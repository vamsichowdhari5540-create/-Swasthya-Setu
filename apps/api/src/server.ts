import http from 'node:http';

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { env } from './env';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { patientsRouter } from './routes/patients';
import { encountersRouter } from './routes/encounters';
import { consentRouter } from './routes/consent';
import { auditRouter } from './routes/audit';
import { facilitiesRouter } from './routes/facilities';
import { referralsRouter } from './routes/referrals';
import { consultationsRouter } from './routes/consultations';
import { summariesRouter } from './routes/summaries';
import { dashboardRouter } from './routes/dashboard';
import { initRealtime } from './realtime/socket';

const app = express();

// Render sits in front of this app as a reverse proxy, so every request
// Express sees arrives from Render's IP, not the real client's — without
// this, express-rate-limit keys every request behind that one proxy IP
// into the same bucket (all judges, all demo devices, sharing one limit)
// and newer versions throw ERR_ERL_UNEXPECTED_X_FORWARDED_FOR outright once
// they notice X-Forwarded-For is present but untrusted. `1` trusts exactly
// one hop (Render's own proxy), not an arbitrary chain a client could spoof.
app.set('trust proxy', 1);

// Undefined origins list means unrestricted — see env.ts. Once the real
// frontend URLs are known this should always be set; until then this
// keeps today's behavior rather than locking out a deployment nobody's
// configured yet.
app.use(cors(env.corsOrigins ? { origin: env.corsOrigins } : {}));
app.use(helmet());
// Every client here is a phone on rural mobile data — the dashboard,
// referral lists and encounter timelines are JSON, which gzip shrinks
// dramatically, and the CPU cost of compressing them is negligible next
// to what a slow uplink already costs in wall-clock time.
app.use(compression());
// A generic ceiling against scripted abuse (the enumeration class of bug
// fixed in patients/search.ts, or simple credential-stuffing against
// /auth), not tuned to any endpoint's real traffic shape — a few staff
// behind one hospital's NAT should never come close to it.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json());
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', adminRouter);
app.use('/api', patientsRouter);
app.use('/api', encountersRouter);
app.use('/api', consentRouter);
app.use('/api', auditRouter);
app.use('/api', facilitiesRouter);
app.use('/api', referralsRouter);
app.use('/api', consultationsRouter);
app.use('/api', summariesRouter);
app.use('/api', dashboardRouter);

const server = http.createServer(app);
initRealtime(server);

server.listen(env.port, () => {
  console.log(`swasthya-setu-api listening on http://localhost:${env.port}`);
});
