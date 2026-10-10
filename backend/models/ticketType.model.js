import { query } from '../config/database.js';

const BASE_SELECT = `
  SELECT t.id, t.company_id, t.department_id, t.category_id, t.name, t.code, t.description,
         t.default_priority, t.assignment_mode, t.assignee_user_id, t.sort_order, t.status,
         t.form_version, t.form_updated_at, t.created_at, t.updated_at,
         d.name AS department_name, d.code AS department_code, d.status AS department_status,
         c.name AS category_name, c.status AS category_status,
         a.first_name AS assignee_first_name, a.last_name AS assignee_last_name, a.email AS assignee_email,
         a.status AS assignee_status,
         (SELECT COUNT(*) FROM form_fields f WHERE f.ticket_type_id = t.id) AS fields_count,
         (SELECT COUNT(*) FROM form_fields f WHERE f.ticket_type_id = t.id AND f.status = 'active') AS active_fields_count
  FROM ticket_types t
  JOIN departments d ON d.id = t.department_id
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN users a ON a.id = t.assignee_user_id AND a.deleted_at IS NULL`;

const SORTABLE = {
  order: 'd.name, t.sort_order',
  name: 't.name',
  code: 't.code',
  department: 'd.name',
  priority: "FIELD(t.default_priority, 'low', 'medium', 'high', 'urgent')",
  status: 't.status',
  fields: 'fields_count',
};

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (ch) => '\\' + ch);
}

async function run(conn, sql, params) {
  if (conn) return (await conn.execute(sql, params))[0];
  return query(sql, params);
}

export const TicketTypeModel = {
  async list(companyId, { search, departmentId, categoryId, status, scopeIds, page, pageSize, sortBy, sortDir }) {
    const where = ['t.company_id = ?'];
    const params = [companyId];
    if (scopeIds) {
      if (!scopeIds.length) return { items: [], total: 0 };
      where.push(`t.department_id IN (${scopeIds.map(() => '?').join(',')})`);
      params.push(...scopeIds);
    }
    if (departmentId) {
      where.push('t.department_id = ?');
      params.push(departmentId);
    }
    if (categoryId === 'none') where.push('t.category_id IS NULL');
    else if (categoryId) {
      where.push('t.category_id = ?');
      params.push(categoryId);
    }
    if (status) {
      where.push('t.status = ?');
      params.push(status);
    }
    if (search) {
      where.push('(t.name LIKE ? OR t.code LIKE ? OR t.description LIKE ?)');
      const like = `%${escapeLike(search)}%`;
      params.push(like, like, like);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';
    const order = (SORTABLE[sortBy] ?? SORTABLE.order)
      .split(', ')
      .map((col) => `${col} ${dir}`)
      .join(', ');
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;
    const [items, countRows] = await Promise.all([
      query(`${BASE_SELECT} ${whereSql} ORDER BY ${order}, t.id ASC LIMIT ${limit} OFFSET ${offset}`, params),
      query(`SELECT COUNT(*) AS total FROM ticket_types t ${whereSql}`, params),
    ]);
    return { items, total: Number(countRows[0].total) };
  },

  async findById(companyId, id, conn) {
    const rows = await run(conn, `${BASE_SELECT} WHERE t.company_id = ? AND t.id = ?`, [companyId, id]);
    return rows[0] ?? null;
  },

  async codeExists(departmentId, code, excludeId = null) {
    const rows = await query('SELECT id FROM ticket_types WHERE department_id = ? AND code = ? AND id <> ? LIMIT 1', [
      departmentId,
      code,
      excludeId ?? 0,
    ]);
    return rows.length > 0;
  },

  async nextOrder(departmentId) {
    const rows = await query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ticket_types WHERE department_id = ?', [
      departmentId,
    ]);
    return Number(rows[0].next);
  },

  async create(data) {
    const result = await query(
      `INSERT INTO ticket_types (company_id, department_id, category_id, name, code, description, default_priority,
                                 assignment_mode, assignee_user_id, sort_order, status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.companyId,
        data.departmentId,
        data.categoryId ?? null,
        data.name,
        data.code,
        data.description ?? null,
        data.defaultPriority,
        data.assignmentMode,
        data.assigneeUserId ?? null,
        data.sortOrder,
        data.status,
        data.actorId,
        data.actorId,
      ],
    );
    return result.insertId;
  },

  async update(companyId, id, fields, actorId) {
    const columns = {
      name: 'name',
      code: 'code',
      description: 'description',
      categoryId: 'category_id',
      defaultPriority: 'default_priority',
      assignmentMode: 'assignment_mode',
      assigneeUserId: 'assignee_user_id',
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
    await query(`UPDATE ticket_types SET ${sets.join(', ')} WHERE company_id = ? AND id = ?`, params);
  },

  async idsByDepartment(companyId, departmentId) {
    const rows = await query('SELECT id FROM ticket_types WHERE company_id = ? AND department_id = ?', [companyId, departmentId]);
    return rows.map((r) => r.id);
  },

  async reorder(conn, companyId, departmentId, ids) {
    for (let i = 0; i < ids.length; i += 1) {
      await conn.execute('UPDATE ticket_types SET sort_order = ? WHERE company_id = ? AND department_id = ? AND id = ?', [
        i + 1,
        companyId,
        departmentId,
        ids[i],
      ]);
    }
  },

  async bumpFormVersion(conn, companyId, id, actorId) {
    await conn.execute(
      `UPDATE ticket_types SET form_version = form_version + 1, form_updated_at = UTC_TIMESTAMP(), updated_by = ?
       WHERE company_id = ? AND id = ?`,
      [actorId, companyId, id],
    );
  },

  /** Tipos activos para el catálogo de solicitudes (departamento y categoría activos). */
  async catalog(companyId) {
    return query(
      `SELECT t.id, t.name, t.code, t.description, t.default_priority, t.department_id, t.category_id,
              t.form_version, d.name AS department_name, d.code AS department_code,
              c.name AS category_name
       FROM ticket_types t
       JOIN departments d ON d.id = t.department_id AND d.status = 'active'
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.company_id = ? AND t.status = 'active' AND (t.category_id IS NULL OR c.status = 'active')
       ORDER BY d.name, COALESCE(c.sort_order, 999999), t.sort_order, t.name`,
      [companyId],
    );
  },

  async countByStatus(companyId) {
    const rows = await query(
      "SELECT COUNT(*) AS total, SUM(status = 'active') AS active FROM ticket_types WHERE company_id = ?",
      [companyId],
    );
    return { total: Number(rows[0].total), active: Number(rows[0].active ?? 0) };
  },
};
