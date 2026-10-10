import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo de la petición no es JSON válido' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'La petición es demasiado grande' } });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'El registro ya existe' } });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Error inesperado: se registra completo en el servidor pero nunca se
  // envían detalles internos al cliente.
  if (!env.isTest) console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado. Inténtalo de nuevo.' } });
}
