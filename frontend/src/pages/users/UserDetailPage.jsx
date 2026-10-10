import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, KeyRound, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import { Alert, Avatar, Badge, Button, Card, CodeBadge, PageLoader, RoleBadge, StatusBadge } from '../../components/ui';
import { useAuth, useDocumentTitle } from '../../hooks';
import { useUserActions } from '../../hooks/useUserActions';
import { formatDateTime, formatRelative } from '../../utils/format';
import { DEPARTMENTS_ACCESS, PERMISSIONS } from '../../utils/permissions';
import { UserNotFound, useUserFromRoute } from './UserFormPages';

function DepartmentLink({ department, linkable }) {
  const content = (
    <>
      {department.name} <CodeBadge>{department.code}</CodeBadge>
      {department.isManager && (
        <Badge tone="warning">
          <Crown aria-hidden="true" className="badge__icon" /> Responsable
        </Badge>
      )}
      {department.status === 'inactive' && <Badge tone="neutral">Inactivo</Badge>}
    </>
  );
  return linkable ? (
    <Link to={`/departamentos/${department.id}`} className="cell-person">
      {content}
    </Link>
  ) : (
    <span className="cell-person">{content}</span>
  );
}

export default function UserDetailPage() {
  const { hasPermission, hasAnyPermission, user: me } = useAuth();
  const navigate = useNavigate();
  const { loading, user, error, setUser } = useUserFromRoute();
  useDocumentTitle(user ? user.fullName : 'Detalle de usuario');

  const actions = useUserActions({
    onChanged: (updated) => setUser({ ...updated, capabilities: updated.capabilities ?? user.capabilities }),
    onDeleted: () => navigate('/usuarios', { replace: true }),
  });

  if (loading) return <PageLoader label="Cargando usuario…" />;
  if (error || !user) return <UserNotFound error={error} />;

  const isMe = user.id === me.id;
  const canOpenDepartments = hasAnyPermission(...DEPARTMENTS_ACCESS);
  const otherDepartments = (user.departments ?? []).filter((d) => !d.isPrimary);
  const caps = user.capabilities;
  const canEdit = hasPermission(PERMISSIONS.USERS_UPDATE) && caps.edit;
  const canStatus = hasPermission(PERMISSIONS.USERS_CHANGE_STATUS) && caps.changeStatus;
  const canReset = hasPermission(PERMISSIONS.USERS_UPDATE) && caps.changeRole;
  const canDelete = hasPermission(PERMISSIONS.USERS_DELETE) && caps.delete;

  return (
    <>
      <Link to="/usuarios" className="back-link">
        <ArrowLeft aria-hidden="true" /> Volver a usuarios
      </Link>

      <section className="card profile">
        <div className="profile__main">
          <Avatar firstName={user.firstName} lastName={user.lastName} seed={user.email} size="lg" />
          <div style={{ minWidth: 0 }}>
            <h1 className="profile__name">
              {user.fullName} {isMe && <span className="muted profile__me">(tú)</span>}
            </h1>
            <p className="profile__email">{user.email}</p>
            <div className="profile__badges">
              <RoleBadge role={user.role} />
              {user.department && <Badge tone="neutral">{user.department.name}</Badge>}
              <StatusBadge status={user.status} />
            </div>
          </div>
        </div>
        <div className="profile__actions">
          {canEdit && (
            <Button icon={Pencil} onClick={() => navigate(`/usuarios/${user.id}/editar`)}>
              Editar
            </Button>
          )}
          {canStatus && (
            <Button icon={user.status === 'active' ? PowerOff : Power} onClick={() => actions.toggleStatus(user)}>
              {user.status === 'active' ? 'Desactivar' : 'Activar'}
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" className="text-danger" icon={Trash2} onClick={() => actions.remove(user)}>
              Eliminar
            </Button>
          )}
        </div>
      </section>

      {user.mustChangePassword && (
        <div style={{ marginTop: 16 }}>
          <Alert tone="warning" title="Contraseña temporal pendiente">
            El usuario aún no ha definido su contraseña personal; se le pedirá en su próximo inicio de sesión.
          </Alert>
        </div>
      )}

      <div className="detail-grid">
        <Card title="Información de la cuenta">
          <dl className="details">
            <div><dt>Nombre</dt><dd>{user.firstName}</dd></div>
            <div><dt>Apellidos</dt><dd>{user.lastName}</dd></div>
            <div><dt>Correo electrónico</dt><dd>{user.email}</dd></div>
            <div><dt>Rol</dt><dd><RoleBadge role={user.role} /></dd></div>
            <div>
              <dt>Departamento</dt>
              <dd>
                {user.department ? (
                  <DepartmentLink department={user.department} linkable={canOpenDepartments} />
                ) : (
                  <span className="muted">Sin departamento</span>
                )}
              </dd>
            </div>
            {otherDepartments.length > 0 && (
              <div>
                <dt>Otros departamentos</dt>
                <dd className="badge-row">
                  {otherDepartments.map((d) => (
                    <DepartmentLink key={d.id} department={d} linkable={canOpenDepartments} />
                  ))}
                </dd>
              </div>
            )}
            <div><dt>Estado</dt><dd><StatusBadge status={user.status} /></dd></div>
          </dl>
        </Card>

        <Card title="Actividad">
          <dl className="details">
            <div>
              <dt>Último acceso</dt>
              <dd>
                {user.lastLoginAt ? (
                  <>
                    {formatDateTime(user.lastLoginAt)} <span className="muted">({formatRelative(user.lastLoginAt)})</span>
                  </>
                ) : (
                  'Nunca ha iniciado sesión'
                )}
              </dd>
            </div>
            <div><dt>Fecha de creación</dt><dd>{formatDateTime(user.createdAt)}</dd></div>
            <div><dt>Creado por</dt><dd>{user.createdBy?.name ?? 'Sistema (configuración inicial)'}</dd></div>
            <div><dt>Última modificación</dt><dd>{formatDateTime(user.updatedAt)}</dd></div>
          </dl>
        </Card>

        {canReset && (
          <Card title="Seguridad" subtitle="Restablece el acceso si la persona olvidó su contraseña.">
            <Button icon={KeyRound} onClick={() => actions.resetPassword(user)}>
              Restablecer contraseña
            </Button>
          </Card>
        )}
      </div>
      {actions.modal}
    </>
  );
}
