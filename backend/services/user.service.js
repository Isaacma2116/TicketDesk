import { withTransaction } from '../config/database.js';
import { ROLES } from '../config/rbac.js';
import { UserModel } from '../models/user.model.js';
import { RoleModel } from '../models/role.model.js';
import { SessionModel } from '../models/session.model.js';
import { DepartmentModel } from '../models/department.model.js';
import { AppError } from '../utils/AppError.js';
import { generateTemporaryPassword, hashPassword, passwordPolicyErrors } from '../utils/password.js';
import { toPublicRole, toPublicUser } from '../utils/serializers.js';
import { AUDIT_ACTIONS, AuditService, diff } from './audit.service.js';

/**
 * Reglas de jerarquía:
 *  - El superadministrador puede gestionar a cualquier usuario y asignar cualquier rol.
 *  - El resto solo gestiona usuarios con un rol de nivel inferior al suyo y
 *    solo puede asignar roles de nivel inferior (un administrador no puede
 *    crear superadministradores ni otros administradores).
 *  - Nadie puede desactivarse, eliminarse ni cambiarse el rol a sí mismo.
 *  - Siempre debe quedar al menos un superadministrador activo.
 * Todas las operaciones se acotan a la empresa del usuario autenticado.
 */
function isSuperadmin(actor) {
  return actor.role.code === ROLES.SUPERADMIN;
}

export function canManageLevel(actor, level) {
  return isSuperadmin(actor) || level < actor.role.level;
}

const isAgentRole = (roleCode) => roleCode === ROLES.AGENT;

function assertCanManage(actor, target) {
  if (!canManageLevel(actor, target.role_level)) {
    throw AppError.forbidden('No puedes gestionar usuarios con un rol igual o superior al tuyo');
  }
}

async function resolveAssignableRole(actor, roleId) {
  const role = await RoleModel.findById(roleId);
  if (!role) throw AppError.badRequest('El rol indicado no existe', { roleId: 'Rol no válido' });
  if (!canManageLevel(actor, role.level)) {
    throw AppError.forbidden(`No tienes permisos para asignar el rol ${role.name}`);
  }
  return role;
}

/** Valida un departamento destino: de la misma empresa y activo. */
async function resolveAssignableDepartment(companyId, departmentId, currentDepartmentId = null) {
  const department = await DepartmentModel.findById(companyId, departmentId);
  if (!department) {
    throw AppError.badRequest('El departamento indicado no existe', { departmentId: 'Departamento no válido' });
  }
  if (department.status !== 'active' && department.id !== currentDepartmentId) {
    throw AppError.badRequest('No se pueden asignar usuarios a un departamento inactivo', {
      departmentId: 'El departamento está inactivo',
    });
  }
  return department;
}

async function assertNotLastSuperadmin(companyId, target) {
  if (target.role_code !== ROLES.SUPERADMIN || target.status !== 'active') return;
  const remaining = await UserModel.countActiveByRoleCode(companyId, ROLES.SUPERADMIN);
  if (remaining <= 1) {
    throw AppError.conflict('Debe existir al menos un superadministrador activo', 'LAST_SUPERADMIN');
  }
}

async function getTargetOrFail(companyId, id) {
  // Un id de otra empresa se trata igual que uno inexistente (404).
  const target = await UserModel.findById(companyId, id);
  if (!target) throw AppError.notFound('Usuario no encontrado');
  return target;
}

function withCapabilities(actor, row) {
  const user = toPublicUser(row);
  const self = row.id === actor.id;
  const manageable = !self && canManageLevel(actor, row.role_level);
  user.capabilities = {
    edit: self || manageable,
    changeRole: manageable,
    changeDepartment: self ? isSuperadmin(actor) : manageable,
    changeStatus: manageable,
    delete: manageable,
  };
  return user;
}

async function withDetail(auth, row) {
  const user = withCapabilities(auth.user, row);
  const departments = await DepartmentModel.forUser(auth.companyId, row.id);
  user.departments = departments.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    status: d.status,
    isPrimary: Boolean(d.is_primary),
    isAgent: Boolean(d.is_agent),
    isManager: Boolean(d.is_manager),
  }));
  return user;
}

export const UserService = {
  async list(auth, filters) {
    const { items, total } = await UserModel.list(auth.companyId, filters);
    return {
      items: items.map((row) => withCapabilities(auth.user, row)),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
      },
    };
  },

  async getById(auth, id) {
    return withDetail(auth, await getTargetOrFail(auth.companyId, id));
  },

  async create(auth, data) {
    const { user: actor, companyId } = auth;
    const role = await resolveAssignableRole(actor, data.roleId);
    const department = data.departmentId ? await resolveAssignableDepartment(companyId, data.departmentId) : null;
    if (await UserModel.emailExists(data.email)) {
      throw AppError.conflict('Ya existe un usuario con ese correo electrónico', 'EMAIL_TAKEN');
    }

    let temporaryPassword = null;
    let password = data.password;
    if (!password) {
      temporaryPassword = generateTemporaryPassword();
      password = temporaryPassword;
    } else {
      const policy = passwordPolicyErrors(password);
      if (policy.length) {
        throw AppError.badRequest('La contraseña no cumple la política', { password: `Debe contener ${policy.join(', ')}` });
      }
    }
    const passwordHash = await hashPassword(password);

    const id = await withTransaction(async (conn) => {
      const newId = await UserModel.create(
        {
          companyId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          passwordHash,
          roleId: role.id,
          status: data.status,
          // Toda contraseña asignada por un administrador es temporal.
          mustChangePassword: true,
          createdBy: actor.id,
        },
        conn,
      );
      if (department) {
        await DepartmentModel.setPrimary(conn, {
          companyId,
          userId: newId,
          departmentId: department.id,
          isAgent: isAgentRole(role.code),
          actorId: actor.id,
        });
      }
      return newId;
    });

    await AuditService.log(auth.audit, AUDIT_ACTIONS.USER_CREATED, 'user', id, {
      email: data.email,
      role: role.code,
      status: data.status,
    });
    if (department) {
      await AuditService.log(auth.audit, AUDIT_ACTIONS.USER_DEPARTMENT_ASSIGNED, 'user', id, {
        department: { from: null, to: department.code },
      });
    }

    const user = await withDetail(auth, await UserModel.findById(companyId, id));
    // La contraseña generada se devuelve una única vez para entregarla al usuario.
    return { user, temporaryPassword };
  },

  async update(auth, id, data) {
    const { user: actor, companyId } = auth;
    const target = await getTargetOrFail(companyId, id);
    const self = target.id === actor.id;
    if (!self) assertCanManage(actor, target);

    const fields = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
    };

    if (data.email && data.email !== target.email && (await UserModel.emailExists(data.email, id))) {
      throw AppError.conflict('Ya existe un usuario con ese correo electrónico', 'EMAIL_TAKEN');
    }

    let newRole = null;
    if (data.roleId !== undefined && data.roleId !== target.role_id) {
      if (self) throw AppError.forbidden('No puedes cambiar tu propio rol');
      newRole = await resolveAssignableRole(actor, data.roleId);
      if (newRole.code !== ROLES.SUPERADMIN) await assertNotLastSuperadmin(companyId, target);
      fields.roleId = newRole.id;
    }

    // Departamento principal: undefined = sin cambios, null = quitar.
    let departmentChange = null;
    if (data.departmentId !== undefined && (data.departmentId ?? null) !== (target.department_id ?? null)) {
      if (self && !isSuperadmin(actor)) throw AppError.forbidden('No puedes cambiar tu propio departamento');
      const newDepartment = data.departmentId
        ? await resolveAssignableDepartment(companyId, data.departmentId, target.department_id)
        : null;
      // Integridad: el responsable de un departamento no puede salir de él.
      if (target.department_id) {
        const managed = await DepartmentModel.managedBy(companyId, target.id);
        const blocking = managed.find((d) => d.id === target.department_id);
        if (blocking) {
          throw AppError.conflict(
            `${target.first_name} es responsable del departamento ${blocking.name}. Asigna otro responsable antes de cambiarlo de departamento.`,
            'USER_IS_DEPARTMENT_MANAGER',
          );
        }
      }
      departmentChange = { from: target.department_code ?? null, to: newDepartment?.code ?? null, department: newDepartment };
    }

    let temporaryPassword = null;
    if (data.resetPassword) {
      if (self) throw AppError.forbidden('Para cambiar tu contraseña usa la opción "Cambiar contraseña"');
      temporaryPassword = generateTemporaryPassword();
      fields.passwordHash = await hashPassword(temporaryPassword);
      fields.mustChangePassword = true;
    }

    await withTransaction(async (conn) => {
      await UserModel.update(companyId, id, fields, actor.id, conn);
      const roleCode = newRole?.code ?? target.role_code;
      if (departmentChange) {
        await DepartmentModel.setPrimary(conn, {
          companyId,
          userId: id,
          departmentId: departmentChange.department?.id ?? null,
          isAgent: isAgentRole(roleCode),
          actorId: actor.id,
        });
      }
      if (newRole) await DepartmentModel.setAgentFlagForUser(conn, companyId, id, isAgentRole(newRole.code));
    });

    if (fields.roleId !== undefined || fields.passwordHash !== undefined) {
      // Cambios sensibles: se cierran las sesiones del usuario afectado.
      await SessionModel.revokeAllForUser(id);
    }

    const changes = diff(
      { firstName: target.first_name, lastName: target.last_name, email: target.email, role: target.role_code },
      { firstName: data.firstName, lastName: data.lastName, email: data.email, role: newRole?.code },
    );
    if (data.resetPassword) changes.password = 'reset';
    if (Object.keys(changes).length) await AuditService.log(auth.audit, AUDIT_ACTIONS.USER_UPDATED, 'user', id, changes);
    if (departmentChange) {
      await AuditService.log(auth.audit, AUDIT_ACTIONS.USER_DEPARTMENT_ASSIGNED, 'user', id, {
        department: { from: departmentChange.from, to: departmentChange.to },
      });
    }

    const user = await withDetail(auth, await UserModel.findById(companyId, id));
    return { user, temporaryPassword };
  },

  async changeStatus(auth, id, status) {
    const { user: actor, companyId } = auth;
    const target = await getTargetOrFail(companyId, id);
    if (target.id === actor.id) throw AppError.forbidden('No puedes cambiar el estado de tu propia cuenta');
    assertCanManage(actor, target);
    if (status === 'inactive') await assertNotLastSuperadmin(companyId, target);

    await UserModel.update(companyId, id, { status }, actor.id);
    if (status === 'inactive') await SessionModel.revokeAllForUser(id);
    if (status !== target.status) {
      await AuditService.log(auth.audit, AUDIT_ACTIONS.USER_STATUS_CHANGED, 'user', id, {
        status: { from: target.status, to: status },
      });
    }
    return withDetail(auth, await UserModel.findById(companyId, id));
  },

  async remove(auth, id) {
    const { user: actor, companyId } = auth;
    const target = await getTargetOrFail(companyId, id);
    if (target.id === actor.id) throw AppError.forbidden('No puedes eliminar tu propia cuenta');
    assertCanManage(actor, target);
    await assertNotLastSuperadmin(companyId, target);

    // Borrado lógico: se conserva el registro para trazabilidad futura
    // (tickets, comentarios, auditoría) y se libera el correo. Deja de ser
    // responsable de sus departamentos; las membresías se conservan como
    // historial (las consultas excluyen usuarios eliminados).
    const managed = await DepartmentModel.managedBy(companyId, id);
    await withTransaction(async (conn) => {
      await UserModel.softDelete(companyId, id, actor.id, conn);
      await DepartmentModel.clearManagerForUser(conn, companyId, id);
    });
    await SessionModel.revokeAllForUser(id);
    await AuditService.log(auth.audit, AUDIT_ACTIONS.USER_DELETED, 'user', id, {
      email: target.email,
      managerOf: managed.map((d) => d.code),
    });
  },

  async rolesFor(auth) {
    const roles = await RoleModel.findAll();
    return roles.map((r) => ({ ...toPublicRole(r), assignable: canManageLevel(auth.user, r.level) }));
  },
};
