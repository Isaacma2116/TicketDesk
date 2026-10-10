/** Error de aplicación con código HTTP y código legible por el frontend. */
export class AppError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(400, message, { code: 'BAD_REQUEST', details });
  }

  static unauthorized(message = 'Debes iniciar sesión para continuar', code = 'UNAUTHENTICATED') {
    return new AppError(401, message, { code });
  }

  static forbidden(message = 'No tienes permisos para realizar esta acción') {
    return new AppError(403, message, { code: 'FORBIDDEN' });
  }

  static notFound(message = 'Recurso no encontrado') {
    return new AppError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message, code = 'CONFLICT') {
    return new AppError(409, message, { code });
  }
}
