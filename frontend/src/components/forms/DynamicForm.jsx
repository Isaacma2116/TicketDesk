import { useId, useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { FieldError } from '../ui';
import { DEFAULT_FILE_EXTENSIONS, IMAGE_EXTENSIONS, visibleFields } from './fieldTypes';

/*
 * Renderizador de formularios dinámicos.
 * Lo usa la vista previa del constructor y, en la Etapa 4, la creación de tickets.
 *
 * Valores por tipo:
 *  - texto/correo/teléfono/número/moneda/fecha/hora → string
 *  - lista/equipo/ubicación → string (valor de la opción)
 *  - selección múltiple → string[]
 *  - sí/no → boolean
 *  - archivo/imagen → [{ name, size, type }] (en la Etapa 4: archivos subidos)
 *  - usuario/departamento → id (string del <select>)
 */

function FieldShell({ field, id, error, children, as = 'div' }) {
  const Tag = as;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <Tag className="field dyn-field" {...(as === 'fieldset' ? { 'aria-describedby': errorId } : {})}>
      {as === 'fieldset' ? (
        <legend className="field__label">
          {field.label}
          {field.required && <span className="req" aria-hidden="true">*</span>}
        </legend>
      ) : (
        <label className="field__label" htmlFor={id}>
          {field.label}
          {field.required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {field.description && (
        <p className="field__hint dyn-field__help" id={hintId}>
          {field.description}
        </p>
      )}
      {children}
      <FieldError id={errorId}>{error}</FieldError>
    </Tag>
  );
}

function FileInput({ field, id, value = [], onChange, disabled, aria }) {
  const ref = useRef(null);
  const rules = field.rules ?? {};
  const exts = field.type === 'image' ? IMAGE_EXTENSIONS : (rules.allowedExtensions ?? DEFAULT_FILE_EXTENSIONS);
  const maxFiles = rules.maxFiles ?? 1;
  const pick = (e) => {
    const files = Array.from(e.target.files ?? []).map((f) => ({ name: f.name, size: f.size, type: f.type }));
    e.target.value = '';
    onChange([...value, ...files].slice(0, Math.max(maxFiles, 1)));
  };
  return (
    <div className="dyn-file">
      <input
        ref={ref}
        id={id}
        type="file"
        className="sr-only"
        multiple={maxFiles > 1}
        accept={exts.map((x) => `.${x}`).join(',')}
        onChange={pick}
        disabled={disabled || value.length >= maxFiles}
        {...aria}
      />
      <button type="button" className="btn btn--sm" onClick={() => ref.current?.click()} disabled={disabled || value.length >= maxFiles}>
        <Paperclip aria-hidden="true" /> {field.type === 'image' ? 'Seleccionar imagen' : 'Seleccionar archivo'}
      </button>
      <span className="field__hint">
        {exts.join(', ').toUpperCase()} · máx. {rules.maxSizeMb ?? 10} MB{maxFiles > 1 ? ` · hasta ${maxFiles} archivos` : ''}
      </span>
      {value.length > 0 && (
        <ul className="dyn-file__list">
          {value.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <span>{f.name}</span>
              <span className="muted">{(f.size / 1024).toFixed(0)} KB</span>
              {!disabled && (
                <button type="button" className="input-action" aria-label={`Quitar ${f.name}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <X aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Control de un único campo (también lo usa el editor para el valor predeterminado). */
export function FieldControl({ field, value, onChange, error, disabled, lookups = {}, id: forcedId }) {
  const autoId = useId();
  const id = forcedId ?? autoId;
  const aria = {
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': [field.description && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined,
    'aria-required': field.required || undefined,
  };
  const rules = field.rules ?? {};
  const options = (field.options ?? []).filter((o) => o.isActive !== false);
  const text = (type, extra = {}) => (
    <input
      id={id}
      type={type}
      className="input"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? ''}
      disabled={disabled}
      {...extra}
      {...aria}
    />
  );

  switch (field.type) {
    case 'short_text':
      return text('text', { maxLength: rules.maxLength ?? 255 });
    case 'long_text':
      return (
        <textarea
          id={id}
          className="input textarea"
          rows={4}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''}
          maxLength={rules.maxLength ?? 5000}
          disabled={disabled}
          {...aria}
        />
      );
    case 'email':
      return text('email', { autoComplete: 'off' });
    case 'phone':
      return text('tel');
    case 'number':
      return text('number', { min: rules.min, max: rules.max, step: rules.decimals ? 1 / 10 ** rules.decimals : rules.decimals === 0 ? 1 : 'any', inputMode: 'decimal' });
    case 'currency':
      return (
        <div className="input-wrap">
          <span className="input-prefix">{rules.currency ?? 'MXN'}</span>
          {text('number', { className: 'input input--prefixed', min: rules.min, max: rules.max, step: 1 / 10 ** (rules.decimals ?? 2), inputMode: 'decimal' })}
        </div>
      );
    case 'date':
      return text('date');
    case 'time':
      return text('time');
    case 'datetime':
      return text('datetime-local');
    case 'select':
    case 'asset':
    case 'location':
      return (
        <select id={id} className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} {...aria}>
          <option value="">{field.placeholder || 'Selecciona una opción'}</option>
          {options.map((o) => (
            <option key={o.value || o.label} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'multiselect': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="dyn-checks" role="group" id={id} {...aria}>
          {options.map((o) => (
            <label key={o.value || o.label} className="checkbox">
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    case 'boolean':
      return (
        <label className="switch">
          <input
            id={id}
            type="checkbox"
            role="switch"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            {...aria}
          />
          <span className="switch__track" aria-hidden="true" />
          <span>{value === true ? 'Sí' : 'No'}</span>
        </label>
      );
    case 'file':
    case 'image':
      return <FileInput field={field} id={id} value={Array.isArray(value) ? value : []} onChange={onChange} disabled={disabled} aria={aria} />;
    case 'user':
      return (
        <select id={id} className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} {...aria}>
          <option value="">{lookups.users ? 'Selecciona un usuario' : 'Cargando usuarios…'}</option>
          {(lookups.users ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
              {u.department ? ` · ${u.department}` : ''}
            </option>
          ))}
        </select>
      );
    case 'department':
      return (
        <select id={id} className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled} {...aria}>
          <option value="">{lookups.departments ? 'Selecciona un departamento' : 'Cargando departamentos…'}</option>
          {(lookups.departments ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      );
    default:
      return <p className="muted">Tipo de campo no soportado</p>;
  }
}

/**
 * Formulario completo.
 * @param fields   definición (orden ya aplicado)
 * @param values   { [key]: valor }
 * @param onChange (key, valor) => void
 */
export function DynamicForm({ fields, values, onChange, errors = {}, audience = 'requester', lookups, disabled, emptyText }) {
  const shown = visibleFields(fields, values, audience);
  if (!shown.length) {
    return <p className="muted dyn-empty">{emptyText ?? 'Este formulario todavía no tiene campos visibles.'}</p>;
  }
  return (
    <div className="dyn-form">
      {shown.map((field) => (
        <DynamicFieldRow
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(v) => onChange(field.key, v)}
          error={errors[field.key]}
          lookups={lookups}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function DynamicFieldRow({ field, value, onChange, error, lookups, disabled }) {
  const id = useId();
  const grouped = field.type === 'multiselect';
  return (
    <FieldShell field={field} id={id} error={error} as={grouped ? 'fieldset' : 'div'}>
      <FieldControl field={field} id={id} value={value} onChange={onChange} error={error} lookups={lookups} disabled={disabled} />
    </FieldShell>
  );
}
