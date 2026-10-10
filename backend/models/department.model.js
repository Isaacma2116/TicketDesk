import { query } from '../config/database.js';

/*
 * Todas las consultas reciben companyId: nunca se lee ni se escribe un
 * departamento sin acotar por la empresa del usuario autenticado.
 */

const BASE_SELECT = `
  SELECT d.id, d.company_id, d.name, d.code, d.description, d.status, d.manager_id,
         d.created_at, d.updated_at,
         m.first_name AS manager_first_name, m.last_name AS manager_last_name,
         m.email AS manager_email, m.status AS manager_status,
         (SELECT COUNT(*) FROM user_departments ud JOIN users u ON u.id = ud.user_id AND u.deleted_at IS NULL
           WHERE ud.department_id = d.id) AS members_count,
         (SELECT COUNT(*) FROM user_departments ud JOIN users u ON u.id = ud.user_id AND u.deleted_at IS NULL
           WHERE ud.department_id = d.id AND u.status = 'active') AS active_members_count
  FROM departments d
  LEFT JOIN users m ON m.id = d.manager_id AND m.deleted_at IS NULL`;

const SORTABLE = {
  name: 'd.name',
  code: 'd.code',
  status: 'd.status',
  members: 'members_count',
  createdAt: 'd.created_at',
};

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (c) => '\\' + c);
}

/** Ejecuta con una conexión de transacción si se proporciona. */
async function run(conn, sql, params) {
  if (conn) return (await conn.execute(sql, params))[0];
  return query(sql, params);
}

export const DepartmentModel = {
  async findById(companyId, id, conn) {
    const rows = await run(conn, `${BASE_SELECT} WHERE d.company_id = ? AND d.id = ?`, [companyId, id]);
    return rows[0] ?? null;
  },

  async list(companyId, { search, status, page, pageSize, sortBy, sortDir, onlyIds }) {
    const where = ['d.company_id = ?'];
    const params = [companyId];
    if (onlyIds) {
      if (!onlyIds.length) return { items: [], total: 0 };
      where.push(`d.id IN (${onlyIds.map(() => '?').join(',')})`);
      params.push(...onlyIds);
    }
    if (search) {
      where.push('(d.name LIKE ? OR d.code LIKE ? OR d.description LIKE ?)');
      const like = `%${escapeLike(search)}%`;
      params.push(like, like, like);
    }
    if (status) {
      where.push('d.status = ?');
      params.push(status);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const orderCol = SORTABLE[sortBy] ?? 'd.name';
    const orderDir = sortDir === 'desc' ? 'DESC' : 'ASC';
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;

    const [items, countRows] = await Promise.all([
      query(`${BASE_SELECT} ${whereSql} ORDER BY ${orderCol} ${orderDir}, d.id ASC LIMIT ${limit} OFFSET ${offset}`, params),
      query(`SELECT COUNT(*) AS total FROM departments d ${whereSql}`, params),
    ]);
    return { items, total: Number(countRows[0].total) };
  },

  /** Lista ligera para selectores (solo activos salvo que se indique). */
  async options(companyId, { includeInactive = false } = {}) {
    return query(
      `SELECT id, name, code, status FROM departments
       WHERE company_id = ? ${includeInactive ? '' : "AND status = 'active'"}
       ORDER BY name`,
      [companyId],
    );
  },

  async codeExists(companyId, code, excludeId = null) {
    const rows = await query(
      'SELECT id FROM departments WHERE company_id = ? AND code = ? AND id <> ? LIMIT 1',
      [companyId, code, excludeId ?? 0],
    );
    return rows.length > 0;
  },

  async create(conn, data) {
    const [result] = await conn.execute(
      `INSERT INTO departments (company_id, name, code, description, manager_id, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.companyId, data.name, data.code, data.description ?? null, data.managerId ?? null, data.status, data.actorId, data.actorId],
    );
    return result.insertId;
  },

  async update(conn, companyId, id, fields, actorId) {
    const columns = {
      name: 'name',
      code: 'code',
      description: 'description',
      managerId: 'manager_id',
      status: 'status',
    };
    const sets = [];
    const params = [];
    for (const [key, column] of Object.entries(columns)) {
      if (fields[key] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(fields[key]);
      }
    }
    if (!sets.length) return;
    sets.push('updated_by = ?');
    params.push(actorId, companyId, id);
    await run(conn, `UPDATE departments SET ${sets.join(', ')} WHERE company_id = ? AND id = ?`, params);
  },

  async remove(conn, companyId, id) {
    await run(conn, 'DELETE FROM departments WHERE company_id = ? AND id = ?', [companyId, id]);
  },

  /** Usuarios del departamento (no eliminados), con su rol y tipo de membresía. */
  async members(companyId, departmentId) {
    return query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.status, u.created_at,
              r.id AS role_id, r.code AS role_code, r.name AS role_name, r.level AS role_level,
              ud.is_primary, ud.is_agent, ud.created_at AS joined_at
       FROM user_departments ud
       JOIN users u ON u.id = ud.user_id AND u.deleted_at IS NULL
       JOIN roles r ON r.id = u.role_id
       WHERE ud.company_id = ? AND ud.department_id = ?
       ORDER BY r.level DESC, u.first_name, u.last_name`,
      [companyId, departmentId],
    );
  },

  /** Ids de los departamentos a los que pertenece un usuario. */
  async idsForUser(companyId, userId) {
    const rows = await query(
      'SELECT department_id FROM user_departments WHERE company_id = ? AND user_id = ?',
      [companyId, userId],
    );
    return rows.map((r) => r.department_id);
  },

  /** Departamentos de un usuario (principal primero). */
  async forUser(companyId, userId) {
    return query(
      `SELECT d.id, d.name, d.code, d.status, ud.is_primary, ud.is_agent,
              (d.manager_id = ?) AS is_manager
       FROM user_departments ud
       JOIN departments d ON d.id = ud.department_id
       WHERE ud.company_id = ? AND ud.user_id = ?
       ORDER BY ud.is_primary DESC, d.name`,
      [userId, companyId, userId],
    );
  },

  async isMember(companyId, departmentId, userId, conn) {
    const rows = await run(
      conn,
      'SELECT 1 FROM user_departments WHERE company_id = ? AND department_id = ? AND user_id = ? LIMIT 1',
      [companyId, departmentId, userId],
    );
    return rows.length > 0;
  },

  /** Departamentos de los que el usuario es responsable. */
  async managedBy(companyId, userId, conn) {
    return run(conn, 'SELECT id, name, code FROM departments WHERE company_id = ? AND manager_id = ?', [companyId, userId]);
  },

  async countDependents(companyId, departmentId) {
    const rows = await query(
      'SELECT COUNT(*) AS total FROM user_departments WHERE company_id = ? AND department_id = ?',
      [companyId, departmentId],
    );
    return Number(rows[0].total);
  },

  async stats(companyId) {
    const rows = await query(
      `SELECT COUNT(*) AS total, SUM(status = 'active') AS active FROM departments WHERE company_id = ?`,
      [companyId],
    );
    return { total: Number(rows[0].total), active: Number(rows[0].active ?? 0) };
  },

  /** Usuarios activos por departamento activo, para el dashboard. */
  async membersByDepartment(companyId, limit = 8) {
    return query(
      `SELECT d.id, d.name, d.code, COUNT(u.id) AS total
       FROM departments d
       LEFT JOIN user_departments ud ON ud.department_id = d.id
       LEFT JOIN users u ON u.id = ud.user_id AND u.deleted_at IS NULL AND u.status = 'active'
       WHERE d.company_id = ? AND d.status = 'active'
       GROUP BY d.id, d.name, d.code
       ORDER BY total DESC, d.name
       LIMIT ${Number(limit)}`,
      [companyId],
    );
  },

  /* ----- Pertenencia (user_departments) ----- */

  /**
   * Establece el departamento principal de un usuario. Si ya era miembro
   * secundario, la membresía se promueve; la principal anterior se elimina.
   */
  async setPrimary(conn, { companyId, userId, departmentId, isAgent, actorId }) {
    await conn.execute(
      'DELETE FROM user_departments WHERE company_id = ? AND user_id = ? AND is_primary = 1 AND department_id <> ?',
      [companyId, userId, departmentId ?? 0],
    );
    if (!departmentId) return;
    await conn.execute(
      `INSERT INTO user_departments (user_id, department_id, company_id, is_primary, is_agent, assigned_by)
       VALUES (?, ?, ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE is_primary = 1, is_agent = VALUES(is_agent), assigned_by = VALUES(assigned_by)`,
      [userId, departmentId, companyId, isAgent ? 1 : 0, actorId],
    );
  },

  /** Añade una membresía secundaria si el usuario aún no pertenece al departamento. */
  async ensureMember(conn, { companyId, userId, departmentId, isAgent, actorId }) {
    await conn.execute(
      `INSERT IGNORE INTO user_departments (user_id, department_id, company_id, is_primary, is_agent, assigned_by)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [userId, departmentId, companyId, isAgent ? 1 : 0, actorId],
    );
  },

  async primaryForUser(companyId, userId, conn) {
    const rows = await run(
      conn,
      'SELECT department_id FROM user_departments WHERE company_id = ? AND user_id = ? AND is_primary = 1',
      [companyId, userId],
    );
    return rows[0]?.department_id ?? null;
  },

  async setAgentFlagForUser(conn, companyId, userId, isAgent) {
    await run(conn, 'UPDATE user_departments SET is_agent = ? WHERE company_id = ? AND user_id = ?', [
      isAgent ? 1 : 0,
      companyId,
      userId,
    ]);
  },

  async clearManagerForUser(conn, companyId, userId) {
    await run(conn, 'UPDATE departments SET manager_id = NULL WHERE company_id = ? AND manager_id = ?', [companyId, userId]);
  },

  async removeAllMemberships(conn, companyId, userId) {
    await run(conn, 'DELETE FROM user_departments WHERE company_id = ? AND user_id = ?', [companyId, userId]);
  },
};
