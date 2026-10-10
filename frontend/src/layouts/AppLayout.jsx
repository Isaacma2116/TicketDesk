import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { useAuth, useMediaQuery, useToast } from '../hooks';

const COLLAPSE_KEY = 'ui.sidebarCollapsed';

/** Layout de las páginas privadas: menú lateral + barra superior + contenido. */
export function AppLayout() {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMobile = useMediaQuery('(max-width: 1024px)');

  // Preferencia visual: se guarda en localStorage (no es información sensible).
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Cierra el cajón al cambiar de página (ajuste de estado durante el render).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.info('Sesión cerrada', 'Has cerrado sesión correctamente.');
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="app-shell" data-collapsed={collapsed && !isMobile} data-mobile-open={mobileOpen && isMobile}>
      <Sidebar
        collapsed={collapsed && !isMobile}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        onNavigate={() => setMobileOpen(false)}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
      <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      <div className="app-main">
        <Topbar onOpenMenu={() => setMobileOpen(true)} onLogout={handleLogout} />
        <main className="app-content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
