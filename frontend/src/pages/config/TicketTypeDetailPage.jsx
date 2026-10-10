import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FormInput, Pencil, Power, PowerOff } from 'lucide-react';
import { formsService, requestCatalogService } from '../../services/catalogService';
import { Alert, Button, Card, CodeBadge, PageLoader, StatusBadge } from '../../components/ui';
import { DynamicForm } from '../../components/forms/DynamicForm';
import { initialValues } from '../../components/forms/fieldTypes';
import { useAuth, useDocumentTitle } from '../../hooks';
import { formatDateTime } from '../../utils/format';
import { PERMISSIONS } from '../../utils/permissions';
import { AssigneeText, PriorityBadge, useTicketTypeToggle } from './TicketTypesListPage';
import { TicketTypeNotFound, useTicketTypeFromRoute } from './TicketTypeFormPages';

/** Carga las opciones de los campos Usuario/Departamento si el formulario las usa. */
export function useFormLookups(fields) {
  const { hasPermission } = useAuth();
  const [lookups, setLookups] = useState({});
  const needsUsers = fields?.some((f) => f.type === 'user');
  const needsDepartments = fields?.some((f) => f.type === 'department');
  const allowed = hasPermission(PERMISSIONS.REQUEST_CATALOG_VIEW);
  useEffect(() => {
    if (!allowed) return undefined;
    const c = new AbortController();
    if (needsUsers) requestCatalogService.users({ signal: c.signal }).then((d) => setLookups((l) => ({ ...l, users: d.users }))).catch(() => {});
    if (needsDepartments) {
      requestCatalogService
        .departments({ signal: c.signal })
        .then((d) => setLookups((l) => ({ ...l, departments: d.departments })))
        .catch(() => {});
    }
    return () => c.abort();
  }, [needsUsers, needsDepartments, allowed]);
  return lookups;
}

function FormPreviewCard({ ticketType }) {
  const [state, setState] = useState({ fields: null, error: null });
  const [values, setValues] = useState({});
  const lookups = useFormLookups(state.fields);

  useEffect(() => {
    const c = new AbortController();
    formsService
      .get(ticketType.id, { signal: c.signal })
      .then((d) => {
        setState({ fields: d.fields, error: null });
        setValues(initialValues(d.fields));
      })
      .catch((err) => err.name !== 'AbortError' && setState({ fields: null, error: err.message }));
    return () => c.abort();
  }, [ticketType.id]);

  return (
    <Card
      title="Vista previa del formulario"
      subtitle="Así lo verá quien cree la solicitud."
      actions={
        ticketType.capabilities.viewForm && (
          <Link to={`/configuracion/formularios/${ticketType.id}`} className="btn btn--ghost btn--sm">
            <FormInput aria-hidden="true" /> {ticketType.capabilities.editForm ? 'Diseñar formulario' : 'Ver formulario'}
          </Link>
        )
      }
    >
      {state.error ? (
        <Alert tone="error" title="No se pudo cargar el formulario">{state.error}</Alert>
      ) : !state.fields ? (
        <PageLoader label="Cargando formulario…" />
      ) : (
        <div className="preview-sheet">
          <p className="preview-sheet__title">{ticketType.name}</p>
          {ticketType.description && <p className="preview-sheet__desc">{ticketType.description}</p>}
          <DynamicForm
            fields={state.fields}
            values={values}
            onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
            lookups={lookups}
            emptyText="Este tipo aún no tiene campos. Diseña su formulario para que los usuarios puedan crear solicitudes."
          />
        </div>
      )}
    </Card>
  );
}

export default function TicketTypeDetailPage() {
  const navigate = useNavigate();
  const { loading, ticketType, error, setTicketType } = useTicketTypeFromRoute();
  useDocumentTitle(ticketType ? ticketType.name : 'Tipo de solicitud');
  const toggle = useTicketTypeToggle((updated) => setTicketType(updated));

  if (loading) return <PageLoader label="Cargando…" />;
  if (error || !ticketType) return <TicketTypeNotFound error={error} />;
  const caps = ticketType.capabilities;

  return (
    <>
      <Link to="/configuracion/tipos-solicitud" className="back-link">
        <ArrowLeft aria-hidden="true" /> Volver a tipos de solicitud
      </Link>
      <section className="card profile">
        <div className="profile__main">
          <span className="dept-mark" aria-hidden="true">
            {ticketType.department.code.slice(0, 3)}
          </span>
          <div style={{ minWidth: 0 }}>
            <h1 className="profile__name">{ticketType.name}</h1>
            <p className="profile__email">
              {ticketType.department.name}
              {ticketType.category ? ` › ${ticketType.category.name}` : ''}
            </p>
            <div className="profile__badges">
              <CodeBadge>{ticketType.code}</CodeBadge>
              <PriorityBadge value={ticketType.defaultPriority} />
              <StatusBadge status={ticketType.status} />
            </div>
          </div>
        </div>
        <div className="profile__actions">
          {caps.editForm && (
            <Button variant="primary" icon={FormInput} onClick={() => navigate(`/configuracion/formularios/${ticketType.id}`)}>
              Diseñar formulario
            </Button>
          )}
          {caps.update && (
            <Button icon={Pencil} onClick={() => navigate(`/configuracion/tipos-solicitud/${ticketType.id}/editar`)}>
              Editar
            </Button>
          )}
          {caps.changeStatus && (
            <Button icon={ticketType.status === 'active' ? PowerOff : Power} onClick={() => toggle(ticketType)}>
              {ticketType.status === 'active' ? 'Desactivar' : 'Activar'}
            </Button>
          )}
        </div>
      </section>

      {ticketType.status === 'active' && ticketType.activeFieldsCount === 0 && (
        <div style={{ marginTop: 16 }}>
          <Alert tone="warning" title="El formulario está vacío">
            Agrega al menos un campo para que los usuarios puedan describir su solicitud.
          </Alert>
        </div>
      )}

      <div className="detail-grid detail-grid--wide">
        <Card title="Configuración">
          <dl className="details">
            <div><dt>Departamento</dt><dd>{ticketType.department.name}</dd></div>
            <div><dt>Categoría</dt><dd>{ticketType.category?.name ?? <span className="muted">Sin categoría</span>}</dd></div>
            <div><dt>Código</dt><dd><CodeBadge>{ticketType.code}</CodeBadge></dd></div>
            <div><dt>Descripción</dt><dd>{ticketType.description || '—'}</dd></div>
            <div><dt>Prioridad predeterminada</dt><dd><PriorityBadge value={ticketType.defaultPriority} /></dd></div>
            <div><dt>Responsable</dt><dd><AssigneeText type={ticketType} /></dd></div>
            <div><dt>Orden de aparición</dt><dd className="tabular">{ticketType.sortOrder}</dd></div>
            <div><dt>Campos</dt><dd className="tabular">{ticketType.activeFieldsCount} activos de {ticketType.fieldsCount}</dd></div>
            <div><dt>Versión del formulario</dt><dd className="tabular">v{ticketType.formVersion}{ticketType.formUpdatedAt ? ` · ${formatDateTime(ticketType.formUpdatedAt)}` : ''}</dd></div>
            <div><dt>Creado</dt><dd>{formatDateTime(ticketType.createdAt)}</dd></div>
          </dl>
        </Card>
        <FormPreviewCard ticketType={ticketType} />
      </div>
    </>
  );
}
