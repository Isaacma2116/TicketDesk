import { query } from '../config/database.js';

export const RoleModel = {
  async findAll() {
    return query('SELECT id, code, name, description, level FROM roles ORDER BY level DESC');
  },

  async findById(id) {
    const rows = await query('SELECT id, code, name, description, level FROM roles WHERE id = ?', [id]);
    return rows[0] ?? null;
  },

  async findByCode(code) {
    const rows = await query('SELECT id, code, name, description, level FROM roles WHERE code = ?', [code]);
    return rows[0] ?? null;
  },

  async permissionCodes(roleId) {
    const rows = await query(
      `SELECT p.code FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ? ORDER BY p.code`,
      [roleId],
    );
    return rows.map((r) => r.code);
  },
};
