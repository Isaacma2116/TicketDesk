import { env } from '../config/env.js';
import { AuthService } from '../services/auth.service.js';
import { RoleModel } from '../models/role.model.js';
import { AppError } from '../utils/AppError.js';
import { toCompanySummary, toPublicUser } from '../utils/serializers.js';

/**
 * Exige una sesión válida. Adjunta a la petición:
 *   req.auth = { session, user, permissions, company, companyId, audit }
 * - Los permisos se leen de la BD en cada petición: un cambio de rol o la
 *   desactivación de un usuario tienen efecto inmediato.
 * - companyId proviene SIEMPRE de la sesión, nunca del cliente: es el
 *   contexto que acota todas las consultas (aislamiento multiempresa).
 */
export async function authenticate(req, _res, next) {
  const token = req.cookies?.[env.session.cookieName];
  const session = await AuthService.resolveSession(token);
  if (!session) return next(AppError.unauthorized('Tu sesión ha expirado. Inicia sesión de nuevo.', 'SESSION_EXPIRED'));

  const user = toPublicUser(session);
  req.auth = {
    session,
    user,
    permissions: await RoleModel.permissionCodes(session.role_id),
    company: toCompanySummary(session),
    companyId: session.company_id,
    // Contexto para la bitácora de auditoría.
    audit: {
      companyId: session.company_id,
      actorId: session.id,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
  };
  next();
}

/** Bloquea el acceso a la aplicación hasta que el usuario cambie su contraseña temporal. */
export function requirePasswordChanged(req, _res, next) {
  if (req.auth?.user.mustChangePassword) {
    return next(new AppError(403, 'Debes cambiar tu contraseña temporal antes de continuar', { code: 'PASSWORD_CHANGE_REQUIRED' }));
  }
  next();
}

/** Exige que el usuario autenticado tenga TODOS los permisos indicados. */
export function authorize(...required) {
  return (req, _res, next) => {
    const granted = req.auth?.permissions ?? [];
    if (!required.every((p) => granted.includes(p))) return next(AppError.forbidden());
    next();
  };
}

/** Exige que el usuario tenga AL MENOS UNO de los permisos indicados. */
export function authorizeAny(...candidates) {
  return (req, _res, next) => {
    const granted = req.auth?.permissions ?? [];
    if (!candidates.some((p) => granted.includes(p))) return next(AppError.forbidden());
    next();
  };
}
