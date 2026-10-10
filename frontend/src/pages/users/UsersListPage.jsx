import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  FilterX,
  Pencil,
  Power,
  PowerOff,
  RotateCw,
  Search,
  SearchX,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { rolesService, usersService } from '../../services/usersService';
import { departmentsService } from '../../services/organizationService';
import {
  Alert,
  Avatar,
  Button,
  EmptyState,
  IconButton,
  PageHeader,
  Pagination,
  RoleBadge,
  Skeleton,
  StatusBadge,
} from '../../components/ui';
import { useAuth, useDebounce, useDocumentTitle } from '../../hooks';
import { useUserActions } from '../../hooks/useUserActions';
import { formatDate } from '../../utils/format';
import { PERMISSIONS } from '../../utils/permissions';

const PAGE_SIZE = 10;

const COLUMNS = [
  { key: 'name', label: 'Nombre' },
  { key: 'lastName', label: 'Apellidos' },
  { key: 'email', label: 'Correo', className: 'col-xl-only' },
  { key: 'role', label: 'Rol' },
  { key: 'department', label: 'Departamento' },
  { key: 'status', label: 'Estado' },
  // En anchos intermedios se oculta para que la tabla quepa (sigue en el detalle).
  { key: 'createdAt', label: 'Fecha de creación', className: 'col-wide-only' },
];

function SkeletonRows() {
  return Array.from({ length: 6 }, (_, i) => (
    <tr key={i} aria-hidden="true">
      <td>
        <div className="cell-user">
          <Skeleton width={30} height={30} radius="50%" />
          <Skeleton width={110} />
        </div>
      </td>
      <td><Skeleton width={120} /></td>
      <td className="col-xl-only"><Skeleton width={170} /></td>
      <td><Skeleton width={90} height={22} radius={999} /></td>
      <td><Skeleton width={90} /></td>
      <td><Skeleton width={70} height={22} radius={999} /></td>
      <td className="col-wide-only"><Skeleton width={90} /></td>
      <td className="col-actions"><Skeleton width={120} height={28} /></td>
    </tr>
  ));
}

export default function UsersListPage() {
  useDocumentTitle('Usuarios');
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Los filtros viven en la URL: se conservan al recargar o compartir el enlace.
  const filters = {
    search: params.get('q') ?? '',
    roleId: params.get('rol') ?? '',
    departmentId: params.get('departamento') ?? '',
    status: params.get('estado') ?? '',
    page: Number(params.get('pagina')) || 1,
    sortBy: params.get('orden') ?? 'createdAt',
    sortDir: params.get('dir') ?? 'desc',
  };

  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput.trim());
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  // Resultado de la última petición; mientras llega la siguiente se muestran
  // los datos anteriores atenuados en lugar de vaciar la tabla.
  const [result, setResult] = useState({ key: null, data: null, error: null });

  const setFilter = useCallback(
    (updates, resetPage = true) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(updates)) {
            if (v === '' || v === null || v === undefined) next.delete(k);
            else next.set(k, String(v));
          }
          if (resetPage) next.delete('pagina');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    if (debouncedSearch !== filters.search) setFilter({ q: debouncedSearch });
  }, [debouncedSearch, filters.search, setFilter]);

  useEffect(() => {
    if (!hasPermission(PERMISSIONS.ROLES_VIEW)) return undefined;
    const controller = new AbortController();
    rolesService
      .list({ signal: controller.signal })
      .then((d) => setRoles(d.roles))
      .catch(() => {});
    return () => controller.abort();
  }, [hasPermission]);

  useEffect(() => {
    const controller = new AbortController();
    departmentsService
      .options({ includeInactive: true }, { signal: controller.signal })
      .then((d) => setDepartments(d.departments))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const query = JSON.stringify(filters);
  const requestKey = `${query}|${reloadKey}`;
  useEffect(() => {
    const f = JSON.parse(requestKey.slice(0, requestKey.lastIndexOf('|')));
    const controller = new AbortController();
    usersService
      .list({ ...f, pageSize: PAGE_SIZE }, { signal: controller.signal })
      .then((res) => setResult({ key: requestKey, data: res, error: null }))
      .catch((err) => {
        if (err.name !== 'AbortError') setResult((prev) => ({ key: requestKey, data: prev.data, error: err.message }));
      });
    return () => controller.abort();
  }, [requestKey]);

  const loading = result.key !== requestKey;
  const data = result.data;
  const error = loading ? null : result.error;

  const reload = () => setReloadKey((k) => k + 1);
  const actions = useUserActions({ onChanged: reload, onDeleted: reload });

  const toggleSort = (key) => {
    const dir = filters.sortBy === key && filters.sortDir === 'asc' ? 'desc' : 'asc';
    setFilter({ orden: key, dir }, false);
  };

  const hasFilters = Boolean(filters.search || filters.roleId || filters.departmentId || filters.status);
  const clearFilters = () => {
    setSearchInput('');
    setParams({}, { replace: true });
  };

  const canCreate = hasPermission(PERMISSIONS.USERS_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.USERS_UPDATE);
  const canChangeStatus = hasPermission(PERMISSIONS.USERS_CHANGE_STATUS);
  const canDelete = hasPermission(PERMISSIONS.USERS_DELETE);
  const items = data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle="Gestiona las cuentas, roles y accesos de la plataforma."
        actions={
          canCreate && (
            <Link to="/usuarios/nuevo" className="btn btn--primary">
              <UserPlus aria-hidden="true" /> Nuevo usuario
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
              placeholder="Buscar por nombre, apellidos o correo…"
              aria-label="Buscar usuarios"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={100}
            />
          </div>
          <select
            className="select toolbar__select"
            aria-label="Filtrar por rol"
            value={filters.roleId}
            onChange={(e) => setFilter({ rol: e.target.value })}
          >
            <option value="">Todos los roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            className="select toolbar__select"
            aria-label="Filtrar por departamento"
            value={filters.departmentId}
            onChange={(e) => setFilter({ departamento: e.target.value })}
          >
            <option value="">Todos los departamentos</option>
            <option value="none">Sin departamento</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.status === 'inactive' ? ' (inactivo)' : ''}
              </option>
            ))}
          </select>
          <select
            className="select toolbar__select"
            aria-label="Filtrar por estado"
            value={filters.status}
            onChange={(e) => setFilter({ estado: e.target.value })}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
          {hasFilters && (
            <Button variant="ghost" icon={FilterX} onClick={clearFilters}>
              Limpiar
            </Button>
          )}
        </div>

        {error ? (
          <div style={{ padding: 20 }}>
            <Alert tone="error" title="No se pudo cargar la lista de usuarios">
              {error}{' '}
              <Button size="sm" variant="ghost" icon={RotateCw} onClick={reload}>
                Reintentar
              </Button>
            </Alert>
          </div>
        ) : !loading && items.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Sin resultados"
              text="Ningún usuario coincide con los filtros aplicados. Prueba con otros términos."
              action={<Button icon={FilterX} onClick={clearFilters}>Limpiar filtros</Button>}
            />
          ) : (
            <EmptyState
              icon={Users}
              title="Aún no hay usuarios"
              text="Crea la primera cuenta para que tu equipo pueda acceder a la plataforma."
              action={
                canCreate && (
                  <Link to="/usuarios/nuevo" className="btn btn--primary">
                    <UserPlus aria-hidden="true" /> Nuevo usuario
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
                  {COLUMNS.map((c) => {
                    const active = filters.sortBy === c.key;
                    const SortIcon = !active ? ArrowUpDown : filters.sortDir === 'asc' ? ArrowUp : ArrowDown;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        className={c.className}
                        aria-sort={active ? (filters.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        <button type="button" className="sort-btn" data-active={active} onClick={() => toggleSort(c.key)}>
                          {c.label}
                          <SortIcon aria-hidden="true" />
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="col-actions">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <SkeletonRows />
                ) : (
                  items.map((u) => (
                    <tr key={u.id} style={loading ? { opacity: 0.55 } : undefined}>
                      <td className="cell-primary">
                        <div className="cell-user">
                          <Avatar firstName={u.firstName} lastName={u.lastName} seed={u.email} size="sm" />
                          <span>
                            <Link to={`/usuarios/${u.id}`} className="cell-user__name">
                              {u.firstName}
                            </Link>
                            <span className="cell-user__meta cell-user__meta--block email-inline">{u.email}</span>
                            {u.mustChangePassword && (
                              <span className="cell-user__meta cell-user__meta--block">Contraseña temporal</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td data-label="Apellidos">{u.lastName}</td>
                      <td data-label="Correo" className="muted cell-email col-xl-only">
                        {u.email}
                      </td>
                      <td data-label="Rol">
                        <RoleBadge role={u.role} />
                      </td>
                      <td data-label="Departamento">
                        {u.department ? (
                          <span className="cell-dept-inline">
                            {u.department.name}
                            {u.department.status === 'inactive' && <span className="cell-user__meta"> (inactivo)</span>}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td data-label="Estado">
                        <StatusBadge status={u.status} />
                      </td>
                      <td data-label="Creado" className="muted tabular col-wide-only">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="col-actions">
                        <div className="row-actions">
                          <IconButton icon={Eye} label={`Ver ${u.fullName}`} onClick={() => navigate(`/usuarios/${u.id}`)} />
                          {canUpdate && u.capabilities.edit && (
                            <IconButton
                              icon={Pencil}
                              label={`Editar ${u.fullName}`}
                              onClick={() => navigate(`/usuarios/${u.id}/editar`)}
                            />
                          )}
                          {canChangeStatus && u.capabilities.changeStatus && (
                            <IconButton
                              icon={u.status === 'active' ? PowerOff : Power}
                              className={u.status === 'active' ? '' : 'text-success'}
                              label={u.status === 'active' ? `Desactivar ${u.fullName}` : `Activar ${u.fullName}`}
                              onClick={() => actions.toggleStatus(u)}
                            />
                          )}
                          {canDelete && u.capabilities.delete && (
                            <IconButton
                              icon={Trash2}
                              className="text-danger"
                              label={`Eliminar ${u.fullName}`}
                              onClick={() => actions.remove(u)}
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
            onChange={(p) => setFilter({ pagina: p > 1 ? p : '' }, false)}
          />
        )}
      </section>
      {actions.modal}
    </>
  );
}
