import {
  DEFAULT_FILE_EXTENSIONS,
  FIELD_TYPES,
  IMAGE_EXTENSIONS,
  LIMITS,
} from '../config/fieldTypes.js';

/*
 * Validación de VALORES de un formulario dinámico.
 *
 * Se usa en tres sitios:
 *  1. Al guardar un formulario: el valor predeterminado de cada campo debe ser válido.
 *  2. En la vista previa del constructor ("Enviar solicitud" de prueba).
 *  3. En la Etapa 4, al crear un ticket real: mismo código, mismas reglas.
 *
 * Los campos llegan normalizados (forma de la API): { key, label, type, required,
 * rules, options: [{ value, label, isActive }], status, visibleToRequester, visibleToAgent }.
 */

const REQUIRED = 'Este campo es obligatorio';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+\d][\d\s().-]{6,29}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
}

function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

function decimalsOf(n) {
  const s = String(n);
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

const activeValues = (field) => new Set((field.options ?? []).filter((o) => o.isActive !== false).map((o) => o.value));

/**
 * Valida un valor según el tipo y reglas del campo.
 * @returns {{ value } | { error }}  value normalizado (null si está vacío).
 */
export function validateValue(field, raw) {
  const rules = field.rules ?? {};
  if (isEmpty(raw)) return field.required ? { error: REQUIRED } : { value: null };

  switch (field.type) {
    case 'short_text':
    case 'long_text': {
      if (typeof raw !== 'string') return { error: 'Debe ser un texto' };
      const value = raw.trim();
      const cap = field.type === 'short_text' ? LIMITS.shortTextMax : LIMITS.longTextMax;
      const max = Math.min(rules.maxLength ?? cap, cap);
      if (rules.minLength && value.length < rules.minLength) return { error: `Debe tener al menos ${rules.minLength} caracteres` };
      if (value.length > max) return { error: `No puede superar los ${max} caracteres` };
      return { value };
    }
    case 'number':
    case 'currency': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
      if (!Number.isFinite(n)) return { error: 'Introduce un número válido' };
      const decimals = rules.decimals ?? (field.type === 'currency' ? 2 : undefined);
      if (decimals !== undefined && decimalsOf(n) > decimals) {
        return { error: decimals === 0 ? 'Debe ser un número entero' : `Máximo ${decimals} decimales` };
      }
      if (rules.min !== undefined && n < rules.min) return { error: `El valor mínimo es ${rules.min}` };
      if (rules.max !== undefined && n > rules.max) return { error: `El valor máximo es ${rules.max}` };
      return { value: n };
    }
    case 'date':
      return typeof raw === 'string' && isValidDate(raw) ? { value: raw } : { error: 'Fecha no válida (AAAA-MM-DD)' };
    case 'time':
      return typeof raw === 'string' && TIME_RE.test(raw) ? { value: raw } : { error: 'Hora no válida (HH:MM)' };
    case 'datetime': {
      const ok = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) && isValidDate(raw.slice(0, 10)) && TIME_RE.test(raw.slice(11));
      return ok ? { value: raw } : { error: 'Fecha y hora no válidas' };
    }
    case 'email': {
      const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
      return EMAIL_RE.test(value) && value.length <= 191 ? { value } : { error: 'Introduce un correo electrónico válido' };
    }
    case 'phone': {
      const value = typeof raw === 'string' ? raw.trim() : '';
      return PHONE_RE.test(value) ? { value } : { error: 'Introduce un teléfono válido' };
    }
    case 'select':
    case 'asset':
    case 'location':
      return typeof raw === 'string' && activeValues(field).has(raw) ? { value: raw } : { error: 'Selecciona una opción válida' };
    case 'multiselect': {
      if (!Array.isArray(raw) || raw.some((v) => typeof v !== 'string')) return { error: 'Selecciona opciones válidas' };
      const allowed = activeValues(field);
      const value = [...new Set(raw)];
      if (value.some((v) => !allowed.has(v))) return { error: 'Hay opciones no válidas' };
      if (rules.minSelected && value.length < rules.minSelected) return { error: `Selecciona al menos ${rules.minSelected}` };
      if (rules.maxSelected && value.length > rules.maxSelected) return { error: `Selecciona como máximo ${rules.maxSelected}` };
      return { value };
    }
    case 'boolean': {
      if (raw === true || raw === 'true') return { value: true };
      if (raw === false || raw === 'false') return field.required ? { error: 'Debes marcar esta opción' } : { value: false };
      return { error: 'Valor no válido' };
    }
    case 'file':
    case 'image': {
      // Hasta la Etapa 4 se validan los metadatos { name, size, type }; allí
      // se sustituirán por referencias a archivos ya subidos y verificados.
      if (!Array.isArray(raw)) return { error: 'Archivos no válidos' };
      const maxFiles = rules.maxFiles ?? 1;
      const maxBytes = (rules.maxSizeMb ?? 10) * 1024 * 1024;
      const allowed = field.type === 'image' ? IMAGE_EXTENSIONS : (rules.allowedExtensions ?? DEFAULT_FILE_EXTENSIONS);
      if (raw.length > maxFiles) return { error: `Máximo ${maxFiles} archivo(s)` };
      for (const f of raw) {
        if (!f || typeof f.name !== 'string' || typeof f.size !== 'number') return { error: 'Archivos no válidos' };
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (!allowed.includes(ext)) return { error: `Formato no permitido. Usa: ${allowed.join(', ')}` };
        if (f.size > maxBytes) return { error: `Cada archivo debe pesar como máximo ${rules.maxSizeMb ?? 10} MB` };
      }
      return { value: raw.map((f) => ({ name: f.name.slice(0, 255), size: f.size })) };
    }
    case 'user':
    case 'department': {
      const id = typeof raw === 'number' ? raw : Number(raw);
      return Number.isInteger(id) && id > 0 ? { value: id } : { error: 'Selecciona un elemento válido' };
    }
    default:
      return { error: 'Tipo de campo no soportado' };
  }
}

/** Evalúa la regla "mostrar si" de un campo con los valores actuales del formulario. */
export function isConditionMet(showIf, values) {
  if (!showIf) return true;
  const current = values[showIf.field];
  switch (showIf.op) {
    case 'is_filled':
      return !isEmpty(current);
    case 'is_empty':
      return isEmpty(current);
    case 'equals':
    case 'not_equals': {
      const target = String(showIf.value ?? '');
      const matches = Array.isArray(current) ? current.map(String).includes(target) : String(current ?? '') === target;
      return showIf.op === 'equals' ? matches : !matches;
    }
    default:
      return true;
  }
}

/** Campos que ve una audiencia ('requester' | 'agent'), activos y en orden. */
export function fieldsForAudience(fields, audience) {
  return fields
    .filter((f) => f.status === 'active')
    .filter((f) => (audience === 'agent' ? f.visibleToAgent : f.visibleToRequester))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Valida los valores enviados para un formulario.
 * - Ignora (y descarta) los campos ocultos por reglas "mostrar si".
 * - Rechaza claves desconocidas.
 * @returns {{ values, errors }}  errors: { [fieldKey]: mensaje }
 */
export function validateSubmission(fields, input, { audience = 'requester' } = {}) {
  const visible = fieldsForAudience(fields, audience);
  const known = new Set(visible.map((f) => f.key));
  const errors = {};
  const values = {};
  const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};

  const unknown = Object.keys(data).filter((k) => !known.has(k));
  if (unknown.length) errors._ = `Campos no permitidos: ${unknown.join(', ')}`;

  for (const field of visible) {
    // La condición se evalúa SOLO con valores ya validados de campos anteriores y
    // visibles: un campo oculto nunca puede activar a otro.
    if (!isConditionMet(field.rules?.showIf, values)) continue;
    const result = validateValue(field, data[field.key]);
    if (result.error) errors[field.key] = result.error;
    else if (result.value !== null) values[field.key] = result.value;
  }
  return { values, errors };
}
