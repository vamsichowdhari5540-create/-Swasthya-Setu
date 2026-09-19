import http from 'node:http';

import cors from 'cors';
import express from 'express';

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

app.use(cors());
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
