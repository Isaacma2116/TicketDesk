import { query } from '../config/database.js';

function parseJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value; // mysql2 ya devuelve objetos para columnas JSON
}

/** Fila de BD → forma de la API. */
function toField(row, options) {
  return {
    id: row.id,
    key: row.field_key,
    label: row.label,
    description: row.description,
    placeholder: row.placeholder,
    type: row.field_type,
    required: Boolean(row.is_required),
    defaultValue: parseJson(row.default_value),
    rules: parseJson(row.rules) ?? {},
    sortOrder: row.sort_order,
    visibleToRequester: Boolean(row.visible_to_requester),
    visibleToAgent: Boolean(row.visible_to_agent),
    status: row.status,
    options: options.map((o) => ({ id: o.id, value: o.value, label: o.label, isActive: Boolean(o.is_active) })),
  };
}

export const FormFieldModel = {
  /** Campos de un tipo de solicitud con sus opciones, en orden. */
  async listByType(companyId, ticketTypeId, conn) {
    const exec = conn ? async (sql, p) => (await conn.execute(sql, p))[0] : query;
    const fields = await exec(
      'SELECT * FROM form_fields WHERE company_id = ? AND ticket_type_id = ? ORDER BY sort_order, id',
      [companyId, ticketTypeId],
    );
    if (!fields.length) return [];
    const ids = fields.map((f) => f.id);
    const options = await exec(
      `SELECT * FROM form_field_options WHERE company_id = ? AND field_id IN (${ids.map(() => '?').join(',')})
       ORDER BY sort_order, id`,
      [companyId, ...ids],
    );
    return fields.map((f) =>
      toField(
        f,
        options.filter((o) => o.field_id === f.id),
      ),
    );
  },

  /** Localiza el tipo de solicitud al que pertenece un campo (acotado por empresa). */
  async findOwner(companyId, fieldId) {
    const rows = await query('SELECT id, ticket_type_id FROM form_fields WHERE company_id = ? AND id = ?', [companyId, fieldId]);
    return rows[0] ?? null;
  },

  async findOptionOwner(companyId, optionId) {
    const rows = await query(
      `SELECT o.id, o.field_id, f.ticket_type_id FROM form_field_options o
       JOIN form_fields f ON f.id = o.field_id
       WHERE o.company_id = ? AND o.id = ?`,
      [companyId, optionId],
    );
    return rows[0] ?? null;
  },

  async insertField(conn, companyId, ticketTypeId, f) {
    const [result] = await conn.execute(
      `INSERT INTO form_fields (company_id, ticket_type_id, field_key, label, description, placeholder, field_type,
                                is_required, default_value, rules, sort_order, visible_to_requester, visible_to_agent, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        ticketTypeId,
        f.key,
        f.label,
        f.description ?? null,
        f.placeholder ?? null,
        f.type,
        f.required ? 1 : 0,
        f.defaultValue === null || f.defaultValue === undefined ? null : JSON.stringify(f.defaultValue),
        JSON.stringify(f.rules ?? {}),
        f.sortOrder,
        f.visibleToRequester ? 1 : 0,
        f.visibleToAgent ? 1 : 0,
        f.status,
      ],
    );
    return result.insertId;
  },

  async updateField(conn, companyId, ticketTypeId, f) {
    await conn.execute(
      `UPDATE form_fields SET field_key = ?, label = ?, description = ?, placeholder = ?, field_type = ?, is_required = ?,
              default_value = ?, rules = ?, sort_order = ?, visible_to_requester = ?, visible_to_agent = ?, status = ?
       WHERE company_id = ? AND ticket_type_id = ? AND id = ?`,
      [
        f.key,
        f.label,
        f.description ?? null,
        f.placeholder ?? null,
        f.type,
        f.required ? 1 : 0,
        f.defaultValue === null || f.defaultValue === undefined ? null : JSON.stringify(f.defaultValue),
        JSON.stringify(f.rules ?? {}),
        f.sortOrder,
        f.visibleToRequester ? 1 : 0,
        f.visibleToAgent ? 1 : 0,
        f.status,
        companyId,
        ticketTypeId,
        f.id,
      ],
    );
  },

  async deleteFields(conn, companyId, ticketTypeId, ids) {
    if (!ids.length) return;
    await conn.execute(
      `DELETE FROM form_fields WHERE company_id = ? AND ticket_type_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
      [companyId, ticketTypeId, ...ids],
    );
  },

  /**
   * Las claves y valores son únicos: para evitar choques al renombrar/reordenar
   * dentro de la misma transacción, primero se asignan valores temporales.
   */
  async releaseKeys(conn, companyId, ticketTypeId, ids) {
    if (!ids.length) return;
    await conn.execute(
      `UPDATE form_fields SET field_key = CONCAT('__tmp_', id) WHERE company_id = ? AND ticket_type_id = ?
       AND id IN (${ids.map(() => '?').join(',')})`,
      [companyId, ticketTypeId, ...ids],
    );
  },

  async syncOptions(conn, companyId, fieldId, options) {
    const [existing] = await conn.execute('SELECT id FROM form_field_options WHERE company_id = ? AND field_id = ?', [
      companyId,
      fieldId,
    ]);
    const keep = new Set(options.filter((o) => o.id).map((o) => o.id));
    const remove = existing.map((r) => r.id).filter((id) => !keep.has(id));
    if (remove.length) {
      await conn.execute(
        `DELETE FROM form_field_options WHERE company_id = ? AND field_id = ? AND id IN (${remove.map(() => '?').join(',')})`,
        [companyId, fieldId, ...remove],
      );
    }
    const kept = existing.map((r) => r.id).filter((id) => keep.has(id));
    if (kept.length) {
      await conn.execute(
        `UPDATE form_field_options SET value = CONCAT('__tmp_', id) WHERE company_id = ? AND field_id = ?
         AND id IN (${kept.map(() => '?').join(',')})`,
        [companyId, fieldId, ...kept],
      );
    }
    for (let i = 0; i < options.length; i += 1) {
      const o = options[i];
      if (o.id) {
        await conn.execute(
          'UPDATE form_field_options SET value = ?, label = ?, sort_order = ?, is_active = ? WHERE company_id = ? AND field_id = ? AND id = ?',
          [o.value, o.label, i + 1, o.isActive ? 1 : 0, companyId, fieldId, o.id],
        );
      } else {
        await conn.execute(
          'INSERT INTO form_field_options (company_id, field_id, value, label, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)',
          [companyId, fieldId, o.value, o.label, i + 1, o.isActive ? 1 : 0],
        );
      }
    }
  },

  async countFields(companyId) {
    const rows = await query('SELECT COUNT(*) AS total FROM form_fields WHERE company_id = ?', [companyId]);
    return Number(rows[0].total);
  },
};
