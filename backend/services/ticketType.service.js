import { withTransaction } from '../config/database.js';
import { PRIORITIES } from '../config/fieldTypes.js';
import { PERMISSIONS } from '../config/rbac.js';
import { CategoryModel } from '../models/category.model.js';
import { DepartmentModel } from '../models/department.model.js';
import { TicketTypeModel } from '../models/ticketType.model.js';
import { UserModel } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { AUDIT_ACTIONS, AuditService, diff } from './audit.service.js';
import { departmentInScopeOrFail, departmentScope, has, inScope } from './scope.js';

const DUPLICATE = 'Ya existe un tipo de solicitud con ese código en el departamento.';

export function toPublicTicketType(row, auth) {
  return {
    id: row.id,
    departmentId: row.department_id,
    department: { id: row.department_id, name: row.department_name, code: row.department_code, status: row.department_status },
    category: row.category_id ? { id: row.category_id, name: row.category_name, status: row.category_status } : null,
    name: row.name,
    code: row.code,
    description: row.description,
    defaultPriority: row.default_priority,
    defaultPriorityLabel: PRIORITIES[row.default_priority],
    assignmentMode: row.assignment_mode,
    assignee: row.assignee_user_id
      ? {
          id: row.assignee_user_id,
          fullName: `${row.assignee_first_name ?? ''} ${row.assignee_last_name ?? ''}`.trim(),
          email: row.assignee_email,
          status: row.assignee_status,
        }
      : null,
    sortOrder: row.sort_order,
    status: row.status,
    formVersion: row.form_version,
    formUpdatedAt: row.form_updated_at,
    fieldsCount: Number(row.fields_count ?? 0),
    activeFieldsCount: Number(row.active_fields_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(auth && {
      capabilities: {
        update: has(auth, PERMISSIONS.TICKET_TYPES_UPDATE),
        changeStatus: has(auth, PERMISSIONS.TICKET_TYPES_CHANGE_STATUS),
        editForm: has(auth, PERMISSIONS.FORMS_UPDATE),
        viewForm: has(auth, PERMISSIONS.FORMS_VIEW),
      },
    }),
  };
}

export async function ticketTypeInScopeOrFail(auth, id) {
  const row = await TicketTypeModel.findById(auth.companyId, id);
  if (!row) throw AppError.notFound('Tipo de solicitud no encontrado');
  if (!inScope(await departmentScope(auth), row.department_id)) {
    throw AppError.forbidden('Solo puedes configurar los departamentos de los que eres responsable');
  }
  return row;
}

/** La categoría debe existir, ser del mismo departamento y (si cambia) estar activa. */
async function resolveCategory(companyId, departmentId, categoryId, currentId = null) {
  if (!categoryId) return null;
  const category = await CategoryModel.findById(companyId, categoryId);
  if (!category || category.department_id !== departmentId) {
    throw AppError.badRequest('La categoría no pertenece al departamento', { categoryId: 'Selecciona una categoría del departamento' });
  }
  if (category.status !== 'active' && category.id !== currentId) {
    throw AppError.badRequest('La categoría está inactiva', { categoryId: 'La categoría está inactiva' });
  }
  return category;
}

/** El responsable individual debe ser un usuario activo que pertenezca al departamento. */
async function resolveAssignee(companyId, departmentId, mode, assigneeUserId) {
  if (mode !== 'user') return null;
  if (!assigneeUserId) {
    throw AppError.badRequest('Selecciona el responsable', { assigneeUserId: 'Selecciona un responsable' });
  }
  const user = await UserModel.findById(companyId, assigneeUserId);
  if (!user || user.status !== 'active') {
    throw AppError.badRequest('El responsable debe ser un usuario activo', { assigneeUserId: 'Usuario no válido o inactivo' });
  }
  if (!(await DepartmentModel.isMember(companyId, departmentId, user.id))) {
    throw AppError.badRequest('El responsable debe pertenecer al departamento', {
      assigneeUserId: 'El usuario no pertenece al departamento',
    });
  }
  return user;
}

async function assertUniqueCode(departmentId, code, excludeId) {
  if (await TicketTypeModel.codeExists(departmentId, code, excludeId)) {
    throw new AppError(409, DUPLICATE, { code: 'TICKET_TYPE_CODE_TAKEN', details: { code: DUPLICATE } });
  }
}

export const TicketTypeService = {
  async list(auth, filters) {
    const scopeIds = await departmentScope(auth);
    const { items, total } = await TicketTypeModel.list(auth.companyId, { ...filters, scopeIds });
    return {
      items: items.map((r) => toPublicTicketType(r, auth)),
      scope: scopeIds === null ? 'all' : 'managed',
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      },
    };
  },

  async getById(auth, id) {
    return toPublicTicketType(await ticketTypeInScopeOrFail(auth, id), auth);
  },

  async create(auth, data) {
    const { companyId, user } = auth;
    const department = await departmentInScopeOrFail(auth, data.departmentId);
    if (department.status !== 'active') {
      throw AppError.badRequest('No se pueden crear tipos en un departamento inactivo', { departmentId: 'El departamento está inactivo' });
    }
    await assertUniqueCode(department.id, data.code);
    const category = await resolveCategory(companyId, department.id, data.categoryId);
    const assignee = await resolveAssignee(companyId, department.id, data.assignmentMode, data.assigneeUserId);

    const id = await TicketTypeModel.create({
      companyId,
      departmentId: department.id,
      categoryId: category?.id ?? null,
      name: data.name,
      code: data.code,
      description: data.description,
      defaultPriority: data.defaultPriority,
      assignmentMode: data.assignmentMode,
      assigneeUserId: assignee?.id ?? null,
      status: data.status,
      sortOrder: await TicketTypeModel.nextOrder(department.id),
      actorId: user.id,
    });
    await AuditService.log(auth.audit, AUDIT_ACTIONS.TICKET_TYPE_CREATED, 'ticket_type', id, {
      department: department.code,
      code: data.code,
      name: data.name,
    });
    return this.getById(auth, id);
  },

  async update(auth, id, data) {
    const { companyId } = auth;
    const current = await ticketTypeInScopeOrFail(auth, id);
    if (data.status !== undefined && data.status !== current.status && !has(auth, PERMISSIONS.TICKET_TYPES_CHANGE_STATUS)) {
      throw AppError.forbidden('No tienes permisos para activar o desactivar tipos de solicitud');
    }
    if (data.code && data.code !== current.code) await assertUniqueCode(current.department_id, data.code, id);

    const fields = { ...data };
    if (data.categoryId !== undefined) {
      fields.categoryId = (await resolveCategory(companyId, current.department_id, data.categoryId, current.category_id))?.id ?? null;
    }
    const mode = data.assignmentMode ?? current.assignment_mode;
    if (data.assignmentMode !== undefined || data.assigneeUserId !== undefined) {
      const assigneeId = data.assigneeUserId !== undefined ? data.assigneeUserId : current.assignee_user_id;
      // Si el responsable no cambia se acepta aunque ya no cumpla (se conserva), salvo que se cambie el modo.
      const unchanged = assigneeId === current.assignee_user_id && mode === current.assignment_mode;
      fields.assigneeUserId = mode === 'user'
        ? unchanged
          ? assigneeId
          : (await resolveAssignee(companyId, current.department_id, mode, assigneeId)).id
        : null;
    }

    await TicketTypeModel.update(companyId, id, fields, auth.user.id);
    const changes = diff(
      {
        name: current.name,
        code: current.code,
        description: current.description,
        categoryId: current.category_id,
        defaultPriority: current.default_priority,
        assignmentMode: current.assignment_mode,
        assigneeUserId: current.assignee_user_id,
        status: current.status,
      },
      fields,
    );
    if (Object.keys(changes).length) {
      await AuditService.log(auth.audit, AUDIT_ACTIONS.TICKET_TYPE_UPDATED, 'ticket_type', id, changes);
    }
    return this.getById(auth, id);
  },

  async changeStatus(auth, id, status) {
    const current = await ticketTypeInScopeOrFail(auth, id);
    if (current.status !== status) {
      await TicketTypeModel.update(auth.companyId, id, { status }, auth.user.id);
      await AuditService.log(auth.audit, AUDIT_ACTIONS.TICKET_TYPE_STATUS_CHANGED, 'ticket_type', id, {
        status: { from: current.status, to: status },
      });
    }
    return this.getById(auth, id);
  },

  async reorder(auth, { departmentId, ids }) {
    await departmentInScopeOrFail(auth, departmentId);
    const existing = await TicketTypeModel.idsByDepartment(auth.companyId, departmentId);
    const same = existing.length === ids.length && new Set(ids).size === ids.length && ids.every((i) => existing.includes(i));
    if (!same) {
      throw AppError.badRequest('La lista debe contener exactamente los tipos del departamento', { ids: 'Lista no válida' });
    }
    await withTransaction((conn) => TicketTypeModel.reorder(conn, auth.companyId, departmentId, ids));
    await AuditService.log(auth.audit, AUDIT_ACTIONS.TICKET_TYPE_REORDERED, 'department', departmentId, { order: ids });
  },

  /** Usuarios del departamento que pueden ser responsables de un tipo. */
  async assigneeOptions(auth, departmentId) {
    await departmentInScopeOrFail(auth, departmentId);
    const members = await DepartmentModel.members(auth.companyId, departmentId);
    return members
      .filter((m) => m.status === 'active')
      .map((m) => ({
        id: m.id,
        fullName: `${m.first_name} ${m.last_name}`.trim(),
        email: m.email,
        role: { code: m.role_code, name: m.role_name },
        isAgent: Boolean(m.is_agent),
      }));
  },
};
