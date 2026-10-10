import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  FilterX,
  GripVertical,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RotateCw,
  Search,
  SearchX,
  Tags,
} from 'lucide-react';
import { categoriesService } from '../../services/catalogService';
import { Modal, useModalIds } from '../../components/ui/Modal';
import {
  Alert,
  Button,
  Card,
  CodeBadge,
  EmptyState,
  IconButton,
  PageHeader,
  PageLoader,
  SelectField,
  StatusBadge,
  TextAreaField,
  TextField,
} from '../../components/ui';
import { useAuth, useConfirm, useDebounce, useDocumentTitle, useToast } from '../../hooks';
import { useSortable } from '../../hooks/useSortable';
import { PERMISSIONS } from '../../utils/permissions';

/** Sustituye las categorías de un departamento manteniendo la posición del grupo. */
function replaceGroup(items, departmentId, next) {
  const out = [];
  let inserted = false;
  for (const c of items) {
    if (c.departmentId !== departmentId) out.push(c);
    else if (!inserted) {
      out.push(...next);
      inserted = true;
    }
  }
  return out;
}

function CategoryModal({ category, departments, defaultDepartmentId, onClose, onSaved }) {
  const { titleId } = useModalIds();
  const isEdit = Boolean(category);
  const [form, setForm] = useState({
    departmentId: String(category?.departmentId ?? defaultDepartmentId ?? departments[0]?.id ?? ''),
    name: category?.name ?? '',
    description: category?.description ?? '',
    status: category?.status ?? 'active',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const update = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: null }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.departmentId) next.departmentId = 'Selecciona un departamento';
    if (form.name.trim().length < 2) next.name = 'El nombre debe tener al menos 2 caracteres';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || null };
      const { category: saved } = isEdit
        ? await categoriesService.update(category.id, payload)
        : await categoriesService.create({ ...payload, departmentId: Number(form.departmentId), status: form.status });
      onSaved(saved, isEdit);
    } catch (err) {
      setErrors(err.details ?? {});
      setFormError(err.message);
      setSaving(false);
    }
  };

  return (
    <Modal onClose={saving ? undefined : onClose} labelledBy={titleId} maxWidth={520}>
      <form onSubmit={submit} noValidate>
        <div className="modal__body form-stack">
          <h2 className="modal__title" id={titleId}>
            {isEdit ? 'Editar categoría' : 'Nueva categoría'}
          </h2>
          {formError && <Alert tone="error" title={formError} />}
          <SelectField
            label="Departamento"
            value={form.departmentId}
            onChange={update('departmentId')}
            options={departments.map((d) => ({ value: String(d.id), label: `${d.name} (${d.code})` }))}
            placeholder="Selecciona un departamento"
            error={errors.departmentId}
            hint={isEdit ? 'El departamento de una categoría no se puede cambiar.' : undefined}
            disabled={isEdit || saving}
            required
          />
          <TextField label="Nombre" value={form.name} onChange={update('name')} error={errors.name} maxLength={100} placeholder="Hardware" autoFocus required disabled={saving} />
          <TextAreaField
            label="Descripción"
            value={form.description}
            onChange={update('description')}
            error={errors.description}
            maxLength={300}
            rows={2}
            placeholder="Equipos de cómputo, impresoras y periféricos"
            disabled={saving}
          />
        </div>
        <div className="modal__footer">
          <Button onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving} icon={isEdit ? undefined : Plus}>
            {isEdit ? 'Guardar cambios' : 'Crear categoría'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DepartmentGroup({ group, canReorder, canEdit, canToggle, onEdit, onToggle, onReorder, onCreate, canCreate }) {
  const sortable = useSortable(group.items, onReorder, { disabled: !canReorder });
  return (
    <Card
      title={
        <span className="group-title">
          {group.department.name} <CodeBadge>{group.department.code}</CodeBadge>
        </span>
      }
      subtitle={`${group.items.length} categoría${group.items.length === 1 ? '' : 's'}`}
      bodyClassName=""
      actions={
        canCreate && (
          <Button size="sm" variant="ghost" icon={Plus} onClick={() => onCreate(group.department.id)}>
            Agregar
          </Button>
        )
      }
    >
      <ul className="sortable-list">
        {group.items.map((c, i) => (
          <li key={c.id} className="sortable-row" {...sortable.rowProps(i)}>
            {canReorder && (
              <span className="drag-handle" title="Arrastra para ordenar" {...sortable.handleProps(i)}>
                <GripVertical />
              </span>
            )}
            <span className="sortable-row__order tabular">{i + 1}</span>
            <div className="sortable-row__main">
              <p className="sortable-row__title">{c.name}</p>
              {c.description && <p className="sortable-row__meta">{c.description}</p>}
            </div>
            <Link to={`/configuracion/tipos-solicitud?departamento=${c.departmentId}&categoria=${c.id}`} className="sortable-row__count">
              {c.activeTypesCount}/{c.typesCount} tipos
            </Link>
            <StatusBadge status={c.status} />
            <div className="row-actions">
              {canReorder && (
                <>
                  <IconButton icon={ChevronUp} label={`Subir ${c.name}`} disabled={i === 0} onClick={() => sortable.move(i, i - 1)} />
                  <IconButton
                    icon={ChevronDown}
                    label={`Bajar ${c.name}`}
                    disabled={i === group.items.length - 1}
                    onClick={() => sortable.move(i, i + 1)}
                  />
                </>
              )}
              {canEdit && <IconButton icon={Pencil} label={`Editar ${c.name}`} onClick={() => onEdit(c)} />}
              {canToggle && (
                <IconButton
                  icon={c.status === 'active' ? PowerOff : Power}
                  className={c.status === 'active' ? '' : 'text-success'}
                  label={c.status === 'active' ? `Desactivar ${c.name}` : `Activar ${c.name}`}
                  onClick={() => onToggle(c)}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function CategoriesPage() {
  useDocumentTitle('Categorías');
  const { hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const departmentId = params.get('departamento') ?? '';
  const status = params.get('estado') ?? '';

  const [searchInput, setSearchInput] = useState(search);
  const debounced = useDebounce(searchInput.trim());
  const [departments, setDepartments] = useState(null);
  const [state, setState] = useState({ key: null, items: null, scope: null, error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState(null); // { category?, departmentId? }

  const setFilter = useCallback(
    (key, value) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  useEffect(() => {
    if (debounced !== search) setFilter('q', debounced);
  }, [debounced, search, setFilter]);

  useEffect(() => {
    const c = new AbortController();
    categoriesService
      .scopeDepartments({ signal: c.signal })
      .then((d) => setDepartments(d.departments))
      .catch((err) => err.name !== 'AbortError' && setDepartments([]));
    return () => c.abort();
  }, []);

  const requestKey = `${search}|${departmentId}|${status}|${reloadKey}`;
  useEffect(() => {
    const c = new AbortController();
    const [q, dep, st] = requestKey.split('|');
    categoriesService
      .list({ search: q, departmentId: dep, status: st }, { signal: c.signal })
      .then((d) => setState({ key: requestKey, items: d.items, scope: d.scope, error: null }))
      .catch((err) => err.name !== 'AbortError' && setState((s) => ({ ...s, key: requestKey, error: err.message })));
    return () => c.abort();
  }, [requestKey]);

  const loading = state.key !== requestKey;
  const reload = () => setReloadKey((k) => k + 1);
  const hasFilters = Boolean(search || departmentId || status);
  // Solo se puede reordenar viendo la lista completa de cada departamento.
  const canReorder = hasPermission(PERMISSIONS.CATEGORIES_UPDATE) && !search && !status;
  const canCreate = hasPermission(PERMISSIONS.CATEGORIES_CREATE) && departments?.length > 0;

  const groups = useMemo(() => {
    const map = new Map();
    for (const c of state.items ?? []) {
      if (!map.has(c.departmentId)) map.set(c.departmentId, { department: c.department, items: [] });
      map.get(c.departmentId).items.push(c);
    }
    return [...map.values()];
  }, [state.items]);

  const reorder = async (group, next) => {
    // Actualización optimista: se muestra el nuevo orden y se revierte si falla.
    const prevItems = state.items;
    setState((s) => ({ ...s, items: replaceGroup(s.items, group.department.id, next) }));
    try {
      const res = await categoriesService.reorder(group.department.id, next.map((c) => c.id));
      setState((s) => ({ ...s, items: replaceGroup(s.items, group.department.id, res.items) }));
      toast.success('Orden actualizado', group.department.name);
    } catch (err) {
      setState((s) => ({ ...s, items: prevItems }));
      toast.error('No se pudo reordenar', err.message);
    }
  };

  const toggle = (c) => {
    const activating = c.status !== 'active';
    return confirm({
      tone: activating ? 'info' : 'warning',
      icon: activating ? Power : PowerOff,
      title: activating ? `¿Activar la categoría ${c.name}?` : `¿Desactivar la categoría ${c.name}?`,
      message: activating
        ? 'Sus tipos de solicitud activos volverán a mostrarse a los usuarios.'
        : `Sus ${c.typesCount} tipo(s) de solicitud dejarán de mostrarse a los usuarios. No se elimina ninguna información.`,
      confirmLabel: activating ? 'Activar' : 'Desactivar',
      onConfirm: async () => {
        try {
          await categoriesService.changeStatus(c.id, activating ? 'active' : 'inactive');
          toast.success(activating ? 'Categoría activada' : 'Categoría desactivada', c.name);
          reload();
        } catch (err) {
          toast.error('No se pudo cambiar el estado', err.message);
          throw err;
        }
      },
    });
  };

  if (!departments) return <PageLoader label="Cargando categorías…" />;

  return (
    <>
      <PageHeader
        title="Categorías"
        subtitle={
          state.scope === 'managed'
            ? 'Categorías de los departamentos de los que eres responsable.'
            : 'Agrupan los tipos de solicitud de cada departamento. Arrastra para definir el orden en que se muestran.'
        }
        actions={
          canCreate && (
            <Button variant="primary" icon={Plus} onClick={() => setModal({ departmentId: departmentId || undefined })}>
              Nueva categoría
            </Button>
          )
        }
      />

      <section className="card filters-card">
        <div className="toolbar">
          <div className="toolbar__search">
            <Search className="input-wrap__icon" aria-hidden="true" />
            <input
              type="search"
              className="input input--with-icon"
              placeholder="Buscar categoría…"
              aria-label="Buscar categorías"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={100}
            />
          </div>
          <select className="select toolbar__select" aria-label="Filtrar por departamento" value={departmentId} onChange={(e) => setFilter('departamento', e.target.value)}>
            <option value="">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className="select toolbar__select" aria-label="Filtrar por estado" value={status} onChange={(e) => setFilter('estado', e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
          {hasFilters && (
            <Button
              variant="ghost"
              icon={FilterX}
              onClick={() => {
                setSearchInput('');
                setParams({}, { replace: true });
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
        {hasPermission(PERMISSIONS.CATEGORIES_UPDATE) && (search || status) && (
          <p className="toolbar__note">Para reordenar, quita la búsqueda y el filtro de estado.</p>
        )}
      </section>

      {state.error ? (
        <Alert tone="error" title="No se pudieron cargar las categorías">
          {state.error}{' '}
          <Button size="sm" variant="ghost" icon={RotateCw} onClick={reload}>
            Reintentar
          </Button>
        </Alert>
      ) : loading && !state.items ? (
        <PageLoader label="Cargando categorías…" />
      ) : groups.length === 0 ? (
        <section className="card">
          {hasFilters ? (
            <EmptyState icon={SearchX} title="Sin resultados" text="Ninguna categoría coincide con los filtros." />
          ) : departments.length === 0 ? (
            <EmptyState
              icon={Tags}
              title={state.scope === 'managed' ? 'No eres responsable de ningún departamento' : 'No hay departamentos activos'}
              text={
                state.scope === 'managed'
                  ? 'Solo puedes configurar categorías de los departamentos que tienes a cargo.'
                  : 'Crea un departamento antes de configurar sus categorías.'
              }
            />
          ) : (
            <EmptyState
              icon={Tags}
              title="Aún no hay categorías"
              text="Crea categorías como Hardware, Software o Vacaciones para organizar las solicitudes de cada departamento."
              action={
                canCreate && (
                  <Button variant="primary" icon={Plus} onClick={() => setModal({})}>
                    Nueva categoría
                  </Button>
                )
              }
            />
          )}
        </section>
      ) : (
        <div className="group-stack" aria-busy={loading}>
          {groups.map((g) => (
            <DepartmentGroup
              key={g.department.id}
              group={g}
              canReorder={canReorder}
              canEdit={hasPermission(PERMISSIONS.CATEGORIES_UPDATE)}
              canToggle={hasPermission(PERMISSIONS.CATEGORIES_CHANGE_STATUS)}
              canCreate={canCreate && departments.some((d) => d.id === g.department.id)}
              onCreate={(depId) => setModal({ departmentId: depId })}
              onEdit={(c) => setModal({ category: c })}
              onToggle={toggle}
              onReorder={(next) => reorder(g, next)}
            />
          ))}
        </div>
      )}

      {modal && (
        <CategoryModal
          category={modal.category}
          departments={departments}
          defaultDepartmentId={modal.departmentId}
          onClose={() => setModal(null)}
          onSaved={(saved, isEdit) => {
            setModal(null);
            toast.success(isEdit ? 'Categoría actualizada' : 'Categoría creada correctamente.', saved.name);
            reload();
          }}
        />
      )}
    </>
  );
}
