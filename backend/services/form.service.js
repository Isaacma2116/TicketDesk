import { withTransaction } from '../config/database.js';
import { DEFAULT_FILE_EXTENSIONS, FIELD_TYPES, LIMITS } from '../config/fieldTypes.js';
import { DepartmentModel } from '../models/department.model.js';
import { FormFieldModel } from '../models/formField.model.js';
import { TicketTypeModel } from '../models/ticketType.model.js';
import { UserModel } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { fieldSchema } from '../validators/catalog.validators.js';
import { AUDIT_ACTIONS, AuditService } from './audit.service.js';
import { validateSubmission, validateValue } from './formValidation.js';
import { ticketTypeInScopeOrFail, toPublicTicketType } from './ticketType.service.js';

/** "Número de empleado" → "numero_de_empleado" */
export function slugify(text, max = 50) {
  const slug = String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max);
  if (!slug) return 'campo';
  return /^[a-z]/.test(slug) ? slug : `campo_${slug}`.slice(0, max);
}

function uniqueKey(base, used) {
  let key = base;
  let n = 2;
  while (used.has(key)) key = `${base.slice(0, 55)}_${n++}`;
  used.add(key);
  return key;
}

class FormErrors {
  constructor() {
    this.details = {};
  }
  add(index, prop, message) {
    const key = `fields.${index}${prop ? `.${prop}` : ''}`;
    if (!this.details[key]) this.details[key] = message;
  }
  throwIfAny() {
    const entries = Object.keys(this.details);
    if (!entries.length) return;
    const first = this.details[entries[0]];
    throw new AppError(400, `Revisa la configuración del formulario: ${first}`, { code: 'INVALID_FORM', details: this.details });
  }
}

/**
 * Valida y normaliza la definición completa de un formulario.
 * @param rawFields   campos tal como llegan (ya validados por zod).
 * @param existing    campos guardados actualmente (para ids y claves).
 */
export function normalizeForm(rawFields, existing) {
  const errors = new FormErrors();
  const existingById = new Map(existing.map((f) => [f.id, f]));
  const usedKeys = new Set();
  const seenIds = new Set();

  // 1ª pasada: identidad y claves.
  const fields = rawFields.map((raw, i) => {
    if (raw.id !== undefined) {
      if (!existingById.has(raw.id)) errors.add(i, 'id', 'El campo no pertenece a este formulario');
      if (seenIds.has(raw.id)) errors.add(i, 'id', 'Campo duplicado');
      seenIds.add(raw.id);
    }
    const key = raw.key || existingById.get(raw.id)?.key || slugify(raw.label);
    if (usedKeys.has(key)) {
      if (raw.key) errors.add(i, 'key', `El nombre interno "${key}" está repetido`);
      return { ...raw, key: uniqueKey(key, usedKeys) };
    }
    usedKeys.add(key);
    return { ...raw, key };
  });

  // 2ª pasada: reglas por tipo, opciones, valor predeterminado y condiciones.
  const normalized = fields.map((f, i) => {
    const def = FIELD_TYPES[f.type];
    const allowedRules = new Set([...def.rules, 'showIf']);
    const rules = Object.fromEntries(Object.entries(f.rules ?? {}).filter(([k, v]) => allowedRules.has(k) && v !== null && v !== undefined));

    if (!f.visibleToRequester && !f.visibleToAgent) errors.add(i, 'visibleToRequester', 'El campo debe ser visible para alguien');

    // Coherencia de reglas.
    const cap = f.type === 'short_text' ? LIMITS.shortTextMax : LIMITS.longTextMax;
    if (rules.maxLength !== undefined && rules.maxLength > cap) errors.add(i, 'rules.maxLength', `Máximo permitido: ${cap}`);
    if (rules.maxLength !== undefined && rules.maxLength < 1) errors.add(i, 'rules.maxLength', 'Debe ser al menos 1');
    if (rules.minLength !== undefined && rules.maxLength !== undefined && rules.minLength > rules.maxLength) {
      errors.add(i, 'rules.minLength', 'La longitud mínima no puede superar la máxima');
    }
    if (rules.min !== undefined && rules.max !== undefined && rules.min > rules.max) {
      errors.add(i, 'rules.min', 'El mínimo no puede superar el máximo');
    }
    if (f.type === 'currency' && !rules.currency) rules.currency = 'MXN';
    if (f.type === 'file' && !rules.allowedExtensions) rules.allowedExtensions = DEFAULT_FILE_EXTENSIONS;
    if ((f.type === 'file' || f.type === 'image') && !rules.maxFiles) rules.maxFiles = 1;
    if ((f.type === 'file' || f.type === 'image') && !rules.maxSizeMb) rules.maxSizeMb = 10;

    // Opciones.
    let options = [];
    if (def.options) {
      const usedValues = new Set();
      options = (f.options ?? []).map((o, oi) => {
        const value = o.value || slugify(o.label, 70);
        if (usedValues.has(value)) {
          if (o.value) errors.add(i, `options.${oi}.value`, `El valor "${value}" está repetido`);
          return { ...o, value: uniqueKey(value, usedValues) };
        }
        usedValues.add(value);
        return { ...o, value };
      });
      const active = options.filter((o) => o.isActive).length;
      if (!active) errors.add(i, 'options', 'Agrega al menos una opción activa');
      if (rules.minSelected !== undefined && rules.maxSelected !== undefined && rules.minSelected > rules.maxSelected) {
        errors.add(i, 'rules.minSelected', 'El mínimo no puede superar el máximo');
      }
      if (rules.maxSelected !== undefined && rules.maxSelected > active) {
        errors.add(i, 'rules.maxSelected', `Solo hay ${active} opciones activas`);
      }
    }

    const field = {
      id: f.id,
      key: f.key,
      label: f.label,
      description: f.description ?? null,
      placeholder: def.placeholder ? (f.placeholder ?? null) : null,
      type: f.type,
      required: f.required,
      rules,
      sortOrder: i + 1,
      visibleToRequester: f.visibleToRequester,
      visibleToAgent: f.visibleToAgent,
      status: f.status,
      options,
      defaultValue: null,
    };

    // Valor predeterminado: debe pasar la misma validación que un valor enviado.
    const hasDefault = f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '' &&
      !(Array.isArray(f.defaultValue) && !f.defaultValue.length);
    if (hasDefault) {
      if (!def.defaultValue) errors.add(i, 'defaultValue', 'Este tipo de campo no admite valor predeterminado');
      else {
        const result = validateValue({ ...field, required: false }, f.defaultValue);
        if (result.error) errors.add(i, 'defaultValue', `Valor predeterminado no válido: ${result.error}`);
        else field.defaultValue = result.value;
      }
    }
    return field;
  });

  // Condiciones "mostrar si": solo pueden depender de un campo ANTERIOR (evita ciclos).
  normalized.forEach((field, i) => {
    const showIf = field.rules.showIf;
    if (!showIf) return;
    const sourceIndex = normalized.findIndex((s) => s.key === showIf.field);
    if (sourceIndex === -1 || sourceIndex >= i) {
      errors.add(i, 'rules.showIf', 'La condición debe depender de un campo que esté antes en el formulario');
      return;
    }
    const source = normalized[sourceIndex];
    if (!FIELD_TYPES[source.type].conditional) {
      errors.add(i, 'rules.showIf', `No se pueden crear condiciones con un campo de tipo ${FIELD_TYPES[source.type].label}`);
    }
    if (['equals', 'not_equals'].includes(showIf.op)) {
      if (showIf.value === undefined || showIf.value === null || showIf.value === '') {
        errors.add(i, 'rules.showIf', 'Indica el valor de la condición');
      } else if (source.options.length && !source.options.some((o) => o.value === String(showIf.value))) {
        errors.add(i, 'rules.showIf', 'El valor de la condición no es una opción del campo');
      }
    } else {
      delete showIf.value;
    }
  });

  errors.throwIfAny();
  return normalized;
}

async function loadForm(auth, ticketTypeId) {
  const type = await ticketTypeInScopeOrFail(auth, ticketTypeId);
  const fields = await FormFieldModel.listByType(auth.companyId, type.id);
  return { type, fields };
}

/** Convierte un campo guardado a la forma de entrada (para operaciones granulares). */
const asInput = (f) => fieldSchema.parse({
  id: f.id,
  key: f.key,
  label: f.label,
  description: f.description,
  placeholder: f.placeholder,
  type: f.type,
  required: f.required,
  defaultValue: f.defaultValue ?? undefined,
  rules: f.rules,
  visibleToRequester: f.visibleToRequester,
  visibleToAgent: f.visibleToAgent,
  status: f.status,
  options: f.options.map((o) => ({ id: o.id, value: o.value, label: o.label, isActive: o.isActive })),
});

function summarize(before, after) {
  const beforeIds = new Set(before.map((f) => f.id));
  const afterIds = new Set(after.filter((f) => f.id).map((f) => f.id));
  return {
    added: after.filter((f) => !f.id).map((f) => f.key),
    removed: before.filter((f) => !afterIds.has(f.id)).map((f) => f.key),
    updated: after.filter((f) => f.id && beforeIds.has(f.id)).length,
    total: after.length,
  };
}

export const FormService = {
  async get(auth, ticketTypeId) {
    const { type, fields } = await loadForm(auth, ticketTypeId);
    return { ticketType: toPublicTicketType(type, auth), fields };
  },

  /** Reemplaza la definición completa del formulario (operación atómica). */
  async save(auth, ticketTypeId, rawFields) {
    const { type, fields: existing } = await loadForm(auth, ticketTypeId);
    const fields = normalizeForm(rawFields, existing);
    const { companyId } = auth;

    await withTransaction(async (conn) => {
      const keepIds = fields.filter((f) => f.id).map((f) => f.id);
      const removeIds = existing.map((f) => f.id).filter((id) => !keepIds.includes(id));
      // Los tickets (Etapa 4) guardarán una copia del formulario, así que borrar
      // un campo no altera solicitudes históricas. Para conservarlo, desactívalo.
      await FormFieldModel.deleteFields(conn, companyId, type.id, removeIds);
      await FormFieldModel.releaseKeys(conn, companyId, type.id, keepIds);
      for (const field of fields) {
        const id = field.id
          ? (await FormFieldModel.updateField(conn, companyId, type.id, field), field.id)
          : await FormFieldModel.insertField(conn, companyId, type.id, field);
        await FormFieldModel.syncOptions(conn, companyId, id, field.options);
      }
      await TicketTypeModel.bumpFormVersion(conn, companyId, type.id, auth.user.id);
    });

    await AuditService.log(auth.audit, AUDIT_ACTIONS.FORM_UPDATED, 'ticket_type', type.id, {
      formVersion: { from: type.form_version, to: type.form_version + 1 },
      ...summarize(existing, fields),
    });
    return this.get(auth, ticketTypeId);
  },

  /* ---------- Operaciones granulares (reutilizan la misma validación) ---------- */

  async addField(auth, ticketTypeId, field) {
    const { fields } = await loadForm(auth, ticketTypeId);
    const result = await this.save(auth, ticketTypeId, [...fields.map(asInput), field]);
    return { ...result, field: result.fields[result.fields.length - 1] };
  },

  async fieldContext(auth, fieldId) {
    const owner = await FormFieldModel.findOwner(auth.companyId, fieldId);
    if (!owner) throw AppError.notFound('Campo no encontrado');
    const { fields } = await loadForm(auth, owner.ticket_type_id);
    return { ticketTypeId: owner.ticket_type_id, fields };
  },

  async updateField(auth, fieldId, partial) {
    const { ticketTypeId, fields } = await this.fieldContext(auth, fieldId);
    const next = fields.map((f) => (f.id === fieldId ? { ...asInput(f), ...partial, id: f.id } : asInput(f)));
    const result = await this.save(auth, ticketTypeId, next);
    return { ...result, field: result.fields.find((f) => f.id === fieldId) };
  },

  async deleteField(auth, fieldId) {
    const { ticketTypeId, fields } = await this.fieldContext(auth, fieldId);
    const target = fields.find((f) => f.id === fieldId);
    const dependent = fields.find((f) => f.rules?.showIf?.field === target.key);
    if (dependent) {
      throw AppError.conflict(`No se puede eliminar: el campo "${dependent.label}" depende de él. Quita esa condición primero.`, 'FIELD_HAS_DEPENDENTS');
    }
    return this.save(auth, ticketTypeId, fields.filter((f) => f.id !== fieldId).map(asInput));
  },

  async reorderFields(auth, ticketTypeId, ids) {
    const { fields } = await loadForm(auth, ticketTypeId);
    const same = ids.length === fields.length && new Set(ids).size === ids.length && fields.every((f) => ids.includes(f.id));
    if (!same) throw AppError.badRequest('La lista debe contener exactamente los campos del formulario', { ids: 'Lista no válida' });
    const byId = new Map(fields.map((f) => [f.id, f]));
    return this.save(auth, ticketTypeId, ids.map((id) => asInput(byId.get(id))));
  },

  async listOptions(auth, fieldId) {
    const { fields } = await this.fieldContext(auth, fieldId);
    const field = fields.find((f) => f.id === fieldId);
    if (!FIELD_TYPES[field.type].options) throw AppError.badRequest('Este tipo de campo no usa opciones');
    return field.options;
  },

  async addOption(auth, fieldId, option) {
    const { fields } = await this.fieldContext(auth, fieldId);
    const field = fields.find((f) => f.id === fieldId);
    if (!FIELD_TYPES[field.type].options) throw AppError.badRequest('Este tipo de campo no usa opciones');
    const result = await this.updateField(auth, fieldId, { options: [...asInput(field).options, option] });
    return result.field.options[result.field.options.length - 1];
  },

  async optionContext(auth, optionId) {
    const owner = await FormFieldModel.findOptionOwner(auth.companyId, optionId);
    if (!owner) throw AppError.notFound('Opción no encontrada');
    const { fields } = await this.fieldContext(auth, owner.field_id);
    return { fieldId: owner.field_id, field: fields.find((f) => f.id === owner.field_id) };
  },

  async updateOption(auth, optionId, partial) {
    const { fieldId, field } = await this.optionContext(auth, optionId);
    const options = asInput(field).options.map((o) => (o.id === optionId ? { ...o, ...partial, id: o.id } : o));
    const result = await this.updateField(auth, fieldId, { options });
    return result.field.options.find((o) => o.id === optionId);
  },

  async deleteOption(auth, optionId) {
    const { fieldId, field } = await this.optionContext(auth, optionId);
    await this.updateField(auth, fieldId, { options: asInput(field).options.filter((o) => o.id !== optionId) });
  },

  /**
   * Valida valores contra el formulario (sin crear nada). Lo usa la vista previa
   * del constructor; en la Etapa 4 la creación de tickets usará esta misma lógica.
   */
  async validateValues(auth, ticketTypeId, { values, audience, fields: draft }) {
    const { fields: saved } = await loadForm(auth, ticketTypeId);
    const definition = draft ? normalizeForm(draft, saved) : saved;
    const result = await validateWithLookups(auth.companyId, definition, values, audience);
    return { valid: !Object.keys(result.errors).length, ...result };
  },
};

/** validateSubmission + comprobación de que usuarios/departamentos existen en la empresa. */
export async function validateWithLookups(companyId, fields, input, audience) {
  const { values, errors } = validateSubmission(fields, input, { audience });
  for (const field of fields) {
    const value = values[field.key];
    if (value === undefined) continue;
    if (field.type === 'user') {
      const user = await UserModel.findById(companyId, value);
      if (!user || user.status !== 'active') errors[field.key] = 'Selecciona un usuario válido';
    }
    if (field.type === 'department') {
      const dep = await DepartmentModel.findById(companyId, value);
      if (!dep || dep.status !== 'active') errors[field.key] = 'Selecciona un departamento válido';
    }
  }
  for (const key of Object.keys(errors)) delete values[key];
  return { values, errors };
}
