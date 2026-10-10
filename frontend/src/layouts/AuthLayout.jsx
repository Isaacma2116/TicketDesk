import { CheckCircle2, Ticket } from 'lucide-react';
import { APP_NAME } from '../config/app';

const HIGHLIGHTS = [
  'Centraliza las solicitudes de toda tu organización',
  'Control de acceso por roles y permisos',
  'Seguimiento claro de cada caso, de principio a fin',
];

/** Layout de las páginas públicas: panel de marca + formulario. */
export function AuthLayout({ children }) {
  return (
    <div className="auth">
      <aside className="auth__brand" aria-hidden="true">
        <div className="auth__brand-inner">
          <div className="auth__logo">
            <span className="brand-mark brand-mark--lg">
              <Ticket />
            </span>
            <span>{APP_NAME}</span>
          </div>
          <div>
            <h2 className="auth__headline">Gestión de tickets para equipos que necesitan orden y visibilidad.</h2>
            <ul className="auth__highlights">
              {HIGHLIGHTS.map((h) => (
                <li key={h}>
                  <CheckCircle2 />
                  {h}
                </li>
              ))}
            </ul>
          </div>
          <p className="auth__legal">
            © {new Date().getFullYear()} {APP_NAME}. Acceso exclusivo para personal autorizado.
          </p>
        </div>
      </aside>
      <main className="auth__main">
        <div className="auth__panel">
          <div className="auth__mobile-logo">
            <span className="brand-mark">
              <Ticket aria-hidden="true" />
            </span>
            <span>{APP_NAME}</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
