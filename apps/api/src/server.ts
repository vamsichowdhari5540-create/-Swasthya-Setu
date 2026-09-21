import http from 'node:http';

import { app } from './app';
import { env } from './env';
import { initRealtime } from './realtime/socket';

const server = http.createServer(app);
initRealtime(server);

server.listen(env.port, () => {
  console.log(`swasthya-setu-api listening on http://localhost:${env.port}`);
});
