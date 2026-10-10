/**
 * Creación controlada del PRIMER superadministrador.
 *
 * Es el único mecanismo para crear una cuenta sin pasar por la aplicación:
 *   - Se ejecuta en el servidor (requiere acceso a la máquina y al .env).
 *   - Lee los datos de SUPERADMIN_* en backend/.env.
 *   - Se niega a ejecutarse si ya existe un superadministrador, salvo que se
 *     pase --force (útil solo para recuperación de emergencia).
 *   - La cuenta queda marcada para cambiar la contraseña en el primer acceso.
 *
 * Uso: npm run create-superadmin
 */
import { pool } from '../config/database.js';
import { ROLES } from '../config/rbac.js';
import { RoleModel } from '../models/role.model.js';
import { UserModel } from '../models/user.model.js';
import { CompanyModel } from '../models/company.model.js';
import { hashPassword, passwordPolicyErrors } from '../utils/password.js';
import { emailField, nameField } from '../validators/common.js';

async function main() {
  const force = process.argv.includes('--force');
  const role = await RoleModel.findByCode(ROLES.SUPERADMIN);
  if (!role) throw new Error('No existe el rol superadmin. Ejecuta antes "npm run db:setup".');

  // Etapa 2: el superadministrador pertenece a la empresa inicial (creada por la migración 002).
  const company = await CompanyModel.findFirst();
  if (!company) throw new Error('No existe ninguna empresa. Ejecuta antes "npm run db:setup".');

  const existing = await UserModel.countActiveByRoleCode(company.id, ROLES.SUPERADMIN);
  if (existing > 0 && !force) {
    console.log('ℹ Ya existe un superadministrador activo. No se ha creado ninguna cuenta.');
    console.log('  Los nuevos usuarios deben crearse desde el módulo Usuarios de la aplicación.');
    return;
  }

  const email = emailField.parse(process.env.SUPERADMIN_EMAIL ?? '');
  const firstName = nameField('SUPERADMIN_FIRST_NAME').parse(process.env.SUPERADMIN_FIRST_NAME ?? 'Administrador');
  const lastName = nameField('SUPERADMIN_LAST_NAME').parse(process.env.SUPERADMIN_LAST_NAME ?? 'General');
  const password = process.env.SUPERADMIN_PASSWORD ?? '';

  const policy = passwordPolicyErrors(password);
  if (policy.length) throw new Error(`SUPERADMIN_PASSWORD debe contener ${policy.join(', ')}`);
  if (await UserModel.emailExists(email)) throw new Error(`Ya existe un usuario con el correo ${email}`);

  const id = await UserModel.create({
    companyId: company.id,
    firstName,
    lastName,
    email,
    passwordHash: await hashPassword(password),
    roleId: role.id,
    status: 'active',
    mustChangePassword: true,
    createdBy: null,
  });

  console.log(`✔ Superadministrador creado (id ${id}): ${email} — empresa: ${company.name}`);
  console.log('  Inicia sesión con la contraseña de SUPERADMIN_PASSWORD; se te pedirá cambiarla.');
  console.log('  Recomendado: elimina SUPERADMIN_PASSWORD de backend/.env.');
}

main()
  .catch((err) => {
    console.error('✖', err.issues?.[0]?.message ?? err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
