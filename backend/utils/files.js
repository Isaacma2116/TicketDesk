import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

/**
 * Tipos de imagen admitidos, identificados por su FIRMA BINARIA (magic bytes),
 * no por la extensión ni por el Content-Type que envía el navegador, que el
 * cliente puede falsificar. SVG queda excluido a propósito: puede contener
 * JavaScript (XSS).
 */
const IMAGE_SIGNATURES = [
  { mime: 'image/png', ext: 'png', test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
];

export function detectImageType(buffer) {
  return IMAGE_SIGNATURES.find((s) => s.test(buffer)) ?? null;
}

export const MIME_BY_EXT = Object.fromEntries(IMAGE_SIGNATURES.map((s) => [s.ext, s.mime]));

const LOGO_DIR = 'company-logos';

/** Guarda el logo con un nombre aleatorio y devuelve la ruta relativa que se almacena en BD. */
export async function saveCompanyLogo(companyId, buffer, ext) {
  const dir = path.join(env.uploads.dir, LOGO_DIR);
  await fs.mkdir(dir, { recursive: true });
  const name = `${companyId}-${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, name), buffer, { flag: 'wx' });
  return `${LOGO_DIR}/${name}`;
}

/**
 * Resuelve una ruta relativa guardada en BD a una ruta absoluta, garantizando
 * que no sale del directorio de subidas (defensa contra path traversal).
 */
export function resolveUploadPath(relativePath) {
  if (!relativePath) return null;
  const base = path.resolve(env.uploads.dir);
  const full = path.resolve(base, relativePath);
  if (!full.startsWith(base + path.sep)) return null;
  return full;
}

export async function deleteUpload(relativePath) {
  const full = resolveUploadPath(relativePath);
  if (!full) return;
  await fs.rm(full, { force: true });
}
