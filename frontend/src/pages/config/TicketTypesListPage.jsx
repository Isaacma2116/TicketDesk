import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  FilterX,
  FormInput,
  GripVertical,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RotateCw,
  Search,
  SearchX,
  Shapes,
} from 'lucide-react';
import { categoriesService, ticketTypesService } from '../../services/catalogService';
import { Alert, Badge, Button, CodeBadge, EmptyState, IconButton, PageHeader, Pagination, Skeleton, StatusBadge } from '../../components/ui';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { priorityOf } from '../../components/forms/fieldTypes';
import { useAuth, useConfirm, useDocumentTitle, useToast } from '../../hooks';
import { useListQuery } from '../../hooks/useListQuery';
import { useSortable } from '../../hooks/useSortable';
import { PERMISSIONS } from '../../utils/permissions';

const PARAMS = {
  search: ['q', ''],
  departmentId: ['departamento', ''],
  categoryId: ['categoria', ''],
  status: ['estado', ''],
  sortBy: ['orden', 'order'],
  sortDir: ['dir', 'asc'],
};

export function PriorityBadge({ value }) {
  const p = priorityOf(value);
  return <Badge tone={p.tone}>{p.label}</Badge>;
}

export function AssigneeText({ type }) {
  if (type.assignmentMode === 'user' && type.assignee) {
    return (
      <span>
        {type.assignee.fullName}
        {type.assignee.status !== 'active' && <span className="cell-user__meta"> (inactivo)</span>}
      </span>
    );
  }
  return <span className="muted">Agentes del departamento</span>;
}

export function useTicketTypeToggle(onDone) {
  const confirm = useConfirm();
  const toast = useToast();
  return (t) => {
    const activating = t.status !== 'active';
    return confirm({
      tone: activating ? 'info' : 'warning',
      icon: activating ? Power : PowerOff,
      title: activating ? `¿Activar "${t.name}"?` : `¿Desactivar "${t.name}"?`,
      message: activating
        ? 'Volverá a estar disponible para que los usuarios creen solicitudes.'
        : 'Los usuarios ya no podrán elegirlo al crear solicitudes. Su formulario y configuración se conservan.',
      confirmLabel: activating ? 'Activar' : 'Desactivar',
      onConfirm: async () => {
        try {
          const { ticketType } = await ticketTypesService.changeStatus(t.id, activating ? 'active' : 'inactive');
          toast.success(activating ? 'Tipo activado' : 'Tipo desactivado', t.name);
          onDone?.(ticketType);
        } catch (err) {
          toast.error('No se pudo cambiar el estado', err.message);
          throw err;
        }
      },
    });
  };
}

export default function TicketTypesListPage() {
  useDocumentTitle('Tipos de solicitud');
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const list = useListQuery(ticketTypesService.list, PARAMS, { pageSize: 50 });
  const { filters, data, loading, error } = list;
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [localOrder, setLocalOrder] = useState(null);
  const toggle = useTicketTypeToggle(list.reload);

  useEffect(() => {
    const c = new AbortController();
    categoriesService
      .scopeDepartments({ signal: c.signal })
      .then((d) => setDepartments(d.departments))
      .catch(() => {});
    return () => c.abort();
  }, []);

  useEffect(() => {
    if (!filters.departmentId) return undefined;
    const c = new AbortController();
    categoriesService
      .list({ departmentId: filters.departmentId }, { signal: c.signal })
      .then((d) => setCategories(d.items))
      .catch(() => {});
    return () => c.abort();
  }, [filters.departmentId]);

  const items = localOrder ?? data?.items ?? [];
  // Reordenar solo tiene sentido viendo TODOS los tipos de un departamento en su orden.
  const canReorder =
    hasPermission(PERMISSIONS.TICKET_TYPES_UPDATE) &&
    filters.departmentId &&
    !filters.search &&
    !filters.status &&
    !filters.categoryId &&
    filters.sortBy === 'order' &&
    filters.sortDir === 'asc' &&
    data?.pagination.totalPages === 1;

  const sortable = useSortable(
    items,
    async (next) => {
      setLocalOrder(next);
      try {
        await ticketTypesService.reorder(Number(filters.departmentId), next.map((t) => t.id));
        toast.success('Orden actualizado');
        list.reload();
      } catch (err) {
        toast.error('No se pudo reordenar', err.message);
      } finally {
        setLocalOrder(null);
      }
    },
    { disabled: !canReorder },
  );

  const canCreate = hasPermission(PERMISSIONS.TICKET_TYPES_CREATE) && departments.length > 0;
  const sort = { sortBy: filters.sortBy, sortDir: filters.sortDir, onSort: list.toggleSort };

  return (
    <>
      <PageHeader
        title="Tipos de solicitud"
        subtitle="Lo que los usuarios eligen al crear una solicitud. Cada tipo tiene su propio formulario."
        actions={
          canCreate && (
            <Link to={`/configuracion/tipos-solicitud/nuevo${filters.departmentId ? `?departamento=${filters.departmentId}` : ''}`} className="btn btn--primary">
              <Plus aria-hidden="true" /> Nuevo tipo
            </Link>
          )
        }
      />

      <section className="card">
        <div className="toolbar">
          <div className="toolbar__search">
            <Search className="input-wrap__icon" aria-hidden="true" />
            <input
              type="search"
              className="input input--with-icon"
              placeholder="Buscar por nombre o código…"
              aria-label="Buscar tipos de solicitud"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
              maxLength={100}
            />
          </div>
          <select
            className="select toolbar__select"
            aria-label="Filtrar por departamento"
            value={filters.departmentId}
            onChange={(e) => list.setFilter({ departmentId: e.target.value, categoryId: '' })}
          >
            <option value="">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            className="select toolbar__select"
            aria-label="Filtrar por categoría"
            value={filters.categoryId}
            onChange={(e) => list.setFilter({ categoryId: e.target.value })}
            disabled={!filters.departmentId}
            title={!filters.departmentId ? 'Elige primero un departamento' : undefined}
          >
            <option value="">Todas las categorías</option>
            <option value="none">Sin categoría</option>
            {filters.departmentId &&
              categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <select className="select toolbar__select" aria-label="Filtrar por estado" value={filters.status} onChange={(e) => list.setFilter({ status: e.target.value })}>
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
          {list.hasFilters && (
            <Button variant="ghost" icon={FilterX} onClick={list.clearFilters}>
              Limpiar
            </Button>
          )}
        </div>
        {hasPermission(PERMISSIONS.TICKET_TYPES_UPDATE) && !canReorder && (
          <p className="toolbar__note">Para cambiar el orden de aparición, filtra por un departamento (sin búsqueda ni otros filtros).</p>
        )}

        {error ? (
          <div style={{ padding: 20 }}>
            <Alert tone="error" title="No se pudieron cargar los tipos de solicitud">
              {error}{' '}
              <Button size="sm" variant="ghost" icon={RotateCw} onClick={list.reload}>
                Reintentar
              </Button>
            </Alert>
          </div>
        ) : !loading && items.length === 0 ? (
          list.hasFilters ? (
            <EmptyState icon={SearchX} title="Sin resultados" text="Ningún tipo de solicitud coincide con los filtros." action={<Button icon={FilterX} onClick={list.clearFilters}>Limpiar filtros</Button>} />
          ) : (
            <EmptyState
              icon={Shapes}
              title={data?.scope === 'managed' && !departments.length ? 'No eres responsable de ningún departamento' : 'Aún no hay tipos de solicitud'}
              text="Crea tipos como «Problema con computadora» o «Solicitud de vacaciones» y diseña su formulario."
              action={
                canCreate && (
                  <Link to="/configuracion/tipos-solicitud/nuevo" className="btn btn--primary">
                    <Plus aria-hidden="true" /> Nuevo tipo
                  </Link>
                )
              }
            />
          )
        ) : (
          <div className="table-wrap" aria-busy={loading}>
            <table className="table table--responsive">
              <thead>
                <tr>
                  {canReorder && <th scope="col" className="col-handle"><span className="sr-only">Orden</span></th>}
                  <SortableHeader column="name" label="Nombre" {...sort} />
                  <SortableHeader column="department" label="Departamento" {...sort} />
                  <th scope="col">Categoría</th>
                  <SortableHeader column="priority" label="Prioridad" {...sort} />
                  <th scope="col">Responsable</th>
                  <SortableHeader column="fields" label="Campos" {...sort} />
                  <SortableHeader column="status" label="Estado" {...sort} />
                  <th scope="col" className="col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data
                  ? Array.from({ length: 5 }, (_, i) => (
                      <tr key={i} aria-hidden="true">
                        {Array.from({ length: 8 }, (__, j) => (
                          <td key={j}>
                            <Skeleton width={j === 0 ? 160 : 80} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : items.map((t, i) => (
                      <tr key={t.id} {...sortable.rowProps(i)} style={loading ? { opacity: 0.55 } : undefined}>
                        {canReorder && (
                          <td className="col-handle">
                            <span className="drag-handle" title="Arrastra para ordenar" {...sortable.handleProps(i)}>
                              <GripVertical />
                            </span>
                          </td>
                        )}
                        <td className="cell-primary">
                          <div className="cell-dept">
                            <Link to={`/configuracion/tipos-solicitud/${t.id}`} className="cell-user__name">
                              {t.name}
                            </Link>
                            <CodeBadge>{t.code}</CodeBadge>
                          </div>
                        </td>
                        <td data-label="Departamento">{t.department.name}</td>
                        <td data-label="Categoría">
                          {t.category ? (
                            <span>
                              {t.category.name}
                              {t.category.status === 'inactive' && <span className="cell-user__meta"> (inactiva)</span>}
                            </span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td data-label="Prioridad">
                          <PriorityBadge value={t.defaultPriority} />
                        </td>
                        <td data-label="Responsable">
                          <AssigneeText type={t} />
                        </td>
                        <td data-label="Campos" className="tabular">
                          {t.activeFieldsCount}
                          {t.fieldsCount !== t.activeFieldsCount && <span className="muted">/{t.fieldsCount}</span>}
                        </td>
                        <td data-label="Estado">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="col-actions">
                          <div className="row-actions">
                            {canReorder && (
                              <>
                                <IconButton icon={ChevronUp} label={`Subir ${t.name}`} disabled={i === 0} onClick={() => sortable.move(i, i - 1)} />
                                <IconButton icon={ChevronDown} label={`Bajar ${t.name}`} disabled={i === items.length - 1} onClick={() => sortable.move(i, i + 1)} />
                              </>
                            )}
                            <IconButton icon={Eye} label={`Ver ${t.name}`} onClick={() => navigate(`/configuracion/tipos-solicitud/${t.id}`)} />
                            {t.capabilities.viewForm && (
                              <IconButton icon={FormInput} label={`Formulario de ${t.name}`} onClick={() => navigate(`/configuracion/formularios/${t.id}`)} />
                            )}
                            {t.capabilities.update && (
                              <IconButton icon={Pencil} label={`Editar ${t.name}`} onClick={() => navigate(`/configuracion/tipos-solicitud/${t.id}/editar`)} />
                            )}
                            {t.capabilities.changeStatus && (
                              <IconButton
                                icon={t.status === 'active' ? PowerOff : Power}
                                className={t.status === 'active' ? '' : 'text-success'}
                                label={t.status === 'active' ? `Desactivar ${t.name}` : `Activar ${t.name}`}
                                onClick={() => toggle(t)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {data && !error && data.pagination.total > 0 && (
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            pageSize={data.pagination.pageSize}
            onChange={(p) => list.setFilter({ page: p > 1 ? p : '' }, false)}
          />
        )}
      </section>
    </>
  );
}
