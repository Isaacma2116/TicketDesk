import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

// bcrypt solo considera los primeros 72 bytes.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export function hashPassword(plain) {
  return bcrypt.hash(plain, env.security.bcryptRounds);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Hash ficticio para igualar el tiempo de respuesta cuando el correo no existe
// y evitar así la enumeración de usuarios por tiempo.
let dummyHash;
export async function fakeVerify() {
  dummyHash ??= await bcrypt.hash(crypto.randomBytes(16).toString('hex'), env.security.bcryptRounds);
  await bcrypt.compare('invalid-password', dummyHash);
  return false;
}

/** Devuelve la lista de reglas incumplidas (vacía si la contraseña es válida). */
export function passwordPolicyErrors(password) {
  const errors = [];
  if (password.length < PASSWORD_MIN_LENGTH) errors.push(`al menos ${PASSWORD_MIN_LENGTH} caracteres`);
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_LENGTH) errors.push(`como máximo ${PASSWORD_MAX_LENGTH} caracteres`);
  if (!/[a-z]/.test(password)) errors.push('una letra minúscula');
  if (!/[A-Z]/.test(password)) errors.push('una letra mayúscula');
  if (!/\d/.test(password)) errors.push('un número');
  return errors;
}

/** Genera una contraseña temporal que cumple la política. */
export function generateTemporaryPassword() {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%*-_';
  const all = lower + upper + digits + symbols;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < 14) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
