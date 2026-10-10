import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';
import { SessionModel } from '../models/session.model.js';
import { RoleModel } from '../models/role.model.js';
import { AppError } from '../utils/AppError.js';
import { fakeVerify, hashPassword, passwordPolicyErrors, verifyPassword } from '../utils/password.js';
import { generateSessionToken, hashSessionToken } from '../utils/tokens.js';
import { DepartmentModel } from '../models/department.model.js';
import { ROLES } from '../config/rbac.js';
import { toCompanySummary, toPublicUser } from '../utils/serializers.js';

const INVALID_CREDENTIALS = 'Correo o contraseña incorrectos';

function canUseInactiveCompany(companyStatus, roleCode) {
  return companyStatus === 'active' || roleCode === ROLES.SUPERADMIN;
}
const TOUCH_INTERVAL_MS = 60 * 1000;

function sessionExpiry(rememberMe) {
  const ms = rememberMe
    ? env.session.rememberDays * 24 * 60 * 60 * 1000
    : env.session.ttlHours * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}

export const AuthService = {
  async login({ email, password, rememberMe, ip, userAgent }) {
    const account = await UserModel.findForAuthByEmail(email);

    if (!account) {
      await fakeVerify();
      throw AppError.unauthorized(INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
    }

    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      // No se verifica la contraseña mientras la cuenta está bloqueada, para
      // que el bloqueo no pueda usarse como oráculo de contraseñas.
      const minutes = Math.ceil((new Date(account.locked_until) - Date.now()) / 60000);
      throw new AppError(
        429,
        `Demasiados intentos fallidos. Intenta nuevamente en ${minutes} minuto${minutes === 1 ? '' : 's'}.`,
        { code: 'ACCOUNT_LOCKED' },
      );
    }

    const valid = await verifyPassword(password, account.password_hash);
    if (!valid) {
      await UserModel.registerFailedLogin(account.id, env.security.maxFailedLogins, env.security.lockMinutes);
      throw AppError.unauthorized(INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
    }

    // El estado solo se revela tras una contraseña correcta.
    if (account.status !== 'active') {
      throw new AppError(403, 'Tu cuenta está desactivada. Contacta al administrador del sistema.', {
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // Con la empresa inactiva solo el superadministrador puede entrar (para reactivarla).
    if (!canUseInactiveCompany(account.company_status, account.role_code)) {
      throw new AppError(403, 'La empresa está desactivada. Contacta al administrador de la plataforma.', {
        code: 'COMPANY_INACTIVE',
      });
    }

    await UserModel.registerSuccessfulLogin(account.id);

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = sessionExpiry(rememberMe);
    await SessionModel.create({
      userId: account.id,
      tokenHash,
      rememberMe,
      ip,
      userAgent: userAgent?.slice(0, 255) ?? null,
      expiresAt,
    });

    const profile = await this.profileFor(await SessionModel.findActiveByTokenHash(tokenHash));
    return { token, expiresAt, rememberMe, ...profile };
  },

  /** Devuelve la sesión activa asociada al token de la cookie, o null. */
  async resolveSession(token) {
    if (!token || typeof token !== 'string' || token.length > 128) return null;
    const session = await SessionModel.findActiveByTokenHash(hashSessionToken(token));
    if (!session) return null;

    if (session.status !== 'active' || !canUseInactiveCompany(session.company_status, session.role_code)) {
      await SessionModel.revoke(session.session_id);
      return null;
    }

    const lastSeen = new Date(session.last_seen_at).getTime();
    if (!session.remember_me && Date.now() - lastSeen > env.session.idleMinutes * 60 * 1000) {
      await SessionModel.revoke(session.session_id);
      return null;
    }

    if (Date.now() - lastSeen > TOUCH_INTERVAL_MS) {
      await SessionModel.touch(session.session_id);
    }
    return session;
  },

  async logout(sessionId) {
    if (sessionId) await SessionModel.revoke(sessionId);
  },

  /** Perfil completo a partir de una fila de sesión (usuario + empresa + departamentos). */
  async profileFor(session) {
    const [permissions, departments] = await Promise.all([
      RoleModel.permissionCodes(session.role_id),
      DepartmentModel.forUser(session.company_id, session.id),
    ]);
    const user = toPublicUser(session);
    user.departments = departments.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      status: d.status,
      isPrimary: Boolean(d.is_primary),
      isAgent: Boolean(d.is_agent),
      isManager: Boolean(d.is_manager),
    }));
    return { user, permissions, company: toCompanySummary(session) };
  },

  async changePassword({ companyId, userId, sessionId, currentPassword, newPassword }) {
    const hash = await UserModel.findPasswordHash(userId);
    if (!hash || !(await verifyPassword(currentPassword, hash))) {
      throw AppError.badRequest('La contraseña actual no es correcta', {
        currentPassword: 'La contraseña actual no es correcta',
      });
    }
    const policy = passwordPolicyErrors(newPassword);
    if (policy.length) {
      throw AppError.badRequest('La nueva contraseña no cumple la política', {
        newPassword: `Debe contener ${policy.join(', ')}`,
      });
    }
    if (await verifyPassword(newPassword, hash)) {
      throw AppError.badRequest('La nueva contraseña debe ser distinta a la actual', {
        newPassword: 'Debe ser distinta a la contraseña actual',
      });
    }
    await UserModel.update(
      companyId,
      userId,
      { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
      userId,
    );
    // Cierra el resto de sesiones abiertas del usuario.
    await SessionModel.revokeAllForUser(userId, sessionId);
  },
};
