import { z } from 'zod';

const TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'));

/** Texto opcional: vacío → null, para poder borrar un campo. */
const optionalText = (max, label) =>
  z
    .string()
    .trim()
    .max(max, `${label} no puede superar los ${max} caracteres`)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));

const withPattern = (max, label, regex, message) =>
  optionalText(max, label).refine((v) => v == null || regex.test(v), message);

export const updateCompanySchema = z
  .object({
    name: z
      .string({ error: 'El nombre de la empresa es obligatorio' })
      .trim()
      .min(2, 'El nombre de la empresa es obligatorio')
      .max(150, 'El nombre no puede superar los 150 caracteres')
      .optional(),
    tradeName: optionalText(150, 'El nombre comercial'),
    // RFC mexicano: 3 (moral) o 4 (física) letras + fecha AAMMDD + homoclave.
    rfc: optionalText(13, 'El RFC')
      .transform((v) => (v ? v.toUpperCase() : v))
      .refine((v) => v == null || /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(v), 'RFC no válido (ej. ABC123456XY1)'),
    email: optionalText(191, 'El correo')
      .transform((v) => (v ? v.toLowerCase() : v))
      .refine((v) => v == null || z.email().safeParse(v).success, 'Introduce un correo electrónico válido'),
    phone: withPattern(30, 'El teléfono', /^[+\d][\d\s().-]{6,29}$/, 'Teléfono no válido'),
    address: optionalText(255, 'La dirección'),
    city: optionalText(100, 'La ciudad'),
    state: optionalText(100, 'El estado'),
    postalCode: withPattern(10, 'El código postal', /^[A-Za-z0-9 -]{3,10}$/, 'Código postal no válido'),
    country: optionalText(100, 'El país'),
    website: optionalText(255, 'El sitio web').refine((v) => {
      if (v == null) return true;
      try {
        const url = new URL(v);
        return url.protocol === 'https:' || url.protocol === 'http:';
      } catch {
        return false;
      }
    }, 'Introduce una URL válida que empiece por https://'),
    timezone: z
      .string()
      .refine((v) => TIMEZONES.has(v), 'Zona horaria no válida')
      .optional(),
    status: z.enum(['active', 'inactive'], { error: 'Estado no válido' }).optional(),
  })
  .strict();
