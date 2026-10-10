import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronRight, KeyRound, LogOut, Menu, UserRound } from 'lucide-react';
import { ROUTE_TITLES } from '../../config/navigation';
import { useAuth } from '../../hooks';
import { formatLongDate } from '../../utils/format';
import { Avatar, IconButton } from '../ui';

function UserMenu({ onLogout }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar firstName={user.firstName} lastName={user.lastName} seed={user.email} size="sm" />
        <span className="user-menu__info">
          <span className="user-menu__name" style={{ display: 'block' }}>
            {user.fullName}
          </span>
          <span className="user-menu__role">{user.role.name}</span>
        </span>
        <ChevronDown className="user-menu__chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="dropdown" role="menu">
          <div className="dropdown__header">
            <Avatar firstName={user.firstName} lastName={user.lastName} seed={user.email} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{user.fullName}</p>
              <p className="dropdown__email">{user.email}</p>
            </div>
          </div>
          <Link to="/perfil" className="dropdown__item" role="menuitem" onClick={() => setOpen(false)}>
            <UserRound aria-hidden="true" /> Mi perfil
          </Link>
          <Link to="/cuenta/contrasena" className="dropdown__item" role="menuitem" onClick={() => setOpen(false)}>
            <KeyRound aria-hidden="true" /> Cambiar contraseña
          </Link>
          <button
            type="button"
            className="dropdown__item dropdown__item--danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut aria-hidden="true" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({ onOpenMenu, onLogout }) {
  const { pathname } = useLocation();
  const current = ROUTE_TITLES.find((r) => r.match.test(pathname));

  return (
    <header className="topbar">
      <IconButton className="topbar__menu-btn" size="md" icon={Menu} label="Abrir menú" onClick={onOpenMenu} />
      {current && (
        <div className="topbar__crumbs">
          <span>{current.section}</span>
          <ChevronRight aria-hidden="true" />
          <strong>{current.title}</strong>
        </div>
      )}
      <div className="topbar__spacer" />
      <div className="topbar__date">
        <CalendarDays aria-hidden="true" />
        {formatLongDate()}
      </div>
      <UserMenu onLogout={onLogout} />
    </header>
  );
}
