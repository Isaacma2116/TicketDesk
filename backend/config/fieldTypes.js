/**
 * Catálogo de tipos de campo de los formularios dinámicos.
 * Debe mantenerse alineado con frontend/src/components/forms/fieldTypes.js.
 *
 *  - rules:        reglas configurables que admite el tipo.
 *  - options:      usa una lista de opciones (form_field_options).
 *  - defaultValue: admite valor predeterminado.
 *  - placeholder:  admite texto de ejemplo.
 *  - conditional:  puede usarse como origen de una regla "mostrar si".
 */
export const FIELD_TYPES = Object.freeze({
  short_text: { label: 'Texto corto', rules: ['minLength', 'maxLength'], defaultValue: true, placeholder: true, conditional: true },
  long_text: { label: 'Texto largo', rules: ['minLength', 'maxLength'], defaultValue: true, placeholder: true },
  number: { label: 'Número', rules: ['min', 'max', 'decimals'], defaultValue: true, placeholder: true, conditional: true },
  currency: { label: 'Moneda', rules: ['min', 'max', 'decimals', 'currency'], defaultValue: true, placeholder: true },
  date: { label: 'Fecha', rules: [], defaultValue: true },
  time: { label: 'Hora', rules: [], defaultValue: true },
  datetime: { label: 'Fecha y hora', rules: [], defaultValue: true },
  email: { label: 'Correo', rules: [], defaultValue: true, placeholder: true },
  phone: { label: 'Teléfono', rules: [], defaultValue: true, placeholder: true },
  select: { label: 'Lista desplegable', rules: [], options: true, defaultValue: true, conditional: true },
  multiselect: { label: 'Selección múltiple', rules: ['minSelected', 'maxSelected'], options: true, defaultValue: true, conditional: true },
  boolean: { label: 'Sí/No', rules: [], defaultValue: true, conditional: true },
  file: { label: 'Archivo', rules: ['maxFiles', 'maxSizeMb', 'allowedExtensions'] },
  image: { label: 'Imagen', rules: ['maxFiles', 'maxSizeMb'] },
  user: { label: 'Usuario', rules: [] },
  department: { label: 'Departamento', rules: [] },
  // Equipo y Ubicación usan, por ahora, la lista de opciones del campo. Cuando
  // existan los catálogos de activos/ubicaciones podrán alimentarse de ellos.
  asset: { label: 'Equipo', rules: [], options: true, defaultValue: true, conditional: true },
  location: { label: 'Ubicación', rules: [], options: true, defaultValue: true, conditional: true },
});

export const FIELD_TYPE_KEYS = Object.keys(FIELD_TYPES);

export const CURRENCIES = ['MXN', 'USD', 'EUR'];
export const SHOW_IF_OPERATORS = ['equals', 'not_equals', 'is_filled', 'is_empty'];

/** Extensiones de archivo admitidas (lista blanca: nunca ejecutables). */
export const FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'zip'];
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
export const DEFAULT_FILE_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg'];

export const LIMITS = Object.freeze({
  maxFieldsPerForm: 60,
  maxOptionsPerField: 200,
  shortTextMax: 255,
  longTextMax: 5000,
  maxFiles: 10,
  maxSizeMb: 20,
});

export const PRIORITIES = Object.freeze({
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
});
