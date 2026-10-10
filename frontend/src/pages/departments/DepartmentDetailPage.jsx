import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Crown,
  Headset,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  UserCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { departmentsService } from '../../services/organizationService';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CodeBadge,
  EmptyState,
  PageLoader,
  RoleBadge,
  Skeleton,
  StatusBadge,
} from '../../components/ui';
import { useAuth, useDocumentTitle } from '../../hooks';
import { useDepartmentActions } from '../../hooks/useDepartmentActions';
import { formatDateTime } from '../../utils/format';
import { PERMISSIONS } from '../../utils/permissions';
import { DepartmentNotFound, useDepartmentFromRoute } from './DepartmentFormPages';

function SummaryTile({ icon: Icon, label, value, tone = 'brand' }) {
  return (
    <div className="stat stat--compact">
      <div className={`stat__icon stat__icon--${tone}`}>
        <Icon aria-hidden="true" />
      </div>
      <div className="stat__body">
        <p className="stat__label">{label}</p>
        <p className="stat__value tabular">{value}</p>
      </div>
    </div>
  );
}

function MembersCard({ department, canOpenUsers }) {
  const [state, setState] = useState({ loadedFor: null, users: null, error: null });
  const key = `${department.id}-${department.updatedAt}-${department.membersCount}`;

  useEffect(() => {
    const controller = new AbortController();
    departmentsService
      .members(department.id, { signal: controller.signal })
      .then((d) => setState({ loadedFor: key, users: d.users, error: null }))
      .catch((err) => err.name !== 'AbortError' && setState({ loadedFor: key, users: null, error: err.message }));
    return () => controller.abort();
  }, [department.id, key]);

  const loading = state.loadedFor !== key;
  const users = state.users ?? [];
  const agents = users.filter((u) => u.isAgent);

  return (
    <Card
      title="Usuarios del departamento"
      subtitle="Integrantes, su rol y su tipo de pertenencia."
      bodyClassName=""
      actions={
        canOpenUsers && (
          <Link to={`/usuarios?departamento=${department.id}`} className="btn btn--ghost btn--sm">
            <Users aria-hidden="true" /> Ver en Usuarios
          </Link>
        )
      }
    >
      {state.error ? (
        <div style={{ padding: 20 }}>
          <Alert tone="error" title="No se pudieron cargar los usuarios">{state.error}</Alert>
        </div>
      ) : loading ? (
        <div style={{ padding: 20, display: 'grid', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={18} />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin usuarios"
          text="Asigna usuarios a este departamento desde el módulo Usuarios."
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table table--responsive">
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Pertenencia</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="cell-primary">
                      <div className="cell-user">
                        <Avatar firstName={u.firstName} lastName={u.lastName} seed={u.email} size="sm" />
                        <span>
                          {canOpenUsers ? (
                            <Link to={`/usuarios/${u.id}`} className="cell-user__name">
                              {u.fullName}
                            </Link>
                          ) : (
                            <span className="cell-user__name">{u.fullName}</span>
                          )}
                          <span className="cell-user__meta cell-user__meta--block">{u.email}</span>
                        </span>
                      </div>
                    </td>
                    <td data-label="Rol">
                      <RoleBadge role={u.role} />
                    </td>
                    <td data-label="Pertenencia">
                      <span className="badge-row">
                        {department.manager?.id === u.id && (
                          <Badge tone="warning">
                            <Crown aria-hidden="true" className="badge__icon" /> Responsable
                          </Badge>
                        )}
                        {u.isAgent && <Badge tone="role-agent">Agente</Badge>}
                        <Badge tone="neutral">{u.isPrimary ? 'Principal' : 'Secundario'}</Badge>
                      </span>
                    </td>
                    <td data-label="Estado">
                      <StatusBadge status={u.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card__section">
            <p className="card__section-title">
              <Headset aria-hidden="true" /> Agentes del departamento
            </p>
            {agents.length ? (
              <ul className="chip-list">
                {agents.map((a) => (
                  <li key={a.id} className="chip">
                    <Avatar firstName={a.firstName} lastName={a.lastName} seed={a.email} size="xs" />
                    {a.fullName}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                Aún no hay agentes. Los usuarios con rol Agente se registran automáticamente como agentes del
                departamento y atenderán sus tickets en la próxima etapa.
              </p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

export default function DepartmentDetailPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { loading, department, error, setDepartment } = useDepartmentFromRoute();
  useDocumentTitle(department ? department.name : 'Detalle de departamento');

  const actions = useDepartmentActions({
    onChanged: (updated) => setDepartment(updated),
    onDeleted: () => navigate('/departamentos', { replace: true }),
  });

  if (loading) return <PageLoader label="Cargando departamento…" />;
  if (error || !department) return <DepartmentNotFound error={error} />;

  const caps = department.capabilities;
  const canOpenUsers = hasPermission(PERMISSIONS.USERS_VIEW);

  return (
    <>
      <Link to="/departamentos" className="back-link">
        <ArrowLeft aria-hidden="true" /> Volver a departamentos
      </Link>

      <section className="card profile">
        <div className="profile__main">
          <span className="dept-mark" aria-hidden="true">
            {department.code.slice(0, 3)}
          </span>
          <div style={{ minWidth: 0 }}>
            <h1 className="profile__name">{department.name}</h1>
            <p className="profile__email">{department.description || 'Sin descripción'}</p>
            <div className="profile__badges">
              <CodeBadge>{department.code}</CodeBadge>
              <StatusBadge status={department.status} />
            </div>
          </div>
        </div>
        <div className="profile__actions">
          {caps.update && (
            <Button icon={Pencil} onClick={() => navigate(`/departamentos/${department.id}/editar`)}>
              Editar
            </Button>
          )}
          {caps.changeStatus && (
            <Button icon={department.status === 'active' ? PowerOff : Power} onClick={() => actions.toggleStatus(department)}>
              {department.status === 'active' ? 'Desactivar' : 'Activar'}
            </Button>
          )}
          {caps.delete && (
            <Button variant="ghost" className="text-danger" icon={Trash2} onClick={() => actions.remove(department)}>
              Eliminar
            </Button>
          )}
        </div>
      </section>

      {department.status === 'inactive' && (
        <div style={{ marginTop: 16 }}>
          <Alert tone="warning" title="Departamento inactivo">
            Sus usuarios y su historial se conservan, pero no admite nuevas asignaciones.
          </Alert>
        </div>
      )}

      {department.summary && (
        <div className="stats-grid" style={{ marginTop: 20 }}>
          <SummaryTile icon={Users} label="Usuarios totales" value={department.summary.total} />
          <SummaryTile icon={UserCheck} tone="success" label="Usuarios activos" value={department.summary.active} />
          <SummaryTile icon={Headset} tone="info" label="Agentes" value={department.summary.agents} />
          <SummaryTile icon={UserCog} tone="neutral" label="Supervisores" value={department.summary.supervisors} />
        </div>
      )}

      <div className="detail-grid detail-grid--wide">
        <Card title="Información del departamento">
          <dl className="details">
            <div><dt>Nombre</dt><dd>{department.name}</dd></div>
            <div><dt>Código</dt><dd><CodeBadge>{department.code}</CodeBadge></dd></div>
            <div><dt>Descripción</dt><dd>{department.description || '—'}</dd></div>
            <div>
              <dt>Responsable</dt>
              <dd>
                {department.manager ? (
                  <span className="cell-person">
                    <Avatar
                      firstName={department.manager.firstName}
                      lastName={department.manager.lastName}
                      seed={department.manager.email}
                      size="xs"
                    />
                    {department.manager.fullName}
                    {department.manager.status !== 'active' && <Badge tone="neutral">Inactivo</Badge>}
                  </span>
                ) : (
                  <span className="muted">Sin responsable</span>
                )}
              </dd>
            </div>
            <div><dt>Estado</dt><dd><StatusBadge status={department.status} /></dd></div>
            <div><dt>Fecha de creación</dt><dd>{formatDateTime(department.createdAt)}</dd></div>
            <div><dt>Última modificación</dt><dd>{formatDateTime(department.updatedAt)}</dd></div>
          </dl>
        </Card>

        {caps.viewMembers ? (
          <MembersCard department={department} canOpenUsers={canOpenUsers} />
        ) : (
          <Card title="Usuarios del departamento">
            <EmptyState
              icon={Users}
              title="Información restringida"
              text="Tu rol solo permite consultar la información básica del departamento."
            />
          </Card>
        )}
      </div>
    </>
  );
}
