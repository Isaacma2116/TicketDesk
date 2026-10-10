import { withTransaction } from '../config/database.js';
import { PERMISSIONS, ROLES } from '../config/rbac.js';
import { DepartmentModel } from '../models/department.model.js';
import { UserModel } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { toDepartmentMember, toPublicDepartment } from '../utils/serializers.js';
import { AUDIT_ACTIONS, AuditService, diff } from './audit.service.js';

/*
 * Visibilidad:
 *  - departments.view      → todos los departamentos de la empresa.
 *  - departments.view_own  → solo los departamentos a los que pertenece.
 *  - departments.members_view → además, la lista de integrantes.
 * Un id de otra empresa responde 404 (como si no existiera); un departamento
 * de la propia empresa sin visibilidad responde 403.
 */

const has = (auth, permission) => auth.permissions.includes(permission);
const canViewAll = (auth) => has(auth, PERMISSIONS.DEPARTMENTS_VIEW);

const DUPLICATE_CODE = 'Ya existe un departamento con ese código.';

async function getOrFail(companyId, id) {
  const department = await DepartmentModel.findById(companyId, id);
  if (!department) throw AppError.notFound('Departamento no encontrado');
  return department;
}

async function assertVisible(auth, department) {
  if (canViewAll(auth)) return;
  if (has(auth, PERMISSIONS.DEPARTMENTS_VIEW_OWN)) {
    const isMember = await DepartmentModel.isMember(auth.companyId, department.id, auth.user.id);
    if (isMember || department.manager_id === auth.user.id) return;
  }
  throw AppError.forbidden('No tienes acceso a este departamento');
}

/** El responsable debe ser un usuario activo de la misma empresa. */
async function resolveManager(companyId, managerId) {
  if (!managerId) return null;
  const manager = await UserModel.findById(companyId, managerId);
  if (!manager) throw AppError.badRequest('El responsable indicado no existe', { managerId: 'Selecciona un usuario válido' });
  if (manager.status !== 'active') {
    throw AppError.badRequest('El responsable debe ser un usuario activo', { managerId: 'El usuario está inactivo' });
  }
  return manager;
}

async function assertUniqueCode(companyId, code, excludeId) {
  if (await DepartmentModel.codeExists(companyId, code, excludeId)) {
    throw new AppError(409, DUPLICATE_CODE, { code: 'DEPARTMENT_CODE_TAKEN', details: { code: DUPLICATE_CODE } });
  }
}

function withCapabilities(auth, department) {
  const dto = toPublicDepartment(department);
  dto.capabilities = {
    update: has(auth, PERMISSIONS.DEPARTMENTS_UPDATE),
    changeStatus: has(auth, PERMISSIONS.DEPARTMENTS_CHANGE_STATUS),
    delete: has(auth, PERMISSIONS.DEPARTMENTS_DELETE) && dto.membersCount === 0,
    viewMembers: has(auth, PERMISSIONS.DEPARTMENTS_MEMBERS_VIEW),
  };
  return dto;
}

function managerAudit(before, after) {
  return { manager: { from: before ?? null, to: after ?? null } };
}

export const DepartmentService = {
  async list(auth, filters) {
    const onlyIds = canViewAll(auth) ? undefined : await DepartmentModel.idsForUser(auth.companyId, auth.user.id);
    const { items, total } = await DepartmentModel.list(auth.companyId, { ...filters, onlyIds });
    return {
      items: items.map((d) => withCapabilities(auth, d)),
      scope: canViewAll(auth) ? 'all' : 'own',
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      },
    };
  },

  async options(auth, { includeInactive }) {
    const rows = await DepartmentModel.options(auth.companyId, { includeInactive });
    return rows.map((d) => ({ id: d.id, name: d.name, code: d.code, status: d.status }));
  },

  async getById(auth, id) {
    const department = await getOrFail(auth.companyId, id);
    await assertVisible(auth, department);
    const dto = withCapabilities(auth, department);

    // Resumen: solo para quien puede ver a los integrantes.
    if (dto.capabilities.viewMembers) {
      const members = await DepartmentModel.members(auth.companyId, id);
      dto.summary = {
        total: members.length,
        active: members.filter((m) => m.status === 'active').length,
        agents: members.filter((m) => m.is_agent).length,
        supervisors: members.filter((m) => m.role_code === ROLES.SUPERVISOR).length,
      };
    }
    return dto;
  },

  async members(auth, id) {
    const department = await getOrFail(auth.companyId, id);
    await assertVisible(auth, department);
    const rows = await DepartmentModel.members(auth.companyId, id);
    return rows.map(toDepartmentMember);
  },

  /** Usuarios activos que pueden ser responsables (marcando si ya son miembros). */
  async managerOptions(auth, departmentId) {
    const memberIds = departmentId
      ? new Set((await DepartmentModel.members(auth.companyId, departmentId)).map((m) => m.id))
      : new Set();
    const rows = await UserModel.activeOptions(auth.companyId);
    return rows.map((u) => ({
      id: u.id,
      fullName: `${u.first_name} ${u.last_name}`.trim(),
      email: u.email,
      role: { code: u.role_code, name: u.role_name },
      department: u.department_id ? { id: u.department_id, name: u.department_name } : null,
      isMember: memberIds.has(u.id),
    }));
  },

  async create(auth, data) {
    const { companyId, user: actor } = auth;
    await assertUniqueCode(companyId, data.code);
    const manager = await resolveManager(companyId, data.managerId);

    const id = await withTransaction(async (conn) => {
      const newId = await DepartmentModel.create(conn, {
        companyId,
        name: data.name,
        code: data.code,
        description: data.description,
        managerId: manager?.id ?? null,
        status: data.status,
        actorId: actor.id,
      });
      // El responsable pasa a ser integrante del departamento. Si no tenía
      // departamento principal, este se convierte en el suyo.
      if (manager) await addManagerMembership(conn, companyId, manager, newId, actor.id);
      return newId;
    });

    await AuditService.log(auth.audit, AUDIT_ACTIONS.DEPARTMENT_CREATED, 'department', id, {
      name: data.name,
      code: data.code,
      status: data.status,
      managerId: manager?.id ?? null,
    });
    return this.getById(auth, id);
  },

  async update(auth, id, data) {
    const { companyId, user: actor } = auth;
    const department = await getOrFail(companyId, id);

    if (data.code && data.code !== department.code) await assertUniqueCode(companyId, data.code, id);

    if (data.status !== undefined && data.status !== department.status && !has(auth, PERMISSIONS.DEPARTMENTS_CHANGE_STATUS)) {
      throw AppError.forbidden('No tienes permisos para activar o desactivar departamentos');
    }

    let manager;
    const managerChanged = data.managerId !== undefined && (data.managerId ?? null) !== (department.manager_id ?? null);
    if (managerChanged) manager = await resolveManager(companyId, data.managerId);

    await withTransaction(async (conn) => {
      await DepartmentModel.update(
        conn,
        companyId,
        id,
        {
          name: data.name,
          code: data.code,
          description: data.description,
          status: data.status,
          managerId: managerChanged ? (manager?.id ?? null) : undefined,
        },
        actor.id,
      );
      if (managerChanged && manager) await addManagerMembership(conn, companyId, manager, id, actor.id);
    });

    const changes = diff(
      { name: department.name, code: department.code, description: department.description },
      { name: data.name, code: data.code, description: data.description },
    );
    if (Object.keys(changes).length) {
      await AuditService.log(auth.audit, AUDIT_ACTIONS.DEPARTMENT_UPDATED, 'department', id, changes);
    }
    if (data.status !== undefined && data.status !== department.status) {
      await AuditService.log(auth.audit, AUDIT_ACTIONS.DEPARTMENT_STATUS_CHANGED, 'department', id, {
        status: { from: department.status, to: data.status },
      });
    }
    if (managerChanged) {
      await AuditService.log(
        auth.audit,
        AUDIT_ACTIONS.DEPARTMENT_MANAGER_CHANGED,
        'department',
        id,
        managerAudit(department.manager_id, manager?.id),
      );
    }
    return this.getById(auth, id);
  },

  async changeStatus(auth, id, status) {
    const department = await getOrFail(auth.companyId, id);
    if (department.status !== status) {
      // Desactivar no toca usuarios ni membresías: solo impide nuevas asignaciones.
      await DepartmentModel.update(null, auth.companyId, id, { status }, auth.user.id);
      await AuditService.log(auth.audit, AUDIT_ACTIONS.DEPARTMENT_STATUS_CHANGED, 'department', id, {
        status: { from: department.status, to: status },
      });
    }
    return this.getById(auth, id);
  },

  /** Eliminación física: solo departamentos sin integrantes ni datos dependientes. */
  async remove(auth, id) {
    const department = await getOrFail(auth.companyId, id);
    const dependents = await DepartmentModel.countDependents(auth.companyId, id);
    if (dependents > 0 || department.manager_id) {
      throw AppError.conflict(
        'El departamento tiene usuarios asociados. Desactívalo en lugar de eliminarlo para conservar su historial.',
        'DEPARTMENT_NOT_EMPTY',
      );
    }
    await DepartmentModel.remove(null, auth.companyId, id);
    await AuditService.log(auth.audit, AUDIT_ACTIONS.DEPARTMENT_DELETED, 'department', id, {
      name: department.name,
      code: department.code,
    });
  },
};

async function addManagerMembership(conn, companyId, manager, departmentId, actorId) {
  const isAgent = manager.role_code === ROLES.AGENT;
  const primary = await DepartmentModel.primaryForUser(companyId, manager.id, conn);
  if (!primary) {
    await DepartmentModel.setPrimary(conn, { companyId, userId: manager.id, departmentId, isAgent, actorId });
  } else {
    await DepartmentModel.ensureMember(conn, { companyId, userId: manager.id, departmentId, isAgent, actorId });
  }
}
