/**
 * Migrador SQL mínimo: crea la base de datos si no existe y aplica, en orden,
 * los archivos de database/migrations que aún no estén registrados en
 * `schema_migrations`. Cada archivo se aplica una sola vez.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function migrate({ log = console.log } = {}) {
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await conn.query(`USE \`${env.db.name}\``);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name        VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const [appliedRows] = await conn.query('SELECT name FROM schema_migrations');
    const applied = new Set(appliedRows.map((r) => r.name));
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      log(`→ Aplicando migración ${file}`);
      // MySQL hace commit implícito en DDL, por eso cada archivo debe ser idempotente
      // o pequeño; si falla, se detiene y no se registra.
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      count += 1;
    }
    log(count ? `✔ ${count} migración(es) aplicada(s) en ${env.db.name}` : `✔ ${env.db.name} ya está al día`);
  } finally {
    await conn.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().catch((err) => {
    console.error('✖ Error en la migración:', err.message);
    process.exit(1);
  });
}
