import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/database.js';
import { SessionModel } from './models/session.model.js';

async function start() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(`✖ No se pudo conectar a MySQL (${env.db.host}:${env.db.port}/${env.db.name}): ${err.message}`);
    console.error('  Revisa backend/.env y ejecuta "npm run db:setup".');
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`✔ API escuchando en http://localhost:${env.port}/api (${env.nodeEnv})`);
  });

  // Limpieza de sesiones antiguas cada hora.
  const cleanup = setInterval(() => SessionModel.purgeOld().catch(() => {}), 60 * 60 * 1000);
  cleanup.unref();

  const shutdown = () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
