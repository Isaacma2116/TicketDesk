import { PERMISSIONS } from '../config/rbac.js';
import { DepartmentModel } from '../models/department.model.js';
import { AppError } from '../utils/AppError.js';

/*
 * Alcance por departamento para la configuración del catálogo (Etapa 3).
 *  - Con departments.view (administradores): todos los departamentos de su empresa.
 *  - Sin él (p. ej. supervisores): solo los departamentos de los que es RESPONSABLE.
 * Siempre dentro de la empresa del usuario (companyId de la sesión).
 */

export const has = (auth, permission) => auth.permissions.includes(permission);

/** null = todos los departamentos de la empresa; array = solo esos ids. */
export async function departmentScope(auth) {
  if (has(auth, PERMISSIONS.DEPARTMENTS_VIEW)) return null;
  const managed = await DepartmentModel.managedBy(auth.companyId, auth.user.id);
  return managed.map((d) => d.id);
}

export function inScope(scope, departmentId) {
  return scope === null || scope.includes(Number(departmentId));
}

/**
 * Carga un departamento de la empresa y comprueba que está en el alcance.
 * Un id de otra empresa → 404; uno de la empresa fuera de alcance → 403.
 */
export async function departmentInScopeOrFail(auth, departmentId, { field = 'departmentId' } = {}) {
  const department = await DepartmentModel.findById(auth.companyId, departmentId);
  if (!department) {
    throw AppError.badRequest('El departamento indicado no existe', { [field]: 'Departamento no válido' });
  }
  const scope = await departmentScope(auth);
  if (!inScope(scope, department.id)) {
    throw AppError.forbidden('Solo puedes configurar los departamentos de los que eres responsable');
  }
  return department;
}
