import { Link } from 'react-router-dom';
import { Building, Building2, Crown, KeyRound } from 'lucide-react';
import { Avatar, Badge, Card, CodeBadge, EmptyState, PageHeader, RoleBadge, StatusBadge } from '../../components/ui';
import { useAuth, useDocumentTitle } from '../../hooks';
import { formatDateTime } from '../../utils/format';
import { DEPARTMENTS_ACCESS } from '../../utils/permissions';

/** Perfil del usuario autenticado (datos de /auth/me). */
export default function ProfilePage() {
  useDocumentTitle('Mi perfil');
  const { user, company, hasAnyPermission } = useAuth();
  const canOpenDepartments = hasAnyPermission(...DEPARTMENTS_ACCESS);
  const departments = user.departments ?? [];

  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Tu información en la plataforma." />

      <section className="card profile">
        <div className="profile__main">
          <Avatar firstName={user.firstName} lastName={user.lastName} seed={user.email} size="lg" />
          <div style={{ minWidth: 0 }}>
            <h1 className="profile__name">{user.fullName}</h1>
            <p className="profile__email">{user.email}</p>
            <div className="profile__badges">
              <RoleBadge role={user.role} />
              {user.department && <Badge tone="neutral">{user.department.name}</Badge>}
              <StatusBadge status={user.status} />
            </div>
          </div>
        </div>
        <div className="profile__actions">
          <Link to="/cuenta/contrasena" className="btn">
            <KeyRound aria-hidden="true" /> Cambiar contraseña
          </Link>
        </div>
      </section>

      <div className="detail-grid">
        <Card title="Datos de la cuenta">
          <dl className="details">
            <div><dt>Nombre</dt><dd>{user.fullName}</dd></div>
            <div><dt>Correo</dt><dd>{user.email}</dd></div>
            <div><dt>Rol</dt><dd><RoleBadge role={user.role} /></dd></div>
            <div>
              <dt>Departamento</dt>
              <dd>{user.department ? `${user.department.name} (${user.department.code})` : <span className="muted">Sin departamento</span>}</dd>
            </div>
            <div><dt>Estado</dt><dd><StatusBadge status={user.status} /></dd></div>
            <div>
              <dt>Empresa</dt>
              <dd className="cell-person">
                <Building aria-hidden="true" className="inline-icon" />
                {company?.tradeName || company?.name}
              </dd>
            </div>
            <div><dt>Cuenta creada</dt><dd>{formatDateTime(user.createdAt)}</dd></div>
          </dl>
        </Card>

        <Card title="Mis departamentos" subtitle="Departamentos a los que perteneces." bodyClassName="">
          {departments.length ? (
            <ul className="list">
              {departments.map((d) => {
                const content = (
                  <>
                    <span className="list__main">
                      <span className="list__title">{d.name}</span>
                      <span className="list__meta">{d.isPrimary ? 'Departamento principal' : 'Pertenencia secundaria'}</span>
                    </span>
                    <span className="badge-row">
                      {d.isManager && (
                        <Badge tone="warning">
                          <Crown aria-hidden="true" className="badge__icon" /> Responsable
                        </Badge>
                      )}
                      <CodeBadge>{d.code}</CodeBadge>
                      {d.status !== 'active' && <StatusBadge status={d.status} />}
                    </span>
                  </>
                );
                return (
                  <li key={d.id}>
                    {canOpenDepartments ? (
                      <Link to={`/departamentos/${d.id}`} className="list__item">
                        {content}
                      </Link>
                    ) : (
                      <div className="list__item">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={Building2}
              title="Sin departamento"
              text="Aún no perteneces a ningún departamento. Un administrador puede asignarte uno."
            />
          )}
        </Card>
      </div>
    </>
  );
}
