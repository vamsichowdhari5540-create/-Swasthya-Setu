import cors from 'cors';
import express from 'express';

import { env } from './env';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { patientsRouter } from './routes/patients';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', adminRouter);
app.use('/api', patientsRouter);

app.listen(env.port, () => {
  console.log(`swasthya-setu-api listening on http://localhost:${env.port}`);
});
