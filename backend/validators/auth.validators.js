import { z } from 'zod';
import { emailField } from './common.js';

export const loginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria')
    .max(200, 'La contraseña es demasiado larga'),
  rememberMe: z.boolean().optional().default(false),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: 'Introduce tu contraseña actual' }).min(1, 'Introduce tu contraseña actual').max(200),
    newPassword: z.string({ error: 'Introduce la nueva contraseña' }).min(1, 'Introduce la nueva contraseña').max(200),
    confirmPassword: z.string({ error: 'Confirma la nueva contraseña' }).min(1, 'Confirma la nueva contraseña').max(200),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
