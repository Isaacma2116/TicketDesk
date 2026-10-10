import { env } from '../config/env.js';
import { AuthService } from '../services/auth.service.js';
import { SessionModel } from '../models/session.model.js';
import { hashSessionToken } from '../utils/tokens.js';

function cookieOptions(rememberMe, expiresAt) {
  return {
    httpOnly: true,
    secure: env.session.cookieSecure,
    sameSite: 'strict',
    path: '/',
    // Sin "Recordarme" la cookie es de sesión: se borra al cerrar el navegador.
    ...(rememberMe ? { expires: expiresAt } : {}),
  };
}

export const AuthController = {
  async login(req, res) {
    const { email, password, rememberMe } = req.validated.body;
    const result = await AuthService.login({
      email,
      password,
      rememberMe,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    res.cookie(env.session.cookieName, result.token, cookieOptions(result.rememberMe, result.expiresAt));
    res.json({ user: result.user, permissions: result.permissions });
  },

  async logout(req, res) {
    const token = req.cookies?.[env.session.cookieName];
    const session = token ? await AuthService.resolveSession(token) : null;
    await AuthService.logout(session?.session_id);
    res.clearCookie(env.session.cookieName, { ...cookieOptions(false), expires: undefined });
    res.status(204).end();
  },

  async me(req, res) {
    res.json(await AuthService.profileFor(req.auth.session));
  },

  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.validated.body;
    await AuthService.changePassword({
      companyId: req.auth.companyId,
      userId: req.auth.user.id,
      sessionId: req.auth.session.session_id,
      currentPassword,
      newPassword,
    });
    const token = req.cookies[env.session.cookieName];
    const profile = await AuthService.profileFor(await SessionModel.findActiveByTokenHash(hashSessionToken(token)));
    res.json({ message: 'Contraseña actualizada correctamente', ...profile });
  },
};
