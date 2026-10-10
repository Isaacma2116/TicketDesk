import { query } from '../config/database.js';

export const SessionModel = {
  async create({ userId, tokenHash, rememberMe, ip, userAgent, expiresAt }) {
    await query(
      `INSERT INTO user_sessions (user_id, token_hash, remember_me, ip_address, user_agent, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
      [userId, tokenHash, rememberMe ? 1 : 0, ip, userAgent, expiresAt],
    );
  },

  /** Sesión válida (no revocada ni expirada) junto con el usuario y su rol. */
  async findActiveByTokenHash(tokenHash) {
    const rows = await query(
      `SELECT s.id AS session_id, s.remember_me, s.expires_at, s.last_seen_at, s.created_at AS session_created_at,
              u.id, u.company_id, u.first_name, u.last_name, u.email, u.status, u.must_change_password,
              u.last_login_at, u.created_at, u.updated_at, u.created_by,
              r.id AS role_id, r.code AS role_code, r.name AS role_name, r.level AS role_level,
              c.name AS company_name, c.trade_name AS company_trade_name, c.status AS company_status,
              c.logo_path AS company_logo_path, c.updated_at AS company_updated_at,
              pd.id AS department_id, pd.name AS department_name, pd.code AS department_code,
              pd.status AS department_status
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL
       JOIN roles r ON r.id = u.role_id
       JOIN companies c ON c.id = u.company_id
       LEFT JOIN user_departments pud ON pud.user_id = u.id AND pud.is_primary = 1
       LEFT JOIN departments pd ON pd.id = pud.department_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()`,
      [tokenHash],
    );
    return rows[0] ?? null;
  },

  async touch(sessionId) {
    await query('UPDATE user_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?', [sessionId]);
  },

  async revoke(sessionId) {
    await query('UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL', [sessionId]);
  },

  async revokeAllForUser(userId, exceptSessionId = null) {
    await query(
      `UPDATE user_sessions SET revoked_at = UTC_TIMESTAMP()
       WHERE user_id = ? AND revoked_at IS NULL AND id <> ?`,
      [userId, exceptSessionId ?? 0],
    );
  },

  /** Limpieza periódica de sesiones caducadas o revocadas hace más de 7 días. */
  async purgeOld() {
    const result = await query(
      `DELETE FROM user_sessions
       WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 7 DAY
          OR revoked_at < UTC_TIMESTAMP() - INTERVAL 7 DAY`,
    );
    return result.affectedRows;
  },
};
