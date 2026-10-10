import { query } from '../config/database.js';

const COLUMNS = `id, name, trade_name, rfc, email, phone, address, city, state, postal_code,
                 country, website, logo_path, timezone, status, created_at, updated_at`;

export const CompanyModel = {
  async findById(id) {
    const rows = await query(`SELECT ${COLUMNS} FROM companies WHERE id = ?`, [id]);
    return rows[0] ?? null;
  },

  async findFirst() {
    const rows = await query(`SELECT ${COLUMNS} FROM companies ORDER BY id LIMIT 1`);
    return rows[0] ?? null;
  },

  async rfcExists(rfc, excludeId) {
    const rows = await query('SELECT id FROM companies WHERE rfc = ? AND id <> ? LIMIT 1', [rfc, excludeId]);
    return rows.length > 0;
  },

  async update(id, fields) {
    const columns = {
      name: 'name',
      tradeName: 'trade_name',
      rfc: 'rfc',
      email: 'email',
      phone: 'phone',
      address: 'address',
      city: 'city',
      state: 'state',
      postalCode: 'postal_code',
      country: 'country',
      website: 'website',
      timezone: 'timezone',
      status: 'status',
      logoPath: 'logo_path',
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
    params.push(id);
    await query(`UPDATE companies SET ${sets.join(', ')} WHERE id = ?`, params);
  },
};
