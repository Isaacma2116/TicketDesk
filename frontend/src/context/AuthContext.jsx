import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authEvents } from '../services/api';
import { authService } from '../services/authService';

export const AuthContext = createContext(null);

/**
 * Estado de autenticación de la aplicación.
 * status: 'loading' (comprobando la cookie) | 'authenticated' | 'anonymous'
 *
 * Al recargar la página se llama a GET /auth/me: si la cookie HttpOnly sigue
 * siendo válida, la sesión se restaura sin guardar nada en localStorage.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, permissions: [], company: null, expired: false });

  const setSession = useCallback((data) => {
    setState({
      status: 'authenticated',
      user: data.user,
      permissions: data.permissions,
      company: data.company ?? null,
      expired: false,
    });
  }, []);

  // loggedOut: cierre de sesión voluntario (no se recuerda la página de origen).
  const clearSession = useCallback((expired = false, loggedOut = false) => {
    setState({ status: 'anonymous', user: null, permissions: [], company: null, expired, loggedOut });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    authService
      .me({ signal: controller.signal })
      .then(setSession)
      .catch((err) => {
        if (err.name !== 'AbortError') clearSession(false);
      });
    return () => controller.abort();
  }, [setSession, clearSession]);

  useEffect(() => {
    const onExpired = () => clearSession(true);
    const onPasswordChangeRequired = () =>
      setState((s) => (s.user ? { ...s, user: { ...s.user, mustChangePassword: true } } : s));
    authEvents.addEventListener('expired', onExpired);
    authEvents.addEventListener('password-change-required', onPasswordChangeRequired);
    return () => {
      authEvents.removeEventListener('expired', onExpired);
      authEvents.removeEventListener('password-change-required', onPasswordChangeRequired);
    };
  }, [clearSession]);

  const login = useCallback(
    async (credentials) => {
      const data = await authService.login(credentials);
      setSession(data);
      return data;
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearSession(false, true);
    }
  }, [clearSession]);

  const changePassword = useCallback(
    async (payload) => {
      const data = await authService.changePassword(payload);
      setSession(data);
      return data;
    },
    [setSession],
  );

  /** Recarga el perfil (p. ej. tras cambiar la empresa o el propio departamento). */
  const refreshProfile = useCallback(async () => {
    const data = await authService.me();
    setSession(data);
    return data;
  }, [setSession]);

  const hasAnyPermission = useCallback(
    (...candidates) => candidates.some((p) => state.permissions.includes(p)),
    [state.permissions],
  );

  const hasPermission = useCallback(
    (...required) => required.every((p) => state.permissions.includes(p)),
    [state.permissions],
  );

  const value = useMemo(
    () => ({ ...state, isAuthenticated: state.status === 'authenticated', login, logout, changePassword, hasPermission, hasAnyPermission, refreshProfile }),
    [state, login, logout, changePassword, hasPermission, hasAnyPermission, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
