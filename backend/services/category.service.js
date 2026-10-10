import { withTransaction } from '../config/database.js';
import { PERMISSIONS } from '../config/rbac.js';
import { CategoryModel } from '../models/category.model.js';
import { DepartmentModel } from '../models/department.model.js';
import { AppError } from '../utils/AppError.js';
import { AUDIT_ACTIONS, AuditService, diff } from './audit.service.js';
import { departmentInScopeOrFail, departmentScope, has, inScope } from './scope.js';

const DUPLICATE = 'Ya existe una categoría con ese nombre en el departamento.';

export function toPublicCategory(row, auth) {
  return {
    id: row.id,
    departmentId: row.department_id,
    department: { id: row.department_id, name: row.department_name, code: row.department_code, status: row.department_status },
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    status: row.status,
    typesCount: Number(row.types_count ?? 0),
    activeTypesCount: Number(row.active_types_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(auth && {
      capabilities: {
        update: has(auth, PERMISSIONS.CATEGORIES_UPDATE),
        changeStatus: has(auth, PERMISSIONS.CATEGORIES_CHANGE_STATUS),
      },
    }),
  };
}

/** Carga una categoría de la empresa y verifica el alcance del usuario. */
async function getInScopeOrFail(auth, id) {
  const row = await CategoryModel.findById(auth.companyId, id);
  if (!row) throw AppError.notFound('Categoría no encontrada');
  if (!inScope(await departmentScope(auth), row.department_id)) {
    throw AppError.forbidden('Solo puedes configurar los departamentos de los que eres responsable');
  }
  return row;
}

async function assertUniqueName(departmentId, name, excludeId) {
  if (await CategoryModel.nameExists(departmentId, name, excludeId)) {
    throw new AppError(409, DUPLICATE, { code: 'CATEGORY_NAME_TAKEN', details: { name: DUPLICATE } });
  }
}

export const CategoryService = {
  async list(auth, filters) {
    const scopeIds = await departmentScope(auth);
    const rows = await CategoryModel.list(auth.companyId, { ...filters, scopeIds });
    return { items: rows.map((r) => toPublicCategory(r, auth)), scope: scopeIds === null ? 'all' : 'managed' };
  },

  async getById(auth, id) {
    return toPublicCategory(await getInScopeOrFail(auth, id), auth);
  },

  async create(auth, data) {
    const department = await departmentInScopeOrFail(auth, data.departmentId);
    if (department.status !== 'active') {
      throw AppError.badRequest('No se pueden crear categorías en un departamento inactivo', {
        departmentId: 'El departamento está inactivo',
      });
    }
    await assertUniqueName(department.id, data.name);
    const id = await CategoryModel.create({
      companyId: auth.companyId,
      departmentId: department.id,
      name: data.name,
      description: data.description,
      status: data.status,
      sortOrder: await CategoryModel.nextOrder(department.id),
      actorId: auth.user.id,
    });
    await AuditService.log(auth.audit, AUDIT_ACTIONS.CATEGORY_CREATED, 'category', id, {
      department: department.code,
      name: data.name,
    });
    return this.getById(auth, id);
  },

  async update(auth, id, data) {
    const current = await getInScopeOrFail(auth, id);
    if (data.status !== undefined && data.status !== current.status && !has(auth, PERMISSIONS.CATEGORIES_CHANGE_STATUS)) {
      throw AppError.forbidden('No tienes permisos para activar o desactivar categorías');
    }
    if (data.name && data.name !== current.name) await assertUniqueName(current.department_id, data.name, id);
    await CategoryModel.update(auth.companyId, id, data, auth.user.id);
    const changes = diff(
      { name: current.name, description: current.description, status: current.status },
      { name: data.name, description: data.description, status: data.status },
    );
    if (Object.keys(changes).length) {
      await AuditService.log(auth.audit, AUDIT_ACTIONS.CATEGORY_UPDATED, 'category', id, changes);
    }
    return this.getById(auth, id);
  },

  async changeStatus(auth, id, status) {
    const current = await getInScopeOrFail(auth, id);
    if (current.status !== status) {
      // Desactivar una categoría la oculta del catálogo junto con sus tipos; no borra nada.
      await CategoryModel.update(auth.companyId, id, { status }, auth.user.id);
      await AuditService.log(auth.audit, AUDIT_ACTIONS.CATEGORY_STATUS_CHANGED, 'category', id, {
        status: { from: current.status, to: status },
      });
    }
    return this.getById(auth, id);
  },

  /** Departamentos activos que el usuario puede configurar (para selectores). */
  async scopeDepartments(auth) {
    const scope = await departmentScope(auth);
    const rows = await DepartmentModel.options(auth.companyId);
    return rows.filter((d) => inScope(scope, d.id)).map((d) => ({ id: d.id, name: d.name, code: d.code }));
  },

  /** Reordena todas las categorías de un departamento (ids en el nuevo orden). */
  async reorder(auth, { departmentId, ids }) {
    await departmentInScopeOrFail(auth, departmentId);
    const existing = await CategoryModel.idsByDepartment(auth.companyId, departmentId);
    const same = existing.length === ids.length && new Set(ids).size === ids.length && ids.every((i) => existing.includes(i));
    if (!same) {
      throw AppError.badRequest('La lista debe contener exactamente las categorías del departamento', { ids: 'Lista no válida' });
    }
    await withTransaction((conn) => CategoryModel.reorder(conn, auth.companyId, departmentId, ids));
    await AuditService.log(auth.audit, AUDIT_ACTIONS.CATEGORY_REORDERED, 'department', departmentId, { order: ids });
    return this.list(auth, { departmentId });
  },
};
