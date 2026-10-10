import { AppError } from '../utils/AppError.js';

/**
 * Valida y normaliza `req[source]` con un esquema zod. El resultado se guarda
 * en `req.validated[source]` (en Express 5 `req.query` es de solo lectura).
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const details = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        if (!details[key]) {
          details[key] = issue.code === 'unrecognized_keys' ? `Campos no permitidos: ${issue.keys.join(', ')}` : issue.message;
        }
      }
      return next(new AppError(400, 'Revisa los datos enviados', { code: 'VALIDATION_ERROR', details }));
    }
    req.validated = { ...req.validated, [source]: result.data };
    next();
  };
}
