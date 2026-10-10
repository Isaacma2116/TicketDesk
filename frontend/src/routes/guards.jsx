import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks';
import { PageLoader } from '../components/ui';
import { ForbiddenPage } from '../pages/errors/ErrorPages';

export const FORCED_PASSWORD_ROUTE = '/cambiar-contrasena';
const PASSWORD_ROUTE = FORCED_PASSWORD_ROUTE;

/**
 * Rutas privadas: exige sesión. Si no la hay, redirige a /login recordando
 * la ruta de origen. Si el usuario tiene una contraseña temporal, lo envía
 * a cambiarla antes de permitir cualquier otra página.
 */
export function ProtectedRoute() {
  const { status, user, loggedOut } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader full label="Verificando sesión…" />;
  if (status !== 'authenticated') {
    // Tras un cierre de sesión voluntario no se guarda la ruta: el siguiente
    // usuario que inicie sesión en este navegador irá a su propio dashboard.
    return <Navigate to="/login" replace state={loggedOut ? null : { from: location }} />;
  }
  if (user.mustChangePassword && location.pathname !== PASSWORD_ROUTE) {
    return <Navigate to={PASSWORD_ROUTE} replace />;
  }
  return <Outlet />;
}

/** Rutas públicas (login): si ya hay sesión, va directo al dashboard. */
export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader full label="Cargando…" />;
  if (status === 'authenticated') {
    const to = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={to} replace />;
  }
  return <Outlet />;
}

/**
 * Exige permisos; si faltan, muestra "Acceso denegado".
 *  - permission: uno o varios, se exigen TODOS.
 *  - anyOf: basta con UNO de la lista.
 */
export function RequirePermission({ permission, anyOf, children }) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const required = permission ? (Array.isArray(permission) ? permission : [permission]) : [];
  const allowed = hasPermission(...required) && (!anyOf || hasAnyPermission(...anyOf));
  if (!allowed) return <ForbiddenPage />;
  return children ?? <Outlet />;
}
