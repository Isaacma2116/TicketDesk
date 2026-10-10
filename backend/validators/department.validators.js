import { z } from 'zod';

const status = z.enum(['active', 'inactive'], { error: 'Estado no válido' });

export const departmentName = z
  .string({ error: 'El nombre es obligatorio' })
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres')
  .max(120, 'El nombre no puede superar los 120 caracteres');

// Código corto en mayúsculas: TI, RH, COMPRAS, MANT, FIN-01...
export const departmentCode = z
  .string({ error: 'El código es obligatorio' })
  .trim()
  .toUpperCase()
  .min(2, 'El código debe tener al menos 2 caracteres')
  .max(20, 'El código no puede superar los 20 caracteres')
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/, 'Usa solo letras sin acentos, números, guion o guion bajo (sin espacios)');

const description = z
  .string()
  .trim()
  .max(500, 'La descripción no puede superar los 500 caracteres')
  .nullable()
  .optional()
  .transform((v) => (v ? v : v === undefined ? undefined : null));

const managerId = z
  .union([z.null(), z.literal(''), z.coerce.number().int().positive('Responsable no válido')])
  .optional()
  .transform((v) => (v === '' ? null : v));

export const listDepartmentsQuery = z.object({
  search: z.string().trim().max(100).optional().transform((v) => v || undefined),
  status: z
    .union([z.literal(''), status])
    .optional()
    .transform((v) => v || undefined),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['name', 'code', 'status', 'members', 'createdAt']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export const departmentOptionsQuery = z.object({
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export const managerOptionsQuery = z.object({
  departmentId: z.coerce.number().int().positive().optional(),
});

export const createDepartmentSchema = z
  .object({
    name: departmentName,
    code: departmentCode,
    description,
    managerId,
    status: status.default('active'),
  })
  .strict();

export const updateDepartmentSchema = z
  .object({
    name: departmentName.optional(),
    code: departmentCode.optional(),
    description,
    managerId,
    status: status.optional(),
  })
  .strict()
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'No se enviaron cambios' });

export const departmentStatusSchema = z.object({ status }).strict();
