import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4',
  // Todas las fechas se guardan y leen en UTC.
  timezone: 'Z',
  dateStrings: false,
});

// La sesión de MySQL trabaja en UTC para que CURRENT_TIMESTAMP y
// UTC_TIMESTAMP() coincidan, sea cual sea la zona horaria del servidor.
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

/** Ejecuta una consulta y devuelve solo las filas. */
export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Ejecuta `fn` dentro de una transacción con una conexión dedicada. */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
