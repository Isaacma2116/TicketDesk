import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilterX, FormInput, RotateCw, Search, SearchX } from 'lucide-react';
import { categoriesService, ticketTypesService } from '../../services/catalogService';
import { Alert, Button, CodeBadge, EmptyState, PageHeader, Pagination, Skeleton, StatusBadge } from '../../components/ui';
import { useAuth, useDocumentTitle } from '../../hooks';
import { useListQuery } from '../../hooks/useListQuery';
import { formatDateTime } from '../../utils/format';
import { PERMISSIONS } from '../../utils/permissions';

const PARAMS = {
  search: ['q', ''],
  departmentId: ['departamento', ''],
  status: ['estado', ''],
  sortBy: ['orden', 'order'],
  sortDir: ['dir', 'asc'],
};

/** Formularios: un formulario por tipo de solicitud. */
export default function FormsListPage() {
  useDocumentTitle('Formularios');
  const { hasPermission } = useAuth();
  const list = useListQuery(ticketTypesService.list, PARAMS, { pageSize: 20 });
  const { filters, data, loading, error } = list;
  const [departments, setDepartments] = useState([]);
  const canEdit = hasPermission(PERMISSIONS.FORMS_UPDATE);

  useEffect(() => {
    const c = new AbortController();
    categoriesService.scopeDepartments({ signal: c.signal }).then((d) => setDepartments(d.departments)).catch(() => {});
    return () => c.abort();
  }, []);

  const items = data?.items ?? [];
  return (
    <>
      <PageHeader
        title="Formularios"
        subtitle="Cada tipo de solicitud tiene su formulario dinámico. Elige uno para diseñar sus campos."
      />
      <section className="card">
        <div className="toolbar">
          <div className="toolbar__search">
            <Search className="input-wrap__icon" aria-hidden="true" />
            <input
              type="search"
              className="input input--with-icon"
              placeholder="Buscar tipo de solicitud…"
              aria-label="Buscar formularios"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
              maxLength={100}
            />
          </div>
          <select className="select toolbar__select" aria-label="Filtrar por departamento" value={filters.departmentId} onChange={(e) => list.setFilter({ departmentId: e.target.value })}>
            <option value="">Todos los departamentos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className="select toolbar__select" aria-label="Filtrar por estado" value={filters.status} onChange={(e) => list.setFilter({ status: e.target.value })}>
            <option value="">Todos los estados</option>
            <option value="active">Tipos activos</option>
            <option value="inactive">Tipos inactivos</option>
          </select>
          {list.hasFilters && (
            <Button variant="ghost" icon={FilterX} onClick={list.clearFilters}>
              Limpiar
            </Button>
          )}
        </div>

        {error ? (
          <div style={{ padding: 20 }}>
            <Alert tone="error" title="No se pudieron cargar los formularios">
              {error}{' '}
              <Button size="sm" variant="ghost" icon={RotateCw} onClick={list.reload}>
                Reintentar
              </Button>
            </Alert>
          </div>
        ) : !loading && items.length === 0 ? (
          list.hasFilters ? (
            <EmptyState icon={SearchX} title="Sin resultados" text="Ningún formulario coincide con los filtros." />
          ) : (
            <EmptyState
              icon={FormInput}
              title="Aún no hay formularios"
              text="Los formularios pertenecen a un tipo de solicitud. Crea primero un tipo de solicitud."
              action={
                hasPermission(PERMISSIONS.TICKET_TYPES_CREATE) && (
                  <Link to="/configuracion/tipos-solicitud/nuevo" className="btn btn--primary">
                    Nuevo tipo de solicitud
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
                  <th scope="col">Tipo de solicitud</th>
                  <th scope="col">Departamento</th>
                  <th scope="col">Campos</th>
                  <th scope="col">Versión</th>
                  <th scope="col">Última modificación</th>
                  <th scope="col">Estado del tipo</th>
                  <th scope="col" className="col-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data
                  ? Array.from({ length: 4 }, (_, i) => (
                      <tr key={i} aria-hidden="true">
                        {Array.from({ length: 7 }, (__, j) => (
                          <td key={j}><Skeleton width={j === 0 ? 160 : 70} /></td>
                        ))}
                      </tr>
                    ))
                  : items.map((t) => (
                      <tr key={t.id} style={loading ? { opacity: 0.55 } : undefined}>
                        <td className="cell-primary">
                          <div className="cell-dept">
                            <Link to={`/configuracion/formularios/${t.id}`} className="cell-user__name">
                              {t.name}
                            </Link>
                            <CodeBadge>{t.code}</CodeBadge>
                          </div>
                        </td>
                        <td data-label="Departamento">{t.department.name}</td>
                        <td data-label="Campos" className="tabular">
                          {t.fieldsCount === 0 ? (
                            <span className="text-warning">Sin campos</span>
                          ) : (
                            <>
                              {t.activeFieldsCount} activos
                              {t.fieldsCount !== t.activeFieldsCount && <span className="muted"> / {t.fieldsCount}</span>}
                            </>
                          )}
                        </td>
                        <td data-label="Versión" className="tabular">v{t.formVersion}</td>
                        <td data-label="Modificado" className="muted">{t.formUpdatedAt ? formatDateTime(t.formUpdatedAt) : 'Nunca'}</td>
                        <td data-label="Estado"><StatusBadge status={t.status} /></td>
                        <td className="col-actions">
                          <Link to={`/configuracion/formularios/${t.id}`} className="btn btn--sm">
                            <FormInput aria-hidden="true" /> {canEdit ? 'Diseñar' : 'Ver'}
                          </Link>
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
