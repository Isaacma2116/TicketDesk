import {
  AlignLeft,
  Building2,
  Calendar,
  CalendarClock,
  CircleDollarSign,
  Clock,
  Hash,
  Image,
  Laptop,
  List,
  ListChecks,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  ToggleLeft,
  Type,
  UserRound,
} from 'lucide-react';

/*
 * Metadatos de los tipos de campo para la interfaz. Debe mantenerse alineado
 * con backend/config/fieldTypes.js (allí vive la validación definitiva).
 */
export const FIELD_TYPES = {
  short_text: { label: 'Texto corto', icon: Type, group: 'Texto', rules: ['minLength', 'maxLength'], defaultValue: true, placeholder: true, conditional: true },
  long_text: { label: 'Texto largo', icon: AlignLeft, group: 'Texto', rules: ['minLength', 'maxLength'], defaultValue: true, placeholder: true },
  email: { label: 'Correo', icon: Mail, group: 'Texto', rules: [], defaultValue: true, placeholder: true },
  phone: { label: 'Teléfono', icon: Phone, group: 'Texto', rules: [], defaultValue: true, placeholder: true },
  number: { label: 'Número', icon: Hash, group: 'Números y fechas', rules: ['min', 'max', 'decimals'], defaultValue: true, placeholder: true, conditional: true },
  currency: { label: 'Moneda', icon: CircleDollarSign, group: 'Números y fechas', rules: ['min', 'max', 'decimals', 'currency'], defaultValue: true, placeholder: true },
  date: { label: 'Fecha', icon: Calendar, group: 'Números y fechas', rules: [], defaultValue: true },
  time: { label: 'Hora', icon: Clock, group: 'Números y fechas', rules: [], defaultValue: true },
  datetime: { label: 'Fecha y hora', icon: CalendarClock, group: 'Números y fechas', rules: [], defaultValue: true },
  select: { label: 'Lista desplegable', icon: List, group: 'Opciones', rules: [], options: true, defaultValue: true, conditional: true },
  multiselect: { label: 'Selección múltiple', icon: ListChecks, group: 'Opciones', rules: ['minSelected', 'maxSelected'], options: true, defaultValue: true, conditional: true },
  boolean: { label: 'Sí/No', icon: ToggleLeft, group: 'Opciones', rules: [], defaultValue: true, conditional: true },
  asset: { label: 'Equipo', icon: Laptop, group: 'Opciones', rules: [], options: true, defaultValue: true, conditional: true },
  location: { label: 'Ubicación', icon: MapPin, group: 'Opciones', rules: [], options: true, defaultValue: true, conditional: true },
  file: { label: 'Archivo', icon: Paperclip, group: 'Archivos y referencias', rules: ['maxFiles', 'maxSizeMb', 'allowedExtensions'] },
  image: { label: 'Imagen', icon: Image, group: 'Archivos y referencias', rules: ['maxFiles', 'maxSizeMb'] },
  user: { label: 'Usuario', icon: UserRound, group: 'Archivos y referencias', rules: [] },
  department: { label: 'Departamento', icon: Building2, group: 'Archivos y referencias', rules: [] },
};

export const FIELD_GROUPS = ['Texto', 'Números y fechas', 'Opciones', 'Archivos y referencias'];

export const CURRENCIES = ['MXN', 'USD', 'EUR'];
export const FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'zip'];
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
export const DEFAULT_FILE_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg'];

export const PRIORITIES = [
  { value: 'low', label: 'Baja', tone: 'neutral' },
  { value: 'medium', label: 'Media', tone: 'role-supervisor' },
  { value: 'high', label: 'Alta', tone: 'warning' },
  { value: 'urgent', label: 'Urgente', tone: 'danger' },
];
export const priorityOf = (value) => PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[1];

export const SHOW_IF_OPERATORS = [
  { value: 'equals', label: 'es igual a' },
  { value: 'not_equals', label: 'es distinto de' },
  { value: 'is_filled', label: 'tiene un valor' },
  { value: 'is_empty', label: 'está vacío' },
];

export function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
}

/** Misma lógica que el backend (services/formValidation.js). */
export function isConditionMet(showIf, values) {
  if (!showIf?.field) return true;
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

/** Campos visibles en este momento (activos, para la audiencia, y con su condición cumplida). */
export function visibleFields(fields, values, audience = 'requester') {
  const shown = {};
  const result = [];
  for (const f of fields) {
    if (f.status === 'inactive') continue;
    if (audience === 'agent' ? f.visibleToAgent === false : f.visibleToRequester === false) continue;
    // Solo cuentan los valores de campos anteriores visibles (igual que el backend).
    if (!isConditionMet(f.rules?.showIf, shown)) continue;
    shown[f.key] = values[f.key];
    result.push(f);
  }
  return result;
}

/** "Número de empleado" → "numero_de_empleado" (igual que el backend). */
export function slugify(text, max = 50) {
  const slug = String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max);
  if (!slug) return '';
  return /^[a-z]/.test(slug) ? slug : `campo_${slug}`.slice(0, max);
}

/** Valores iniciales de un formulario a partir de los valores predeterminados. */
export function initialValues(fields) {
  const values = {};
  for (const f of fields) {
    if (f.defaultValue !== null && f.defaultValue !== undefined) {
      values[f.key] = typeof f.defaultValue === 'number' ? String(f.defaultValue) : f.defaultValue;
    }
  }
  return values;
}
