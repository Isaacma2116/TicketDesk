import { query } from '../config/database.js';

/*
 * Todas las consultas de negocio reciben companyId: un usuario solo puede ver
 * y modificar usuarios de su propia empresa. La única excepción es la
 * autenticación (por correo, que es único en toda la plataforma).
 */

const BASE_SELECT = `
  SELECT u.id, u.company_id, u.first_name, u.last_name, u.email, u.status, u.must_change_password,
         u.last_login_at, u.created_at, u.updated_at, u.created_by,
         r.id AS role_id, r.code AS role_code, r.name AS role_name, r.level AS role_level,
         TRIM(CONCAT(cb.first_name, ' ', cb.last_name)) AS created_by_name,
         pd.id AS department_id, pd.name AS department_name, pd.code AS department_code,
         pd.status AS department_status
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN users cb ON cb.id = u.created_by
  LEFT JOIN user_departments pud ON pud.user_id = u.id AND pud.is_primary = 1
  LEFT JOIN departments pd ON pd.id = pud.department_id`;

// Lista blanca de columnas ordenables (nunca se interpola entrada del cliente).
const SORTABLE = {
  name: 'u.first_name',
  lastName: 'u.last_name',
  email: 'u.email',
  role: 'r.level',
  department: 'pd.name',
  status: 'u.status',
  createdAt: 'u.created_at',
};

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (c) => '\\' + c);
}

async function run(conn, sql, params) {
  if (conn) return (await conn.execute(sql, params))[0];
  return query(sql, params);
}

export const UserModel = {
  async findById(companyId, id, conn) {
    const rows = await run(conn, `${BASE_SELECT} WHERE u.company_id = ? AND u.id = ? AND u.deleted_at IS NULL`, [
      companyId,
      id,
    ]);
    return rows[0] ?? null;
  },

  /** Incluye password_hash y datos de bloqueo: uso exclusivo de autenticación. */
  async findForAuthByEmail(email) {
    const rows = await query(
      `SELECT u.id, u.company_id, u.email, u.password_hash, u.status, u.failed_login_attempts, u.locked_until,
              r.code AS role_code, c.status AS company_status
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN companies c ON c.id = u.company_id
       WHERE u.email = ? AND u.deleted_at IS NULL`,
      [email],
    );
    return rows[0] ?? null;
  },

  async findPasswordHash(id) {
    const rows = await query('SELECT password_hash FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
    return rows[0]?.password_hash ?? null;
  },

  /** El correo es único en toda la plataforma (el login no pide empresa). */
  async emailExists(email, excludeId = null) {
    const rows = await query(
      'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL AND id <> ? LIMIT 1',
      [email, excludeId ?? 0],
    );
    return rows.length > 0;
  },

  async list(companyId, { search, roleId, status, departmentId, page, pageSize, sortBy, sortDir }) {
    const where = ['u.company_id = ?', 'u.deleted_at IS NULL'];
    const params = [companyId];
    if (search) {
      where.push(`(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?
                   OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?)`);
      const like = `%${escapeLike(search)}%`;
      params.push(like, like, like, like);
    }
    if (roleId) {
      where.push('u.role_id = ?');
      params.push(roleId);
    }
    if (status) {
      where.push('u.status = ?');
      params.push(status);
    }
    if (departmentId === 'none') {
      where.push('pud.department_id IS NULL');
    } else if (departmentId) {
      // Pertenece al departamento (principal o secundario).
      where.push('EXISTS (SELECT 1 FROM user_departments x WHERE x.user_id = u.id AND x.department_id = ?)');
      params.push(departmentId);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const orderCol = SORTABLE[sortBy] ?? 'u.created_at';
    const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC';
    // page/pageSize llegan validados como enteros por zod; se interpolan porque
    // los prepared statements de MySQL no aceptan bien parámetros en LIMIT.
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;

    const [items, countRows] = await Promise.all([
      query(`${BASE_SELECT} ${whereSql} ORDER BY ${orderCol} ${orderDir}, u.id DESC LIMIT ${limit} OFFSET ${offset}`, params),
      query(
        `SELECT COUNT(*) AS total FROM users u JOIN roles r ON r.id = u.role_id
         LEFT JOIN user_departments pud ON pud.user_id = u.id AND pud.is_primary = 1 ${whereSql}`,
        params,
      ),
    ]);
    return { items, total: Number(countRows[0].total) };
  },

  /** Usuarios activos seleccionables (p. ej. como responsable de departamento). */
  async activeOptions(companyId) {
    return query(
      `SELECT u.id, u.first_name, u.last_name, u.email, r.code AS role_code, r.name AS role_name,
              pd.id AS department_id, pd.name AS department_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN user_departments pud ON pud.user_id = u.id AND pud.is_primary = 1
       LEFT JOIN departments pd ON pd.id = pud.department_id
       WHERE u.company_id = ? AND u.deleted_at IS NULL AND u.status = 'active'
       ORDER BY u.first_name, u.last_name`,
      [companyId],
    );
  },

  async create(data, conn) {
    const result = await run(
      conn,
      `INSERT INTO users (company_id, first_name, last_name, email, password_hash, role_id, status,
                          must_change_password, password_changed_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?)`,
      [
        data.companyId,
        data.firstName,
        data.lastName,
        data.email,
        data.passwordHash,
        data.roleId,
        data.status,
        data.mustChangePassword ? 1 : 0,
        data.createdBy ?? null,
        data.createdBy ?? null,
      ],
    );
    return result.insertId;
  },

  async update(companyId, id, fields, updatedBy, conn) {
    const columns = {
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      roleId: 'role_id',
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
    if (fields.passwordHash !== undefined) {
      sets.push('password_hash = ?', 'password_changed_at = UTC_TIMESTAMP()', 'failed_login_attempts = 0', 'locked_until = NULL');
      params.push(fields.passwordHash);
    }
    if (fields.mustChangePassword !== undefined) {
      sets.push('must_change_password = ?');
      params.push(fields.mustChangePassword ? 1 : 0);
    }
    if (!sets.length) return;
    sets.push('updated_by = ?');
    params.push(updatedBy ?? null, companyId, id);
    await run(conn, `UPDATE users SET ${sets.join(', ')} WHERE company_id = ? AND id = ? AND deleted_at IS NULL`, params);
  },

  async softDelete(companyId, id, deletedBy, conn) {
    await run(
      conn,
      `UPDATE users SET deleted_at = UTC_TIMESTAMP(), status = 'inactive', updated_by = ?
       WHERE company_id = ? AND id = ? AND deleted_at IS NULL`,
      [deletedBy, companyId, id],
    );
  },

  async registerFailedLogin(id, maxAttempts, lockMinutes) {
    // Al alcanzar el máximo se bloquea la cuenta y se reinicia el contador.
    await query(
      `UPDATE users SET
         locked_until = IF(failed_login_attempts + 1 >= ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE, locked_until),
         failed_login_attempts = IF(failed_login_attempts + 1 >= ?, 0, failed_login_attempts + 1)
       WHERE id = ?`,
      [maxAttempts, lockMinutes, maxAttempts, id],
    );
  },

  async registerSuccessfulLogin(id) {
    await query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [id],
    );
  },

  async countByStatus(companyId) {
    return query(
      'SELECT status, COUNT(*) AS total FROM users WHERE company_id = ? AND deleted_at IS NULL GROUP BY status',
      [companyId],
    );
  },

  async countByRole(companyId) {
    return query(
      `SELECT r.id, r.code, r.name, r.level, COUNT(u.id) AS total
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id AND u.deleted_at IS NULL AND u.company_id = ?
       GROUP BY r.id, r.code, r.name, r.level
       ORDER BY r.level DESC`,
      [companyId],
    );
  },

  async countCreatedSince(companyId, days) {
    const rows = await query(
      `SELECT COUNT(*) AS total FROM users
       WHERE company_id = ? AND deleted_at IS NULL AND created_at >= UTC_TIMESTAMP() - INTERVAL ? DAY`,
      [companyId, days],
    );
    return Number(rows[0].total);
  },

  async countWithoutDepartment(companyId) {
    const rows = await query(
      `SELECT COUNT(*) AS total FROM users u
       LEFT JOIN user_departments pud ON pud.user_id = u.id AND pud.is_primary = 1
       WHERE u.company_id = ? AND u.deleted_at IS NULL AND pud.user_id IS NULL`,
      [companyId],
    );
    return Number(rows[0].total);
  },

  async recent(companyId, limit = 5) {
    return query(
      `${BASE_SELECT} WHERE u.company_id = ? AND u.deleted_at IS NULL
       ORDER BY u.created_at DESC, u.id DESC LIMIT ${Number(limit)}`,
      [companyId],
    );
  },

  async countActiveByRoleCode(companyId, code) {
    const rows = await query(
      `SELECT COUNT(*) AS total FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.company_id = ? AND r.code = ? AND u.status = 'active' AND u.deleted_at IS NULL`,
      [companyId, code],
    );
    return Number(rows[0].total);
  },
};
