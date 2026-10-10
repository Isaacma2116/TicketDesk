import crypto from 'node:crypto';
import { env } from '../config/env.js';

/** Token de sesión opaco de 256 bits. */
export function generateSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hash del token que se guarda en BD. Se usa HMAC con SESSION_SECRET para que
 * una copia filtrada de la tabla de sesiones no permita suplantar sesiones.
 */
export function hashSessionToken(token) {
  return crypto.createHmac('sha256', env.session.secret).update(token).digest('hex');
}
