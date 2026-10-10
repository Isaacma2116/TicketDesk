/**
 * Seed idempotente del catálogo RBAC (roles, permisos y sus relaciones).
 * Puede ejecutarse tantas veces como se quiera: sincroniza la base de datos
 * con config/rbac.js. NO crea usuarios (ver scripts/create-superadmin.js).
 */
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from '../config/database.js';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS } from '../config/rbac.js';

export async function seed({ log = console.log } = {}) {
  await withTransaction(async (conn) => {
    for (const p of PERMISSION_DEFINITIONS) {
      await conn.execute(
        `INSERT INTO permissions (code, module, name, description) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE module = VALUES(module), name = VALUES(name), description = VALUES(description)`,
        [p.code, p.module, p.name, p.description],
      );
    }

    for (const r of ROLE_DEFINITIONS) {
      await conn.execute(
        `INSERT INTO roles (code, name, description, level, is_system) VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), level = VALUES(level), is_system = 1`,
        [r.code, r.name, r.description, r.level],
      );
      const [[role]] = await conn.execute('SELECT id FROM roles WHERE code = ?', [r.code]);
      await conn.execute('DELETE FROM role_permissions WHERE role_id = ?', [role.id]);
      for (const code of r.permissions) {
        await conn.execute(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT ?, id FROM permissions WHERE code = ?`,
          [role.id, code],
        );
      }
    }
  });
  log(`✔ Catálogo RBAC sincronizado: ${ROLE_DEFINITIONS.length} roles, ${PERMISSION_DEFINITIONS.length} permisos`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .catch((err) => {
      console.error('✖ Error en el seed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
