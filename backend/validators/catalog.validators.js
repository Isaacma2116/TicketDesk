import { z } from 'zod';
import {
  CURRENCIES,
  FIELD_TYPE_KEYS,
  FILE_EXTENSIONS,
  LIMITS,
  PRIORITIES,
  SHOW_IF_OPERATORS,
} from '../config/fieldTypes.js';

const status = z.enum(['active', 'inactive'], { error: 'Estado no válido' });
const id = (msg) => z.coerce.number({ error: msg }).int(msg).positive(msg);
const optionalId = z
  .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
  .optional()
  .transform((v) => (v === '' ? null : v));

/** Texto opcional: '' → null; undefined se respeta (sin cambios). */
const optionalText = (max, label) =>
  z
    .string()
    .trim()
    .max(max, `${label} no puede superar los ${max} caracteres`)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));

const listQueryBase = {
  search: z.string().trim().max(100).optional().transform((v) => v || undefined),
  departmentId: optionalId.transform((v) => v || undefined),
  status: z.union([z.literal(''), status]).optional().transform((v) => v || undefined),
};

/* ----------------------------- Categorías ----------------------------- */

const categoryName = z
  .string({ error: 'El nombre es obligatorio' })
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(100, 'El nombre no puede superar los 100 caracteres');

export const listCategoriesQuery = z.object(listQueryBase);

export const createCategorySchema = z
  .object({
    departmentId: id('Selecciona un departamento'),
    name: categoryName,
    description: optionalText(300, 'La descripción'),
    status: status.default('active'),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: categoryName.optional(),
    description: optionalText(300, 'La descripción'),
    status: status.optional(),
  })
  .strict()
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'No se enviaron cambios' });

export const reorderSchema = z
  .object({
    departmentId: id('Departamento no válido'),
    ids: z.array(z.coerce.number().int().positive()).min(1, 'Lista vacía').max(500),
  })
  .strict();

/* ------------------------- Tipos de solicitud ------------------------- */

const priority = z.enum(Object.keys(PRIORITIES), { error: 'Prioridad no válida' });
const typeName = z
  .string({ error: 'El nombre es obligatorio' })
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(120, 'El nombre no puede superar los 120 caracteres');
const typeCode = z
  .string({ error: 'El código es obligatorio' })
  .trim()
  .toUpperCase()
  .min(2, 'El código debe tener al menos 2 caracteres')
  .max(30, 'El código no puede superar los 30 caracteres')
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/, 'Usa solo letras sin acentos, números, guion o guion bajo (sin espacios)');

export const listTicketTypesQuery = z.object({
  ...listQueryBase,
  categoryId: z
    .union([z.literal(''), z.literal('none'), z.coerce.number().int().positive()])
    .optional()
    .transform((v) => v || undefined),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['order', 'name', 'code', 'department', 'priority', 'status', 'fields']).default('order'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

const typeFields = {
  name: typeName,
  code: typeCode,
  description: optionalText(500, 'La descripción'),
  categoryId: optionalId,
  defaultPriority: priority,
  assignmentMode: z.enum(['department', 'user'], { error: 'Modo de asignación no válido' }),
  assigneeUserId: optionalId,
  status,
};

export const createTicketTypeSchema = z
  .object({
    departmentId: id('Selecciona un departamento'),
    ...typeFields,
    defaultPriority: priority.default('medium'),
    assignmentMode: typeFields.assignmentMode.default('department'),
    status: status.default('active'),
  })
  .strict();

// El departamento no se puede cambiar: los campos, categoría y responsable dependen de él.
export const updateTicketTypeSchema = z
  .object(Object.fromEntries(Object.entries(typeFields).map(([k, v]) => [k, v.optional()])))
  .strict()
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'No se enviaron cambios' });

export const statusSchema = z.object({ status }).strict();

/* ------------------------ Campos de formulario ------------------------ */

const num = z.number({ error: 'Debe ser un número' }).finite();
const smallInt = (max) => z.number({ error: 'Debe ser un número entero' }).int('Debe ser un número entero').min(0).max(max);

export const rulesSchema = z
  .object({
    minLength: smallInt(LIMITS.longTextMax).optional(),
    maxLength: smallInt(LIMITS.longTextMax).optional(),
    min: num.optional(),
    max: num.optional(),
    decimals: smallInt(4).optional(),
    currency: z.enum(CURRENCIES, { error: 'Moneda no válida' }).optional(),
    minSelected: smallInt(LIMITS.maxOptionsPerField).optional(),
    maxSelected: smallInt(LIMITS.maxOptionsPerField).optional(),
    maxFiles: z.number().int().min(1, 'Mínimo 1').max(LIMITS.maxFiles, `Máximo ${LIMITS.maxFiles}`).optional(),
    maxSizeMb: z.number().int().min(1, 'Mínimo 1 MB').max(LIMITS.maxSizeMb, `Máximo ${LIMITS.maxSizeMb} MB`).optional(),
    allowedExtensions: z
      .array(z.enum(FILE_EXTENSIONS, { error: 'Extensión no permitida' }))
      .min(1, 'Selecciona al menos una extensión')
      .optional(),
    showIf: z
      .object({
        field: z.string().min(1, 'Selecciona el campo de la condición'),
        op: z.enum(SHOW_IF_OPERATORS, { error: 'Operador no válido' }),
        value: z.union([z.string().max(150), z.number(), z.boolean()]).nullable().optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export const optionSchema = z
  .object({
    id: z.number().int().positive().optional(),
    value: z
      .string()
      .trim()
      .max(80, 'Máximo 80 caracteres')
      .regex(/^[a-z0-9_-]*$/, 'Solo minúsculas, números, guion y guion bajo')
      .optional(),
    label: z.string({ error: 'La opción necesita un texto' }).trim().min(1, 'La opción necesita un texto').max(150, 'Máximo 150 caracteres'),
    isActive: z.boolean().default(true),
  })
  .strict();

export const fieldSchema = z
  .object({
    id: z.number().int().positive().optional(),
    key: z
      .string()
      .trim()
      .max(60, 'Máximo 60 caracteres')
      .regex(/^[a-z][a-z0-9_]*$/, 'Nombre interno: minúsculas, números y guion bajo; empieza con letra')
      .optional(),
    label: z.string({ error: 'La etiqueta es obligatoria' }).trim().min(1, 'La etiqueta es obligatoria').max(120, 'Máximo 120 caracteres'),
    description: optionalText(300, 'La descripción'),
    placeholder: optionalText(120, 'El texto de ejemplo'),
    type: z.enum(FIELD_TYPE_KEYS, { error: 'Tipo de campo no válido' }),
    required: z.boolean().default(false),
    defaultValue: z.unknown().optional(),
    rules: rulesSchema.default({}),
    visibleToRequester: z.boolean().default(true),
    visibleToAgent: z.boolean().default(true),
    status: status.default('active'),
    options: z.array(optionSchema).max(LIMITS.maxOptionsPerField, `Máximo ${LIMITS.maxOptionsPerField} opciones`).default([]),
  })
  .strict();

export const saveFormSchema = z
  .object({
    fields: z.array(fieldSchema).max(LIMITS.maxFieldsPerForm, `Máximo ${LIMITS.maxFieldsPerForm} campos por formulario`),
  })
  .strict();

export const fieldOrderSchema = z.object({ ids: z.array(z.number().int().positive()).max(LIMITS.maxFieldsPerForm) }).strict();

// Actualización parcial de un campo (endpoint granular).
export const updateFieldSchema = fieldSchema.partial().omit({ id: true });

export const optionUpdateSchema = optionSchema.partial().omit({ id: true });

export const previewSubmissionSchema = z
  .object({
    values: z.record(z.string(), z.unknown()).default({}),
    audience: z.enum(['requester', 'agent']).default('requester'),
    // Definición en borrador (constructor): si se envía, se valida contra ella en lugar de la guardada.
    fields: z.array(fieldSchema).max(LIMITS.maxFieldsPerForm).optional(),
  })
  .strict();

export const fieldIdParam = z.object({ fieldId: z.coerce.number().int().positive('Identificador no válido') });
export const optionIdParam = z.object({ optionId: z.coerce.number().int().positive('Identificador no válido') });
