import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Hash, Plus, Save, Shapes } from 'lucide-react';
import { categoriesService, ticketTypesService } from '../../services/catalogService';
import { Alert, Button, EmptyState, PageHeader, PageLoader, SelectField, TextAreaField, TextField } from '../../components/ui';
import { PRIORITIES } from '../../components/forms/fieldTypes';
import { useDocumentTitle, useToast } from '../../hooks';
import { ForbiddenPage } from '../errors/ErrorPages';

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]*$/;

/** Carga un tipo de solicitud por el :id de la URL. */
export function useTicketTypeFromRoute() {
  const { id } = useParams();
  const [state, setState] = useState({ loadedId: null, ticketType: null, error: null });
  useEffect(() => {
    const c = new AbortController();
    ticketTypesService
      .get(id, { signal: c.signal })
      .then((d) => setState({ loadedId: id, ticketType: d.ticketType, error: null }))
      .catch((err) => err.name !== 'AbortError' && setState({ loadedId: id, ticketType: null, error: err }));
    return () => c.abort();
  }, [id]);
  const loading = state.loadedId !== id;
  return {
    loading,
    ticketType: loading ? null : state.ticketType,
    error: loading ? null : state.error,
    setTicketType: (ticketType) => setState((s) => ({ ...s, ticketType })),
  };
}

export function TicketTypeNotFound({ error }) {
  if (error?.status === 403) return <ForbiddenPage />;
  return (
    <div className="card error-page">
      <EmptyState
        icon={Shapes}
        title={error?.status === 404 || error?.status === 400 ? 'Tipo de solicitud no encontrado' : 'No se pudo cargar'}
        text={error?.status === 404 || error?.status === 400 ? 'Es posible que no exista o que no tengas acceso.' : error?.message}
        action={
          <Link to="/configuracion/tipos-solicitud" className="btn btn--primary">
            <ArrowLeft aria-hidden="true" /> Volver a tipos de solicitud
          </Link>
        }
      />
    </div>
  );
}

function TicketTypeForm({ initial, defaultDepartmentId, onSubmit, onCancel }) {
  const isEdit = Boolean(initial);
  const [departments, setDepartments] = useState(null);
  const [categories, setCategories] = useState([]);
  const [assignees, setAssignees] = useState(null);
  const [form, setForm] = useState({
    departmentId: String(initial?.departmentId ?? defaultDepartmentId ?? ''),
    categoryId: initial?.category ? String(initial.category.id) : '',
    name: initial?.name ?? '',
    code: initial?.code ?? '',
    description: initial?.description ?? '',
    defaultPriority: initial?.defaultPriority ?? 'medium',
    assignmentMode: initial?.assignmentMode ?? 'department',
    assigneeUserId: initial?.assignee ? String(initial.assignee.id) : '',
    status: initial?.status ?? 'active',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    categoriesService
      .scopeDepartments({ signal: c.signal })
      .then((d) => setDepartments(d.departments))
      .catch(() => setDepartments([]));
    return () => c.abort();
  }, []);

  // Categorías y posibles responsables dependen del departamento.
  useEffect(() => {
    if (!form.departmentId) return undefined;
    const c = new AbortController();
    categoriesService
      .list({ departmentId: form.departmentId }, { signal: c.signal })
      .then((d) => setCategories(d.items))
      .catch(() => setCategories([]));
    ticketTypesService
      .assigneeOptions(form.departmentId, { signal: c.signal })
      .then((d) => setAssignees(d.users))
      .catch(() => setAssignees([]));
    return () => c.abort();
  }, [form.departmentId]);

  const update = (k) => (e) => {
    let value = e.target.value;
    if (k === 'code') value = value.toUpperCase().replace(/\s+/g, '');
    setForm((f) => ({
      ...f,
      [k]: value,
      ...(k === 'departmentId' ? { categoryId: '', assigneeUserId: '' } : {}),
    }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: null }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.departmentId) next.departmentId = 'Selecciona un departamento';
    if (form.name.trim().length < 2) next.name = 'El nombre debe tener al menos 2 caracteres';
    if (form.code.trim().length < 2) next.code = 'El código debe tener al menos 2 caracteres';
    else if (!CODE_RE.test(form.code.trim())) next.code = 'Usa solo letras sin acentos, números, guion o guion bajo';
    if (form.assignmentMode === 'user' && !form.assigneeUserId) next.assigneeUserId = 'Selecciona un responsable';
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = {
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim() || null,
      defaultPriority: form.defaultPriority,
      assignmentMode: form.assignmentMode,
      assigneeUserId: form.assignmentMode === 'user' ? Number(form.assigneeUserId) : null,
      status: form.status,
    };
    if (!isEdit) payload.departmentId = Number(form.departmentId);
    setSaving(true);
    setFormError(null);
    try {
      await onSubmit(payload);
    } catch (err) {
      setErrors(err.details ?? {});
      setFormError(err.message);
      setSaving(false);
    }
  };

  if (!departments) return <PageLoader label="Cargando…" />;
  if (!isEdit && !departments.length) {
    return (
      <EmptyState
        icon={Shapes}
        title="No hay departamentos disponibles"
        text="Necesitas un departamento activo (del que seas responsable, si eres supervisor) para crear tipos de solicitud."
      />
    );
  }

  const categoryOptions = categories
    .filter((c) => c.status === 'active' || String(c.id) === form.categoryId)
    .map((c) => ({ value: String(c.id), label: c.status === 'active' ? c.name : `${c.name} (inactiva)`, disabled: c.status !== 'active' }));
  const currentAssigneeMissing = initial?.assignee && assignees && !assignees.some((u) => u.id === initial.assignee.id);
  const assigneeOptions = [
    ...(currentAssigneeMissing ? [{ value: String(initial.assignee.id), label: `${initial.assignee.fullName} (ya no válido)`, disabled: true }] : []),
    ...(assignees ?? []).map((u) => ({ value: String(u.id), label: `${u.fullName} · ${u.role.name}${u.isAgent ? ' · agente' : ''}` })),
  ];
  // En edición el departamento puede no estar en la lista (p. ej. inactivo).
  const departmentOptions = departments.map((d) => ({ value: String(d.id), label: `${d.name} (${d.code})` }));
  if (isEdit && !departments.some((d) => d.id === initial.departmentId)) {
    departmentOptions.unshift({ value: String(initial.departmentId), label: initial.department.name });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-section">
        {formError && <Alert tone="error" title={formError} />}
        <div className="form-section__head">
          <h3>Identificación</h3>
          <p>Cómo verán este tipo los usuarios al crear una solicitud.</p>
        </div>
        <div className="form-grid">
          <SelectField
            label="Departamento"
            value={form.departmentId}
            onChange={update('departmentId')}
            options={departmentOptions}
            placeholder="Selecciona un departamento"
            error={errors.departmentId}
            hint={isEdit ? 'El departamento no se puede cambiar: el formulario y el responsable dependen de él.' : undefined}
            disabled={isEdit || saving}
            required
          />
          <SelectField
            label="Categoría"
            value={form.categoryId}
            onChange={update('categoryId')}
            options={categoryOptions}
            placeholder={form.departmentId ? 'Sin categoría' : 'Elige primero un departamento'}
            error={errors.categoryId}
            hint={form.departmentId && !categoryOptions.length ? 'Este departamento aún no tiene categorías activas.' : undefined}
            disabled={!form.departmentId || saving}
          />
          <TextField label="Nombre" value={form.name} onChange={update('name')} error={errors.name} maxLength={120} placeholder="Problema con computadora" required disabled={saving} autoFocus />
          <TextField
            label="Código"
            icon={Hash}
            value={form.code}
            onChange={update('code')}
            error={errors.code}
            maxLength={30}
            placeholder="TI-PC"
            hint="Único dentro del departamento."
            autoComplete="off"
            required
            disabled={saving}
          />
          <div className="span-2">
            <TextAreaField
              label="Descripción"
              value={form.description}
              onChange={update('description')}
              error={errors.description}
              maxLength={500}
              rows={3}
              placeholder="Equipo que no enciende, pantalla dañada, lentitud…"
              disabled={saving}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__head">
          <h3>Atención</h3>
          <p>Prioridad inicial y quién atenderá las solicitudes de este tipo.</p>
        </div>
        <div className="form-grid">
          <SelectField
            label="Prioridad predeterminada"
            value={form.defaultPriority}
            onChange={update('defaultPriority')}
            options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))}
            error={errors.defaultPriority}
            disabled={saving}
          />
          <div className="field">
            <span className="field__label">Estado</span>
            <div className="segmented" role="radiogroup" aria-label="Estado">
              {[
                ['active', 'Activo'],
                ['inactive', 'Inactivo'],
              ].map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name="status" value={value} checked={form.status === value} onChange={update('status')} disabled={saving} />
                  {label}
                </label>
              ))}
            </div>
            <p className="field__hint">Un tipo inactivo no aparece al crear solicitudes.</p>
          </div>
          <div className="span-2 choice-list" role="radiogroup" aria-label="Responsable">
            <label className="choice">
              <input type="radio" name="assignmentMode" value="department" checked={form.assignmentMode === 'department'} onChange={update('assignmentMode')} disabled={saving} />
              <span>
                <span className="choice__title">Grupo: agentes del departamento</span>
                <span className="choice__text">Cualquier agente del departamento podrá tomar la solicitud.</span>
              </span>
            </label>
            <label className="choice">
              <input type="radio" name="assignmentMode" value="user" checked={form.assignmentMode === 'user'} onChange={update('assignmentMode')} disabled={saving} />
              <span>
                <span className="choice__title">Responsable específico</span>
                <span className="choice__text">Las solicitudes se asignarán a una persona del departamento.</span>
              </span>
            </label>
          </div>
          {form.assignmentMode === 'user' && (
            <SelectField
              label="Responsable"
              value={form.assigneeUserId}
              onChange={update('assigneeUserId')}
              options={assigneeOptions}
              placeholder={!form.departmentId ? 'Elige primero un departamento' : assignees ? 'Selecciona un responsable' : 'Cargando…'}
              error={errors.assigneeUserId}
              hint={assignees && !assignees.length ? 'El departamento no tiene integrantes activos.' : 'Solo integrantes activos del departamento.'}
              disabled={!form.departmentId || saving}
              required
            />
          )}
        </div>
      </div>

      <div className="form-footer">
        <Button onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={saving} icon={isEdit ? Save : Plus}>
          {isEdit ? 'Guardar cambios' : 'Crear tipo de solicitud'}
        </Button>
      </div>
    </form>
  );
}

export function TicketTypeCreatePage() {
  useDocumentTitle('Nuevo tipo de solicitud');
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  return (
    <>
      <PageHeader
        back={
          <Link to="/configuracion/tipos-solicitud" className="back-link">
            <ArrowLeft aria-hidden="true" /> Volver a tipos de solicitud
          </Link>
        }
        title="Nuevo tipo de solicitud"
        subtitle="Después de crearlo podrás diseñar su formulario."
      />
      <section className="card form-card">
        <TicketTypeForm
          defaultDepartmentId={params.get('departamento')}
          onCancel={() => navigate('/configuracion/tipos-solicitud')}
          onSubmit={async (payload) => {
            const { ticketType } = await ticketTypesService.create(payload);
            toast.success('Tipo de solicitud creado correctamente.', 'Ahora diseña su formulario.');
            navigate(`/configuracion/formularios/${ticketType.id}`);
          }}
        />
      </section>
    </>
  );
}

export function TicketTypeEditPage() {
  useDocumentTitle('Editar tipo de solicitud');
  const navigate = useNavigate();
  const toast = useToast();
  const { loading, ticketType, error } = useTicketTypeFromRoute();
  if (loading) return <PageLoader label="Cargando…" />;
  if (error || !ticketType) return <TicketTypeNotFound error={error} />;
  if (!ticketType.capabilities.update) return <ForbiddenPage />;
  return (
    <>
      <PageHeader
        back={
          <Link to={`/configuracion/tipos-solicitud/${ticketType.id}`} className="back-link">
            <ArrowLeft aria-hidden="true" /> Volver al detalle
          </Link>
        }
        title="Editar tipo de solicitud"
        subtitle={`${ticketType.name} · ${ticketType.code}`}
      />
      <section className="card form-card">
        <TicketTypeForm
          initial={ticketType}
          onCancel={() => navigate(`/configuracion/tipos-solicitud/${ticketType.id}`)}
          onSubmit={async (payload) => {
            await ticketTypesService.update(ticketType.id, payload);
            toast.success('Cambios guardados', ticketType.name);
            navigate(`/configuracion/tipos-solicitud/${ticketType.id}`);
          }}
        />
      </section>
    </>
  );
}
