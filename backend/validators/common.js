import { z } from 'zod';

export const emailField = z
  .string({ error: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .min(1, 'El correo es obligatorio')
  .max(191, 'El correo es demasiado largo')
  .pipe(z.email('Introduce un correo electrónico válido'));

export const nameField = (label) =>
  z
    .string({ error: `${label} es obligatorio` })
    .trim()
    .min(1, `${label} es obligatorio`)
    .max(100, `${label} no puede superar los 100 caracteres`)
    .regex(/^[\p{L}\p{M}' .-]+$/u, `${label} solo puede contener letras, espacios, apóstrofos y guiones`);

export const idParam = z.object({
  id: z.coerce.number({ error: 'Identificador no válido' }).int().positive('Identificador no válido'),
});

export const userStatus = z.enum(['active', 'inactive'], { error: 'Estado no válido' });
