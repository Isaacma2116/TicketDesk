import { query } from '../config/database.js';

/* Todas las consultas se acotan por companyId (y opcionalmente por un conjunto de departamentos). */

const BASE_SELECT = `
  SELECT c.id, c.company_id, c.department_id, c.name, c.description, c.sort_order, c.status,
         c.created_at, c.updated_at,
         d.name AS department_name, d.code AS department_code, d.status AS department_status,
         (SELECT COUNT(*) FROM ticket_types t WHERE t.category_id = c.id) AS types_count,
         (SELECT COUNT(*) FROM ticket_types t WHERE t.category_id = c.id AND t.status = 'active') AS active_types_count
  FROM categories c
  JOIN departments d ON d.id = c.department_id`;

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (ch) => '\\' + ch);
}

async function run(conn, sql, params) {
  if (conn) return (await conn.execute(sql, params))[0];
  return query(sql, params);
}

function scopeClause(scopeIds, column, params) {
  if (!scopeIds) return '';
  if (!scopeIds.length) return ' AND 1 = 0';
  params.push(...scopeIds);
  return ` AND ${column} IN (${scopeIds.map(() => '?').join(',')})`;
}

export const CategoryModel = {
  async list(companyId, { search, departmentId, status, scopeIds }) {
    const params = [companyId];
    let where = 'WHERE c.company_id = ?';
    where += scopeClause(scopeIds, 'c.department_id', params);
    if (departmentId) {
      where += ' AND c.department_id = ?';
      params.push(departmentId);
    }
    if (status) {
      where += ' AND c.status = ?';
      params.push(status);
    }
    if (search) {
      where += ' AND (c.name LIKE ? OR c.description LIKE ?)';
      const like = `%${escapeLike(search)}%`;
      params.push(like, like);
    }
    return query(`${BASE_SELECT} ${where} ORDER BY d.name, c.sort_order, c.name`, params);
  },

  async findById(companyId, id, conn) {
    const rows = await run(conn, `${BASE_SELECT} WHERE c.company_id = ? AND c.id = ?`, [companyId, id]);
    return rows[0] ?? null;
  },

  async nameExists(departmentId, name, excludeId = null) {
    const rows = await query('SELECT id FROM categories WHERE department_id = ? AND name = ? AND id <> ? LIMIT 1', [
      departmentId,
      name,
      excludeId ?? 0,
    ]);
    return rows.length > 0;
  },

  async nextOrder(departmentId) {
    const rows = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM categories WHERE department_id = ?', [departmentId]);
    return Number(rows[0].next);
  },

  async create(data) {
    const result = await query(
      `INSERT INTO categories (company_id, department_id, name, description, sort_order, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.companyId, data.departmentId, data.name, data.description ?? null, data.sortOrder, data.status, data.actorId, data.actorId],
    );
    return result.insertId;
  },

  async update(companyId, id, fields, actorId) {
    const columns = { name: 'name', description: 'description', status: 'status' };
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
    await query(`UPDATE categories SET ${sets.join(', ')} WHERE company_id = ? AND id = ?`, params);
  },

  async idsByDepartment(companyId, departmentId) {
    const rows = await query('SELECT id FROM categories WHERE company_id = ? AND department_id = ?', [companyId, departmentId]);
    return rows.map((r) => r.id);
  },

  async reorder(conn, companyId, departmentId, ids) {
    for (let i = 0; i < ids.length; i += 1) {
      await conn.execute('UPDATE categories SET sort_order = ? WHERE company_id = ? AND department_id = ? AND id = ?', [
        i + 1,
        companyId,
        departmentId,
        ids[i],
      ]);
    }
  },

  async countByStatus(companyId) {
    const rows = await query(
      "SELECT COUNT(*) AS total, SUM(status = 'active') AS active FROM categories WHERE company_id = ?",
      [companyId],
    );
    return { total: Number(rows[0].total), active: Number(rows[0].active ?? 0) };
  },
};
