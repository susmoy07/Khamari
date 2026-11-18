import http from 'node:http';
import { env } from './config/env.js';
import { checkDbHealth } from './config/db.js';
import { ensureUserProfileColumns } from './db/migrateProfile.js';
import { createApp } from './app.js';
import { initializeSocketServer } from './events/socketServer.js';

const app = createApp();
const httpServer = http.createServer(app);
const io = initializeSocketServer(httpServer);

app.set('io', io);

async function startServer() {
  try {
    await checkDbHealth();
    await ensureUserProfileColumns();
    console.log(`[DB] Connected to MySQL (${env.db.host}:${env.db.port}/${env.db.database})`);
  } catch (err) {
    console.error('[DB] Initial connection warning:', err.message);
  }

  httpServer.listen(env.port, () => {
    console.log(`[Khamari] API & Socket.io server running on http://localhost:${env.port}`);
  });
}

startServer();
