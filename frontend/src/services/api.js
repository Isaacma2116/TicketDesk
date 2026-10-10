/**
 * Cliente HTTP del frontend.
 * - Envía siempre la cookie de sesión (credentials: 'include').
 * - Nunca maneja tokens: la sesión vive en una cookie HttpOnly inaccesible desde JS.
 * - Normaliza los errores del API en ApiError.
 * - Notifica a la app cuando la sesión expira (evento `auth:expired`).
 */
const BASE_URL = '/api';

export class ApiError extends Error {
  constructor(status, { code, message, details } = {}) {
    super(message || 'Ocurrió un error inesperado');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details || {};
  }
}

export const authEvents = new EventTarget();

function buildUrl(path, params) {
  const url = `${BASE_URL}${path}`;
  if (!params) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request(method, path, { body, params, signal } = {}) {
  const isForm = body instanceof FormData;
  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      credentials: 'include',
      // FormData (subida de archivos): el navegador fija el Content-Type multipart.
      headers: body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
    });
  }

  if (response.status === 204) return null;

  let data = null;
  const isJson = response.headers.get('content-type')?.includes('application/json');
  if (isJson) data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new ApiError(response.status, data?.error || { message: `Error ${response.status}` });
    // Sesión caducada en una petición que no es el propio login/me.
    if (response.status === 401 && !path.startsWith('/auth/')) {
      authEvents.dispatchEvent(new CustomEvent('expired', { detail: error }));
    }
    if (error.code === 'PASSWORD_CHANGE_REQUIRED') {
      authEvents.dispatchEvent(new CustomEvent('password-change-required'));
    }
    throw error;
  }
  return data;
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  delete: (path, options) => request('DELETE', path, options),
};
