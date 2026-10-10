import { PRIORITIES } from '../config/fieldTypes.js';
import { DepartmentModel } from '../models/department.model.js';
import { FormFieldModel } from '../models/formField.model.js';
import { TicketTypeModel } from '../models/ticketType.model.js';
import { UserModel } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { fieldsForAudience } from './formValidation.js';
import { validateWithLookups } from './form.service.js';

/*
 * Catálogo de solicitudes: lo que verá un usuario al crear un ticket (Etapa 4).
 *   Departamento → Categoría → Tipo de solicitud → Formulario dinámico → (Ticket)
 * Solo incluye elementos ACTIVOS de la empresa del usuario.
 */

/** Forma pública de un campo para quien rellena el formulario (sin datos internos). */
function toRenderableField(f) {
  return {
    key: f.key,
    label: f.label,
    description: f.description,
    placeholder: f.placeholder,
    type: f.type,
    required: f.required,
    defaultValue: f.defaultValue,
    rules: f.rules,
    options: f.options.filter((o) => o.isActive).map((o) => ({ value: o.value, label: o.label })),
  };
}

async function activeTypeOrFail(companyId, ticketTypeId) {
  const type = await TicketTypeModel.findById(companyId, ticketTypeId);
  const available =
    type && type.status === 'active' && type.department_status === 'active' && (!type.category_id || type.category_status === 'active');
  if (!available) throw AppError.notFound('Tipo de solicitud no disponible');
  return type;
}

export const RequestCatalogService = {
  async catalog(auth) {
    const rows = await TicketTypeModel.catalog(auth.companyId);
    const departments = new Map();
    for (const t of rows) {
      if (!departments.has(t.department_id)) {
        departments.set(t.department_id, { id: t.department_id, name: t.department_name, code: t.department_code, categories: [], types: [] });
      }
      const dep = departments.get(t.department_id);
      const type = {
        id: t.id,
        name: t.name,
        code: t.code,
        description: t.description,
        defaultPriority: t.default_priority,
        defaultPriorityLabel: PRIORITIES[t.default_priority],
        formVersion: t.form_version,
      };
      if (!t.category_id) {
        dep.types.push(type);
        continue;
      }
      let cat = dep.categories.find((c) => c.id === t.category_id);
      if (!cat) {
        cat = { id: t.category_id, name: t.category_name, types: [] };
        dep.categories.push(cat);
      }
      cat.types.push(type);
    }
    return [...departments.values()];
  },

  /** Formulario publicado de un tipo, tal como lo ve el solicitante. */
  async form(auth, ticketTypeId) {
    const type = await activeTypeOrFail(auth.companyId, ticketTypeId);
    const fields = await FormFieldModel.listByType(auth.companyId, type.id);
    return {
      ticketType: {
        id: type.id,
        name: type.name,
        code: type.code,
        description: type.description,
        department: { id: type.department_id, name: type.department_name },
        category: type.category_id ? { id: type.category_id, name: type.category_name } : null,
        defaultPriority: type.default_priority,
        formVersion: type.form_version,
      },
      fields: fieldsForAudience(fields, 'requester').map(toRenderableField),
    };
  },

  /** Valida una solicitud sin crearla (la Etapa 4 creará el ticket tras esta validación). */
  async validate(auth, ticketTypeId, values) {
    const type = await activeTypeOrFail(auth.companyId, ticketTypeId);
    const fields = await FormFieldModel.listByType(auth.companyId, type.id);
    const result = await validateWithLookups(auth.companyId, fields, values, 'requester');
    return { valid: !Object.keys(result.errors).length, formVersion: type.form_version, ...result };
  },

  /* Opciones dinámicas para los campos "Usuario" y "Departamento". */
  async userOptions(auth) {
    const rows = await UserModel.activeOptions(auth.companyId);
    return rows.map((u) => ({ id: u.id, fullName: `${u.first_name} ${u.last_name}`.trim(), department: u.department_name ?? null }));
  },

  async departmentOptions(auth) {
    const rows = await DepartmentModel.options(auth.companyId);
    return rows.map((d) => ({ id: d.id, name: d.name, code: d.code }));
  },
};
