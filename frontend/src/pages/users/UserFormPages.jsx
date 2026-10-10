import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, UserX } from 'lucide-react';
import { usersService } from '../../services/usersService';
import { UserForm } from '../../components/users/UserForm';
import { TemporaryPasswordModal } from '../../components/users/TemporaryPasswordModal';
import { EmptyState, PageHeader, PageLoader } from '../../components/ui';
import { useDocumentTitle, useToast } from '../../hooks';
import { ForbiddenPage } from '../errors/ErrorPages';

function BackLink({ to, children }) {
  return (
    <Link to={to} className="back-link">
      <ArrowLeft aria-hidden="true" /> {children}
    </Link>
  );
}

export function UserCreatePage() {
  useDocumentTitle('Nuevo usuario');
  const navigate = useNavigate();
  const toast = useToast();
  const [created, setCreated] = useState(null);

  const handleSubmit = async (payload) => {
    const result = await usersService.create(payload);
    if (result.temporaryPassword) {
      setCreated(result);
    } else {
      toast.success('Usuario creado', `${result.user.fullName} ya puede iniciar sesión.`);
      navigate(`/usuarios/${result.user.id}`);
    }
  };

  return (
    <>
      <PageHeader
        back={<BackLink to="/usuarios">Volver a usuarios</BackLink>}
        title="Nuevo usuario"
        subtitle="Da de alta una cuenta y asígnale un rol."
      />
      <section className="card form-card">
        <UserForm mode="create" onSubmit={handleSubmit} onCancel={() => navigate('/usuarios')} />
      </section>
      {created && (
        <TemporaryPasswordModal
          user={created.user}
          password={created.temporaryPassword}
          onClose={() => {
            toast.success('Usuario creado', created.user.fullName);
            navigate(`/usuarios/${created.user.id}`);
          }}
        />
      )}
    </>
  );
}

/** Carga un usuario por el :id de la URL. */
export function useUserFromRoute() {
  const { id } = useParams();
  // `loadedId` indica para qué :id es el estado; si no coincide, está cargando.
  const [state, setState] = useState({ loadedId: null, user: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    usersService
      .get(id, { signal: controller.signal })
      .then((d) => setState({ loadedId: id, user: d.user, error: null }))
      .catch((err) => err.name !== 'AbortError' && setState({ loadedId: id, user: null, error: err }));
    return () => controller.abort();
  }, [id]);

  const loading = state.loadedId !== id;
  return {
    loading,
    user: loading ? null : state.user,
    error: loading ? null : state.error,
    setUser: (user) => setState((s) => ({ ...s, user })),
  };
}

export function UserNotFound({ error }) {
  if (error?.status === 403) return <ForbiddenPage />;
  return (
    <div className="card error-page">
      <EmptyState
        icon={UserX}
        title={error?.status === 404 || error?.status === 400 ? 'Usuario no encontrado' : 'No se pudo cargar el usuario'}
        text={error?.status === 404 || error?.status === 400 ? 'Es posible que haya sido eliminado.' : error?.message}
        action={
          <Link to="/usuarios" className="btn btn--primary">
            <ArrowLeft aria-hidden="true" /> Volver a usuarios
          </Link>
        }
      />
    </div>
  );
}

export function UserEditPage() {
  useDocumentTitle('Editar usuario');
  const navigate = useNavigate();
  const toast = useToast();
  const { loading, user, error } = useUserFromRoute();

  if (loading) return <PageLoader label="Cargando usuario…" />;
  if (error || !user) return <UserNotFound error={error} />;
  if (!user.capabilities.edit) return <ForbiddenPage />;

  const handleSubmit = async (payload) => {
    const result = await usersService.update(user.id, payload);
    toast.success('Cambios guardados', result.user.fullName);
    navigate(`/usuarios/${user.id}`);
  };

  return (
    <>
      <PageHeader
        back={<BackLink to={`/usuarios/${user.id}`}>Volver al detalle</BackLink>}
        title="Editar usuario"
        subtitle={`${user.fullName} · ${user.email}`}
      />
      <section className="card form-card">
        <UserForm
          mode="edit"
          initialUser={user}
          canChangeRole={user.capabilities.changeRole}
          canChangeDepartment={user.capabilities.changeDepartment}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/usuarios/${user.id}`)}
        />
      </section>
    </>
  );
}
