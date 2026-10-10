// Validaciones del lado del cliente para dar feedback inmediato.
// El backend vuelve a validar todo: estas reglas son solo de usabilidad.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}\p{M}' .-]+$/u;

export function validateEmail(value) {
  const v = value.trim();
  if (!v) return 'El correo es obligatorio';
  if (!EMAIL_RE.test(v)) return 'Introduce un correo electrónico válido';
  return null;
}

export function validateName(value, label) {
  const v = value.trim();
  if (!v) return `${label} es obligatorio`;
  if (v.length > 100) return `${label} no puede superar los 100 caracteres`;
  if (!NAME_RE.test(v)) return `${label} solo puede contener letras, espacios y guiones`;
  return null;
}

export const PASSWORD_RULES = [
  { id: 'length', label: 'Mínimo 8 caracteres', test: (v) => v.length >= 8 },
  { id: 'lower', label: 'Una letra minúscula', test: (v) => /[a-z]/.test(v) },
  { id: 'upper', label: 'Una letra mayúscula', test: (v) => /[A-Z]/.test(v) },
  { id: 'digit', label: 'Un número', test: (v) => /\d/.test(v) },
];

export function validatePassword(value) {
  if (!value) return 'La contraseña es obligatoria';
  if (new TextEncoder().encode(value).length > 72) return 'La contraseña no puede superar los 72 caracteres';
  const failed = PASSWORD_RULES.filter((r) => !r.test(value));
  if (failed.length) return `Debe incluir: ${failed.map((r) => r.label.toLowerCase()).join(', ')}`;
  return null;
}
