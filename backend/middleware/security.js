import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defensa CSRF complementaria a SameSite=Strict: rechaza peticiones que
 * modifican estado si provienen de un origen no permitido.
 */
export function verifyOrigin(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !env.corsOrigins.includes(origin)) {
    return next(AppError.forbidden('Origen de la petición no permitido'));
  }
  next();
}

function limiterHandler(message) {
  return (_req, _res, next) => next(new AppError(429, message, { code: 'RATE_LIMITED' }));
}

/** Límite global de intentos de login por IP. */
export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.security.loginRateLimitPerIp,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: limiterHandler('Demasiados intentos de inicio de sesión desde esta red. Intenta nuevamente en unos minutos.'),
});

/**
 * Límite por IP + correo: frena ataques sobre una cuenta concreta y responde
 * igual exista o no el correo (evita la enumeración de cuentas).
 */
export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.security.maxFailedLogins,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email ?? '').trim().toLowerCase()}`,
  handler: limiterHandler(`Demasiados intentos fallidos. Intenta nuevamente en ${env.security.lockMinutes} minutos.`),
});

/** Límite general del API. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: limiterHandler('Demasiadas peticiones. Espera un momento e inténtalo de nuevo.'),
});
