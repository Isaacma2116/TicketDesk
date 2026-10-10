import { z } from 'zod';
import { emailField, nameField, userStatus } from './common.js';

// null o '' = sin departamento.
const departmentId = z
  .union([z.null(), z.literal(''), z.coerce.number().int().positive('Departamento no válido')])
  .optional()
  .transform((v) => (v === '' ? null : v));

const roleId = z.coerce.number({ error: 'Selecciona un rol' }).int().positive('Selecciona un rol');

export const listUsersQuery = z.object({
  search: z.string().trim().max(100).optional().transform((v) => v || undefined),
  roleId: z
    .union([z.literal(''), z.coerce.number().int().positive()])
    .optional()
    .transform((v) => v || undefined),
  status: z
    .union([z.literal(''), userStatus])
    .optional()
    .transform((v) => v || undefined),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  // 'none' = usuarios sin departamento.
  departmentId: z
    .union([z.literal(''), z.literal('none'), z.coerce.number().int().positive()])
    .optional()
    .transform((v) => v || undefined),
  sortBy: z.enum(['name', 'lastName', 'email', 'role', 'department', 'status', 'createdAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const createUserSchema = z
  .object({
    firstName: nameField('El nombre'),
    lastName: nameField('Los apellidos'),
    email: emailField,
    // Vacío = el sistema genera una contraseña temporal segura.
    password: z
      .string()
      .max(72, 'La contraseña no puede superar los 72 caracteres')
      .optional()
      .transform((v) => v || undefined),
    roleId,
    departmentId,
    status: userStatus.default('active'),
  })
  .strict();

export const updateUserSchema = z
  .object({
    firstName: nameField('El nombre').optional(),
    lastName: nameField('Los apellidos').optional(),
    email: emailField.optional(),
    roleId: roleId.optional(),
    departmentId,
    resetPassword: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'No se enviaron cambios',
  });

export const changeStatusSchema = z.object({ status: userStatus }).strict();
