import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Falta la variable de entorno obligatoria ${name}. Revisa backend/.env`);
  }
  return value;
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) throw new Error(`La variable ${name} debe ser un número entero`);
  return value;
}

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const sessionSecret = required('SESSION_SECRET');
if (sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET debe tener al menos 32 caracteres aleatorios');
}

const cookieSecure = bool('COOKIE_SECURE', isProduction);

export const env = Object.freeze({
  nodeEnv,
  isProduction,
  isTest,
  port: int('PORT', 4000),
  trustProxy: int('TRUST_PROXY', 0),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: int('DB_PORT', 3306),
    user: required('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    name: isTest ? process.env.DB_NAME_TEST || `${required('DB_NAME')}_test` : required('DB_NAME'),
    connectionLimit: int('DB_CONNECTION_LIMIT', 10),
  },

  session: {
    secret: sessionSecret,
    // El prefijo __Host- obliga al navegador a exigir Secure, Path=/ y sin Domain.
    cookieName: cookieSecure ? '__Host-tp_session' : 'tp_session',
    cookieSecure,
    // Duración de una sesión normal y de una sesión con "Recordarme".
    ttlHours: int('SESSION_TTL_HOURS', 8),
    rememberDays: int('SESSION_REMEMBER_DAYS', 30),
    // Cierre por inactividad (solo sesiones sin "Recordarme").
    idleMinutes: int('SESSION_IDLE_MINUTES', 120),
  },

  uploads: {
    // Fuera de cualquier carpeta pública: los archivos solo se sirven a través del API.
    dir: path.resolve(process.env.UPLOAD_DIR || path.join(BACKEND_ROOT, 'uploads', isTest ? 'test' : '')),
    logoMaxBytes: int('LOGO_MAX_BYTES', 2 * 1024 * 1024),
  },

  security: {
    bcryptRounds: int('BCRYPT_ROUNDS', 12),
    maxFailedLogins: int('MAX_FAILED_LOGINS', 5),
    lockMinutes: int('LOCK_MINUTES', 15),
    loginRateLimitPerIp: int('LOGIN_RATE_LIMIT_PER_IP', 20),
  },
});
