import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Building,
  Building2,
  CheckCircle2,
  FormInput,
  GitBranch,
  Shapes,
  Tags,
  Clock,
  KeyRound,
  ShieldCheck,
  Ticket,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import { dashboardService } from '../../services/usersService';
import { Alert, Avatar, Button, Card, EmptyState, RoleBadge, Skeleton, StatusBadge } from '../../components/ui';
import { useAuth, useDocumentTitle } from '../../hooks';
import { formatDateTime, formatLongDate, formatRelative, greeting } from '../../utils/format';
import { PERMISSIONS } from '../../utils/permissions';

const UPCOMING = [
  { icon: Ticket, title: 'Tickets', text: 'Creación, asignación y seguimiento de solicitudes.' },
  { icon: Tags, title: 'Categorías', text: 'Clasificación de solicitudes por departamento.' },
  { icon: Shapes, title: 'Tipos de ticket', text: 'Plantillas de solicitud para cada área.' },
  { icon: FormInput, title: 'Campos personalizados', text: 'Formularios a la medida de cada proceso.' },
  { icon: GitBranch, title: 'Flujos', text: 'Estados, prioridades y aprobaciones.' },
  { icon: BarChart3, title: 'Reportes', text: 'Indicadores de servicio y productividad.' },
  { icon: Bell, title: 'Notificaciones', text: 'Avisos en tiempo real sobre tus casos.' },
  { icon: ShieldCheck, title: 'Auditoría', text: 'Consulta del registro de acciones.' },
];

function StatTile({ icon: Icon, label, value, hint, tone = 'brand', loading }) {
  return (
    <div className="stat">
      <div className={`stat__icon stat__icon--${tone}`}>
        <Icon aria-hidden="true" />
      </div>
      <div className="stat__body">
        <p className="stat__label">{label}</p>
        {loading ? <Skeleton width={56} height={28} style={{ margin: '4px 0' }} /> : <p className="stat__value tabular">{value}</p>}
        {hint && <p className="stat__hint">{hint}</p>}
      </div>
    </div>
  );
}

/** Barras horizontales: una sola serie, un solo tono, valores rotulados. */
function BarList({ data, total, label, linkTo }) {
  const max = Math.max(1, ...data.map((r) => r.total));
  return (
    <ul className="bars" aria-label={label}>
      {data.map((r) => {
        const pct = total ? Math.round((r.total / total) * 100) : 0;
        return (
          <li key={r.id} className="bars__row" title={`${r.name}: ${r.total} usuario(s), ${pct}% del total`}>
            {linkTo ? (
              <Link to={linkTo(r)} className="bars__label bars__label--link">
                {r.name}
              </Link>
            ) : (
              <span className="bars__label">{r.name}</span>
            )}
            <span className="bars__track">
              <span className="bars__fill" style={{ width: r.total ? `${Math.max(2, (r.total / max) * 100)}%` : 0 }} />
            </span>
            <span className="bars__value tabular">
              {r.total} <span className="muted">· {pct}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user, company, hasPermission } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback((signal) => {
    dashboardService
      .summary({ signal })
      .then(setSummary)
      .catch((err) => err.name !== 'AbortError' && setError(err.message));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const loading = !summary && !error;
  const depts = summary?.departments;
  const canSeeOrg = hasPermission(PERMISSIONS.USERS_VIEW) && hasPermission(PERMISSIONS.DEPARTMENTS_VIEW);
  const companyName = company?.tradeName || company?.name;
  const stats = summary?.users;
  const canCreate = hasPermission(PERMISSIONS.USERS_CREATE);

  return (
    <div className="dashboard">
      <section className="hero">
        <div className="hero__main">
          <Avatar firstName={user.firstName} lastName={user.lastName} seed={user.email} size="lg" />
          <div>
            <p className="hero__eyebrow">
              {companyName && (
                <span className="hero__company">
                  <Building aria-hidden="true" /> {companyName}
                </span>
              )}
              {formatLongDate()}
            </p>
            <h1 className="hero__title">
              {greeting()}, {user.firstName}
            </h1>
            <p className="hero__text">
              Te damos la bienvenida a tu panel. Has iniciado sesión como <RoleBadge role={user.role} />
              {user.department && (
                <>
                  en <strong>{user.department.name}</strong>
                </>
              )}
            </p>
          </div>
        </div>
        {hasPermission(PERMISSIONS.USERS_VIEW) && (
          <div className="hero__actions">
            <Link to="/usuarios" className="btn">
              <Users aria-hidden="true" /> Ver usuarios
            </Link>
            {canCreate && (
              <Link to="/usuarios/nuevo" className="btn btn--primary">
                <UserPlus aria-hidden="true" /> Nuevo usuario
              </Link>
            )}
          </div>
        )}
      </section>

      {error && (
        <Alert tone="error" title="No se pudo cargar el resumen">
          {error}{' '}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setError(null);
              load();
            }}
          >
            Reintentar
          </Button>
        </Alert>
      )}

      {canSeeOrg && (stats || loading) ? (
        <div className="stats-grid">
          <StatTile
            icon={Users}
            label="Usuarios"
            value={stats?.total}
            loading={loading}
            hint={stats ? `${stats.inactive} inactivo(s) · ${stats.newLast30Days} nuevo(s) en 30 días` : undefined}
          />
          <StatTile
            icon={UserCheck}
            tone="success"
            label="Usuarios activos"
            value={stats?.active}
            loading={loading}
            hint={stats ? `${stats.withoutDepartment} sin departamento` : undefined}
          />
          <StatTile icon={Building2} tone="info" label="Departamentos" value={depts?.total} loading={loading} hint="Áreas registradas" />
          <StatTile
            icon={CheckCircle2}
            tone="success"
            label="Departamentos activos"
            value={depts?.active}
            loading={loading}
            hint={depts ? `${depts.inactive} inactivo(s)` : undefined}
          />
        </div>
      ) : stats || (loading && hasPermission(PERMISSIONS.USERS_VIEW)) ? (
        <div className="stats-grid">
          <StatTile icon={Users} label="Usuarios totales" value={stats?.total} loading={loading} hint="Cuentas registradas" />
          <StatTile icon={UserCheck} tone="success" label="Activos" value={stats?.active} loading={loading} hint="Con acceso al sistema" />
          <StatTile icon={UserX} tone="neutral" label="Inactivos" value={stats?.inactive} loading={loading} hint="Acceso suspendido" />
          <StatTile icon={UserPlus} tone="info" label="Nuevos (30 días)" value={stats?.newLast30Days} loading={loading} hint="Altas recientes" />
        </div>
      ) : (
        <div className="stats-grid">
          <StatTile icon={ShieldCheck} label="Tu rol" value={user.role.name} />
          <StatTile
            icon={Building2}
            tone="info"
            label="Tu departamento"
            value={user.department?.name ?? 'Sin asignar'}
            hint={user.department ? user.department.code : 'Pide a un administrador que te asigne uno'}
          />
          <StatTile
            icon={Clock}
            tone="neutral"
            label="Sesión iniciada"
            value={summary ? formatRelative(summary.session.startedAt) : '—'}
            loading={loading}
          />
        </div>
      )}

      <div className="dashboard__grid">
        {depts && (
          <Card
            title="Departamentos"
            subtitle="Usuarios activos por departamento activo"
            actions={
              <Link to="/departamentos" className="btn btn--ghost btn--sm">
                Ver todos <ArrowRight aria-hidden="true" />
              </Link>
            }
          >
            {depts.members.length ? (
              <BarList
                data={depts.members}
                total={depts.members.reduce((acc, d) => acc + d.total, 0)}
                label="Usuarios por departamento"
                linkTo={(d) => `/departamentos/${d.id}`}
              />
            ) : (
              <EmptyState
                icon={Building2}
                title="Sin departamentos activos"
                text="Crea departamentos para organizar a los usuarios de tu empresa."
                action={
                  hasPermission(PERMISSIONS.DEPARTMENTS_CREATE) && (
                    <Link to="/departamentos/nuevo" className="btn btn--primary btn--sm">
                      Nuevo departamento
                    </Link>
                  )
                }
              />
            )}
          </Card>
        )}

        {stats && (
          <>
            <Card title="Usuarios por rol" subtitle="Distribución actual de cuentas">
              <BarList data={stats.byRole} total={stats.total} label="Usuarios por rol" />
            </Card>

            <Card
              title="Altas recientes"
              subtitle="Últimos usuarios registrados"
              bodyClassName=""
              actions={
                <Link to="/usuarios" className="btn btn--ghost btn--sm">
                  Ver todos <ArrowRight aria-hidden="true" />
                </Link>
              }
            >
              {stats.recent.length ? (
                <ul className="list">
                  {stats.recent.map((u) => (
                    <li key={u.id}>
                      <Link to={`/usuarios/${u.id}`} className="list__item">
                        <Avatar firstName={u.firstName} lastName={u.lastName} seed={u.email} size="sm" />
                        <span className="list__main">
                          <span className="list__title">{u.fullName}</span>
                          <span className="list__meta">{u.role.name} · {formatRelative(u.createdAt)}</span>
                        </span>
                        <StatusBadge status={u.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={Users} title="Sin usuarios todavía" text="Los usuarios que crees aparecerán aquí." />
              )}
            </Card>
          </>
        )}

        <Card title="Mi cuenta" subtitle="Información de tu sesión actual">
          <dl className="details">
            <div>
              <dt>Nombre</dt>
              <dd>{user.fullName}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Rol</dt>
              <dd>
                <RoleBadge role={user.role} />
              </dd>
            </div>
            <div>
              <dt>Departamento</dt>
              <dd>{user.department ? `${user.department.name} (${user.department.code})` : 'Sin departamento'}</dd>
            </div>
            <div>
              <dt>Sesión iniciada</dt>
              <dd>{summary ? formatDateTime(summary.session.startedAt) : '—'}</dd>
            </div>
            <div>
              <dt>Tipo de sesión</dt>
              <dd>{summary ? (summary.session.rememberMe ? 'Recordada en este equipo' : 'Temporal (navegador)') : '—'}</dd>
            </div>
            <div>
              <dt>Expira</dt>
              <dd>{summary ? formatDateTime(summary.session.expiresAt) : '—'}</dd>
            </div>
          </dl>
          <Link to="/cuenta/contrasena" className="btn btn--sm" style={{ marginTop: 16 }}>
            <KeyRound aria-hidden="true" /> Cambiar contraseña
          </Link>
        </Card>

        <Card title="Próximamente" subtitle="Módulos planificados para las siguientes etapas">
          <ul className="upcoming">
            {UPCOMING.map(({ icon: Icon, title, text }) => (
              <li key={title} className="upcoming__item">
                <span className="upcoming__icon">
                  <Icon aria-hidden="true" />
                </span>
                <span>
                  <span className="upcoming__title">{title}</span>
                  <span className="upcoming__text">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
