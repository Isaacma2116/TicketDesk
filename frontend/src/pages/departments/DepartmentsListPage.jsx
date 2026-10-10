import { Link, useNavigate } from 'react-router-dom';
import { Building2, Eye, FilterX, Pencil, Plus, Power, PowerOff, RotateCw, Search, SearchX, Trash2 } from 'lucide-react';
import { departmentsService } from '../../services/organizationService';
import {
  Alert,
  Avatar,
  Button,
  CodeBadge,
  EmptyState,
  IconButton,
  PageHeader,
  Pagination,
  Skeleton,
  StatusBadge,
} from '../../components/ui';
import { SortableHeader } from '../../components/ui/SortableHeader';
import { useAuth, useDocumentTitle } from '../../hooks';
import { useListQuery } from '../../hooks/useListQuery';
import { useDepartmentActions } from '../../hooks/useDepartmentActions';
import { formatDate } from '../../utils/format';
import { PERMISSIONS } from '../../utils/permissions';

const PARAMS = {
  search: ['q', ''],
  status: ['estado', ''],
  sortBy: ['orden', 'name'],
  sortDir: ['dir', 'asc'],
};

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, i) => (
    <tr key={i} aria-hidden="true">
      <td><Skeleton width={160} /><Skeleton width={50} height={18} style={{ marginTop: 6 }} /></td>
      <td><Skeleton width={200} /></td>
      <td><Skeleton width={130} /></td>
      <td><Skeleton width={30} /></td>
      <td><Skeleton width={70} height={22} radius={999} /></td>
      <td><Skeleton width={90} /></td>
      <td className="col-actions"><Skeleton width={110} height={28} /></td>
    </tr>
  ));
}

export default function DepartmentsListPage() {
  useDocumentTitle('Departamentos');
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const list = useListQuery(departmentsService.list, PARAMS);
  const { filters, data, loading, error } = list;
  const actions = useDepartmentActions({ onChanged: list.reload, onDeleted: list.reload });

  const canCreate = hasPermission(PERMISSIONS.DEPARTMENTS_CREATE);
  const items = data?.items ?? [];
  const ownScope = data?.scope === 'own';
  const sort = { sortBy: filters.sortBy, sortDir: filters.sortDir, onSort: list.toggleSort };

  return (
    <>
      <PageHeader
        title="Departamentos"
        subtitle={
          ownScope
            ? 'Departamentos a los que perteneces.'
            : 'Organiza las áreas de tu empresa, sus responsables y sus integrantes.'
        }
        actions={
          canCreate && (
            <Link to="/departamentos/nuevo" className="btn btn--primary">
              <Plus aria-hidden="true" /> Nuevo departamento
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
              aria-label="Buscar departamentos"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
              maxLength={100}
            />
          </div>
          <select
            className="select toolbar__select"
            aria-label="Filtrar por estado"
            value={filters.status}
            onChange={(e) => list.setFilter({ status: e.target.value })}
          >
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

        {error ? (
          <div style={{ padding: 20 }}>
            <Alert tone="error" title="No se pudo cargar la lista de departamentos">
              {error}{' '}
              <Button size="sm" variant="ghost" icon={RotateCw} onClick={list.reload}>
                Reintentar
              </Button>
            </Alert>
          </div>
        ) : !loading && items.length === 0 ? (
          list.hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Sin resultados"
              text="Ningún departamento coincide con la búsqueda o los filtros."
              action={<Button icon={FilterX} onClick={list.clearFilters}>Limpiar filtros</Button>}
            />
          ) : (
            <EmptyState
              icon={Building2}
              title={ownScope ? 'No perteneces a ningún departamento' : 'Aún no hay departamentos'}
              text={
                ownScope
                  ? 'Cuando un administrador te asigne a un departamento aparecerá aquí.'
                  : 'Crea el primer departamento (por ejemplo TI, Recursos Humanos o Compras) para organizar a tu equipo.'
              }
              action={
                canCreate && (
                  <Link to="/departamentos/nuevo" className="btn btn--primary">
                    <Plus aria-hidden="true" /> Nuevo departamento
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
                  <SortableHeader column="name" label="Nombre" {...sort} />
                  <th scope="col">Descripción</th>
                  <th scope="col">Responsable</th>
                  <SortableHeader column="members" label="Usuarios" {...sort} />
                  <SortableHeader column="status" label="Estado" {...sort} />
                  <SortableHeader column="createdAt" label="Creado" {...sort} />
                  <th scope="col" className="col-actions">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <SkeletonRows />
                ) : (
                  items.map((d) => (
                    <tr key={d.id} style={loading ? { opacity: 0.55 } : undefined}>
                      <td className="cell-primary">
                        <div className="cell-dept">
                          <Link to={`/departamentos/${d.id}`} className="cell-user__name">
                            {d.name}
                          </Link>
                          <CodeBadge>{d.code}</CodeBadge>
                        </div>
                      </td>
                      <td data-label="Descripción" className="muted">
                        <span className="cell-desc">{d.description || '—'}</span>
                      </td>
                      <td data-label="Responsable">
                        {d.manager ? (
                          <span className="cell-person">
                            <Avatar firstName={d.manager.firstName} lastName={d.manager.lastName} seed={d.manager.email} size="xs" />
                            <span>{d.manager.fullName}</span>
                          </span>
                        ) : (
                          <span className="muted">Sin responsable</span>
                        )}
                      </td>
                      <td data-label="Usuarios" className="tabular">
                        {d.membersCount}
                      </td>
                      <td data-label="Estado">
                        <StatusBadge status={d.status} />
                      </td>
                      <td data-label="Creado" className="muted tabular">
                        {formatDate(d.createdAt)}
                      </td>
                      <td className="col-actions">
                        <div className="row-actions">
                          <IconButton icon={Eye} label={`Ver ${d.name}`} onClick={() => navigate(`/departamentos/${d.id}`)} />
                          {d.capabilities.update && (
                            <IconButton
                              icon={Pencil}
                              label={`Editar ${d.name}`}
                              onClick={() => navigate(`/departamentos/${d.id}/editar`)}
                            />
                          )}
                          {d.capabilities.changeStatus && (
                            <IconButton
                              icon={d.status === 'active' ? PowerOff : Power}
                              className={d.status === 'active' ? '' : 'text-success'}
                              label={d.status === 'active' ? `Desactivar ${d.name}` : `Activar ${d.name}`}
                              onClick={() => actions.toggleStatus(d)}
                            />
                          )}
                          {d.capabilities.delete && (
                            <IconButton
                              icon={Trash2}
                              className="text-danger"
                              label={`Eliminar ${d.name}`}
                              onClick={() => actions.remove(d)}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
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
