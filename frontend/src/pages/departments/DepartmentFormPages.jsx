import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import { departmentsService } from '../../services/organizationService';
import { DepartmentForm } from '../../components/departments/DepartmentForm';
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

/** Carga un departamento por el :id de la URL. */
export function useDepartmentFromRoute() {
  const { id } = useParams();
  const [state, setState] = useState({ loadedId: null, department: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    departmentsService
      .get(id, { signal: controller.signal })
      .then((d) => setState({ loadedId: id, department: d.department, error: null }))
      .catch((err) => err.name !== 'AbortError' && setState({ loadedId: id, department: null, error: err }));
    return () => controller.abort();
  }, [id]);

  const loading = state.loadedId !== id;
  return {
    loading,
    department: loading ? null : state.department,
    error: loading ? null : state.error,
    setDepartment: (department) => setState((s) => ({ ...s, department })),
  };
}

export function DepartmentNotFound({ error }) {
  if (error?.status === 403) return <ForbiddenPage />;
  const missing = error?.status === 404 || error?.status === 400;
  return (
    <div className="card error-page">
      <EmptyState
        icon={Building2}
        title={missing ? 'Departamento no encontrado' : 'No se pudo cargar el departamento'}
        text={missing ? 'Es posible que haya sido eliminado o que no tengas acceso.' : error?.message}
        action={
          <Link to="/departamentos" className="btn btn--primary">
            <ArrowLeft aria-hidden="true" /> Volver a departamentos
          </Link>
        }
      />
    </div>
  );
}

export function DepartmentCreatePage() {
  useDocumentTitle('Nuevo departamento');
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (payload) => {
    const { department } = await departmentsService.create(payload);
    toast.success('Departamento creado correctamente.', `${department.name} (${department.code})`);
    navigate(`/departamentos/${department.id}`);
  };

  return (
    <>
      <PageHeader
        back={<BackLink to="/departamentos">Volver a departamentos</BackLink>}
        title="Nuevo departamento"
        subtitle="Da de alta un área de la empresa y, si quieres, asígnale un responsable."
      />
      <section className="card form-card">
        <DepartmentForm mode="create" onSubmit={handleSubmit} onCancel={() => navigate('/departamentos')} />
      </section>
    </>
  );
}

export function DepartmentEditPage() {
  useDocumentTitle('Editar departamento');
  const navigate = useNavigate();
  const toast = useToast();
  const { loading, department, error } = useDepartmentFromRoute();

  if (loading) return <PageLoader label="Cargando departamento…" />;
  if (error || !department) return <DepartmentNotFound error={error} />;
  if (!department.capabilities.update) return <ForbiddenPage />;

  const handleSubmit = async (payload) => {
    const { department: updated } = await departmentsService.update(department.id, payload);
    toast.success('Cambios guardados', updated.name);
    navigate(`/departamentos/${department.id}`);
  };

  return (
    <>
      <PageHeader
        back={<BackLink to={`/departamentos/${department.id}`}>Volver al detalle</BackLink>}
        title="Editar departamento"
        subtitle={`${department.name} · ${department.code}`}
      />
      <section className="card form-card">
        <DepartmentForm
          mode="edit"
          initial={department}
          canChangeStatus={department.capabilities.changeStatus}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/departamentos/${department.id}`)}
        />
      </section>
    </>
  );
}
