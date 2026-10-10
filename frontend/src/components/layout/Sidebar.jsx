import { NavLink } from 'react-router-dom';
import { LogOut, PanelLeftClose, PanelLeftOpen, Ticket } from 'lucide-react';
import { NAVIGATION } from '../../config/navigation';
import { APP_NAME } from '../../config/app';
import { useAuth } from '../../hooks';

export function Sidebar({ collapsed, onToggleCollapsed, onNavigate, onLogout, loggingOut }) {
  const { hasPermission, hasAnyPermission, company } = useAuth();

  const visible = (item) =>
    item.comingSoon ||
    ((!item.permission || hasPermission(item.permission)) && (!item.anyOf || hasAnyPermission(...item.anyOf)));
  const sections = NAVIGATION.map((section) => ({ ...section, items: section.items.filter(visible) })).filter(
    (section) => section.items.length,
  );
  const companyName = company?.tradeName || company?.name;

  return (
    <aside className="sidebar" aria-label="Menú principal">
      <div className="sidebar__brand">
        {company?.logoUrl ? (
          <img className="brand-mark brand-mark--logo" src={company.logoUrl} alt="" />
        ) : (
          <span className="brand-mark">
            <Ticket aria-hidden="true" />
          </span>
        )}
        <span className="sidebar__brand-text">
          <span className="sidebar__brand-name">{APP_NAME}</span>
          {companyName && <span className="sidebar__company">{companyName}</span>}
        </span>
      </div>

      <nav className="sidebar__nav">
        {sections.map((section) => (
          <div className="nav-section" key={section.title}>
            <p className="nav-section__title">{section.title}</p>
            <ul className="nav-list">
              {section.items.map((item) => {
                const Icon = item.icon;
                if (item.comingSoon) {
                  return (
                    <li key={item.label}>
                      <span
                        className="nav-link nav-link--disabled"
                        aria-disabled="true"
                        title={collapsed ? `${item.label} (próximamente)` : 'Disponible próximamente'}
                      >
                        <Icon aria-hidden="true" />
                        <span className="nav-link__label">{item.label}</span>
                        <span className="nav-link__tag">Pronto</span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.to}>
                    <NavLink to={item.to} className="nav-link" onClick={onNavigate} title={collapsed ? item.label : undefined}>
                      <Icon aria-hidden="true" />
                      <span className="nav-link__label">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <ul className="nav-list">
          <li>
            <button
              type="button"
              className="nav-link sidebar__btn sidebar__collapse"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
              title={collapsed ? 'Expandir menú' : undefined}
            >
              {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
              <span className="nav-link__label">Contraer menú</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="nav-link sidebar__btn"
              onClick={onLogout}
              disabled={loggingOut}
              title={collapsed ? 'Cerrar sesión' : undefined}
            >
              <LogOut aria-hidden="true" />
              <span className="nav-link__label">{loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</span>
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
