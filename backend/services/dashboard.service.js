import { PERMISSIONS } from '../config/rbac.js';
import { UserModel } from '../models/user.model.js';
import { DepartmentModel } from '../models/department.model.js';
import { toPublicUser } from '../utils/serializers.js';

export const DashboardService = {
  /**
   * Resumen del panel acotado a la empresa del usuario. Cada bloque solo se
   * incluye si el usuario tiene permiso para verlo. En próximas etapas se
   * añadirán aquí los bloques de tickets, cada uno tras su permiso.
   */
  async summary(auth) {
    const { companyId, permissions, session, user } = auth;
    const can = (p) => permissions.includes(p);

    const myDepartments = await DepartmentModel.forUser(companyId, user.id);
    const result = {
      serverTime: new Date().toISOString(),
      company: auth.company,
      session: {
        startedAt: session.session_created_at,
        expiresAt: session.expires_at,
        rememberMe: Boolean(session.remember_me),
      },
      permissionsCount: permissions.length,
      myDepartments: myDepartments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        status: d.status,
        isPrimary: Boolean(d.is_primary),
        isManager: Boolean(d.is_manager),
      })),
      users: null,
      departments: null,
    };

    if (can(PERMISSIONS.USERS_VIEW)) {
      const [byStatus, byRole, newLast30Days, withoutDepartment, recent] = await Promise.all([
        UserModel.countByStatus(companyId),
        UserModel.countByRole(companyId),
        UserModel.countCreatedSince(companyId, 30),
        UserModel.countWithoutDepartment(companyId),
        UserModel.recent(companyId, 5),
      ]);
      const active = Number(byStatus.find((s) => s.status === 'active')?.total ?? 0);
      const inactive = Number(byStatus.find((s) => s.status === 'inactive')?.total ?? 0);
      result.users = {
        total: active + inactive,
        active,
        inactive,
        newLast30Days,
        withoutDepartment,
        byRole: byRole.map((r) => ({ id: r.id, code: r.code, name: r.name, total: Number(r.total) })),
        recent: recent.map(toPublicUser),
      };
    }

    if (can(PERMISSIONS.DEPARTMENTS_VIEW)) {
      const [stats, byDepartment] = await Promise.all([
        DepartmentModel.stats(companyId),
        DepartmentModel.membersByDepartment(companyId, 8),
      ]);
      result.departments = {
        total: stats.total,
        active: stats.active,
        inactive: stats.total - stats.active,
        members: byDepartment.map((d) => ({ id: d.id, name: d.name, code: d.code, total: Number(d.total) })),
      };
    }

    return result;
  },
};
