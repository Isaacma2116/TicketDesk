import { useId } from 'react';
import { ChevronDown, ChevronUp, Lock, Plus, Trash2, X } from 'lucide-react';
import { Button, FieldError, IconButton, SelectField, TextField } from '../ui';
import { FieldControl } from './DynamicForm';
import {
  CURRENCIES,
  DEFAULT_FILE_EXTENSIONS,
  FIELD_GROUPS,
  FIELD_TYPES,
  FILE_EXTENSIONS,
  SHOW_IF_OPERATORS,
  slugify,
} from './fieldTypes';

let optionSeq = 0;

/** Valor que tendrá cada opción al guardarse (las nuevas lo derivan de su texto, igual que el servidor). */
export function withEffectiveValues(field) {
  if (!field.options?.length) return field;
  return { ...field, options: field.options.map((o) => ({ ...o, value: o.value || slugify(o.label, 70) })) };
}
export const newOption = (label = '') => ({ _cid: `o${++optionSeq}`, label, value: '', isActive: true });

function Toggle({ label, hint, checked, onChange, disabled }) {
  return (
    <label className="switch switch--row">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="switch__track" aria-hidden="true" />
      <span>
        <span className="switch__label">{label}</span>
        {hint && <span className="switch__hint">{hint}</span>}
      </span>
    </label>
  );
}

function NumberRule({ label, value, onChange, error, disabled, min, step = 1, placeholder }) {
  return (
    <TextField
      label={label}
      type="number"
      inputMode="decimal"
      value={value ?? ''}
      min={min}
      step={step}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      error={error}
      disabled={disabled}
    />
  );
}

function Section({ title, children, aside }) {
  return (
    <section className="fe-section">
      <header className="fe-section__head">
        <h4>{title}</h4>
        {aside}
      </header>
      {children}
    </section>
  );
}

/**
 * Editor de propiedades de un campo.
 * @param field     campo en borrador
 * @param previous  campos anteriores (posibles orígenes de condición)
 * @param errors    { prop: mensaje } del servidor o validación local
 * @param onChange  (patch) => void
 */
export function FieldEditor({ field, previous, errors = {}, onChange, readOnly, lookups }) {
  const uid = useId();
  const def = FIELD_TYPES[field.type];
  const saved = Boolean(field.id);
  const rules = field.rules ?? {};
  const setRule = (k, v) => {
    const next = { ...rules };
    if (v === undefined || v === null || v === '') delete next[k];
    else next[k] = v;
    onChange({ rules: next });
  };

  /* ---------- Opciones ---------- */
  const options = field.options ?? [];
  const setOption = (i, patch) => onChange({ options: options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const moveOption = (i, to) => {
    if (to < 0 || to >= options.length) return;
    const next = [...options];
    const [o] = next.splice(i, 1);
    next.splice(to, 0, o);
    onChange({ options: next });
  };

  /* ---------- Condición ---------- */
  const sources = previous.filter((f) => FIELD_TYPES[f.type].conditional);
  const showIf = rules.showIf;
  const source = showIf ? previous.find((f) => f.key === showIf.field) : null;
  const needsValue = showIf && ['equals', 'not_equals'].includes(showIf.op);

  const err = (k) => errors[k];
  const typeOptions = FIELD_GROUPS.flatMap((g) =>
    Object.entries(FIELD_TYPES)
      .filter(([, t]) => t.group === g)
      .map(([value, t]) => ({ value, label: `${t.label}` })),
  );

  return (
    <div className="field-editor">
      <Section title="General">
        <div className="form-grid">
          <TextField
            label="Etiqueta"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            error={err('label')}
            maxLength={120}
            placeholder="Ej. Número de empleado"
            required
            disabled={readOnly}
          />
          <TextField
            label="Nombre interno"
            value={field.key}
            onChange={(e) => onChange({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'), keyTouched: true })}
            error={err('key')}
            maxLength={60}
            hint={saved ? 'Fijo una vez guardado (las solicitudes lo usan como referencia).' : 'Se genera a partir de la etiqueta.'}
            disabled={readOnly || saved}
            icon={saved ? Lock : undefined}
          />
          <SelectField
            label="Tipo de campo"
            value={field.type}
            onChange={(e) => onChange({ type: e.target.value })}
            options={typeOptions}
            hint={saved ? 'Para cambiar el tipo, crea un campo nuevo.' : undefined}
            disabled={readOnly || saved}
          />
          {def.placeholder && (
            <TextField
              label="Texto de ejemplo"
              value={field.placeholder ?? ''}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              error={err('placeholder')}
              maxLength={120}
              placeholder="Ej. E-1024"
              disabled={readOnly}
            />
          )}
          <div className="span-2">
            <TextField
              label="Descripción o ayuda"
              value={field.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              error={err('description')}
              maxLength={300}
              placeholder="Texto de ayuda que verá el usuario debajo de la etiqueta"
              disabled={readOnly}
            />
          </div>
        </div>
      </Section>

      <Section title="Comportamiento">
        <div className="toggle-grid">
          <Toggle label="Obligatorio" checked={field.required} onChange={(v) => onChange({ required: v })} disabled={readOnly} />
          <Toggle
            label="Activo"
            hint="Inactivo: se conserva pero no se muestra"
            checked={field.status === 'active'}
            onChange={(v) => onChange({ status: v ? 'active' : 'inactive' })}
            disabled={readOnly}
          />
          <Toggle label="Visible para el solicitante" checked={field.visibleToRequester} onChange={(v) => onChange({ visibleToRequester: v })} disabled={readOnly} />
          <Toggle label="Visible para el agente" checked={field.visibleToAgent} onChange={(v) => onChange({ visibleToAgent: v })} disabled={readOnly} />
        </div>
        <FieldError>{err('visibleToRequester')}</FieldError>
      </Section>

      {def.options && (
        <Section
          title={`Opciones (${options.filter((o) => o.isActive).length} activas)`}
          aside={
            !readOnly && (
              <Button size="sm" variant="ghost" icon={Plus} onClick={() => onChange({ options: [...options, newOption()] })}>
                Agregar opción
              </Button>
            )
          }
        >
          <FieldError>{err('options')}</FieldError>
          {options.length === 0 ? (
            <p className="muted fe-empty">Agrega las opciones que podrá elegir el usuario.</p>
          ) : (
            <ul className="option-list">
              {options.map((o, i) => (
                <li key={o._cid ?? o.id} className="option-row">
                  <span className="option-row__order tabular">{i + 1}</span>
                  <input
                    className="input"
                    value={o.label}
                    onChange={(e) => setOption(i, { label: e.target.value })}
                    placeholder={`Opción ${i + 1}`}
                    aria-label={`Texto de la opción ${i + 1}`}
                    maxLength={150}
                    disabled={readOnly}
                    aria-invalid={err(`options.${i}.label`) ? 'true' : undefined}
                  />
                  <code className="option-row__value" title={o.id ? 'Valor guardado (fijo)' : 'Valor que se guardará'}>
                    {o.value || slugify(o.label, 70) || '—'}
                  </code>
                  <label className="checkbox option-row__active">
                    <input type="checkbox" checked={o.isActive} onChange={(e) => setOption(i, { isActive: e.target.checked })} disabled={readOnly} />
                    <span>Activa</span>
                  </label>
                  {!readOnly && (
                    <span className="row-actions">
                      <IconButton icon={ChevronUp} label="Subir opción" disabled={i === 0} onClick={() => moveOption(i, i - 1)} />
                      <IconButton icon={ChevronDown} label="Bajar opción" disabled={i === options.length - 1} onClick={() => moveOption(i, i + 1)} />
                      <IconButton icon={Trash2} className="text-danger" label="Eliminar opción" onClick={() => onChange({ options: options.filter((_, j) => j !== i) })} />
                    </span>
                  )}
                  {(err(`options.${i}.label`) || err(`options.${i}.value`)) && (
                    <div className="option-row__error">
                      <FieldError>{err(`options.${i}.label`) || err(`options.${i}.value`)}</FieldError>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {field.type === 'asset' || field.type === 'location' ? (
            <p className="field__hint">Más adelante este campo podrá alimentarse del catálogo de {field.type === 'asset' ? 'equipos' : 'ubicaciones'}.</p>
          ) : null}
        </Section>
      )}

      {def.rules.length > 0 && (
        <Section title="Validación">
          <div className="form-grid form-grid--3">
            {def.rules.includes('minLength') && (
              <NumberRule label="Longitud mínima" value={rules.minLength} min={0} onChange={(v) => setRule('minLength', v)} error={err('rules.minLength')} disabled={readOnly} />
            )}
            {def.rules.includes('maxLength') && (
              <NumberRule
                label="Longitud máxima"
                value={rules.maxLength}
                min={1}
                placeholder={field.type === 'short_text' ? '255' : '5000'}
                onChange={(v) => setRule('maxLength', v)}
                error={err('rules.maxLength')}
                disabled={readOnly}
              />
            )}
            {def.rules.includes('min') && <NumberRule label="Valor mínimo" value={rules.min} step="any" onChange={(v) => setRule('min', v)} error={err('rules.min')} disabled={readOnly} />}
            {def.rules.includes('max') && <NumberRule label="Valor máximo" value={rules.max} step="any" onChange={(v) => setRule('max', v)} error={err('rules.max')} disabled={readOnly} />}
            {def.rules.includes('decimals') && (
              <NumberRule
                label="Decimales permitidos"
                value={rules.decimals}
                min={0}
                placeholder={field.type === 'currency' ? '2' : 'Sin límite'}
                onChange={(v) => setRule('decimals', v)}
                error={err('rules.decimals')}
                disabled={readOnly}
              />
            )}
            {def.rules.includes('currency') && (
              <SelectField
                label="Moneda"
                value={rules.currency ?? 'MXN'}
                onChange={(e) => setRule('currency', e.target.value)}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                disabled={readOnly}
              />
            )}
            {def.rules.includes('minSelected') && (
              <NumberRule label="Mínimo de opciones" value={rules.minSelected} min={0} onChange={(v) => setRule('minSelected', v)} error={err('rules.minSelected')} disabled={readOnly} />
            )}
            {def.rules.includes('maxSelected') && (
              <NumberRule label="Máximo de opciones" value={rules.maxSelected} min={1} onChange={(v) => setRule('maxSelected', v)} error={err('rules.maxSelected')} disabled={readOnly} />
            )}
            {def.rules.includes('maxFiles') && (
              <NumberRule label="Máximo de archivos" value={rules.maxFiles} min={1} placeholder="1" onChange={(v) => setRule('maxFiles', v)} error={err('rules.maxFiles')} disabled={readOnly} />
            )}
            {def.rules.includes('maxSizeMb') && (
              <NumberRule label="Tamaño máximo (MB)" value={rules.maxSizeMb} min={1} placeholder="10" onChange={(v) => setRule('maxSizeMb', v)} error={err('rules.maxSizeMb')} disabled={readOnly} />
            )}
          </div>
          {def.rules.includes('allowedExtensions') && (
            <fieldset className="ext-picker">
              <legend className="field__label">Formatos permitidos</legend>
              <div className="ext-picker__list">
                {FILE_EXTENSIONS.map((ext) => {
                  const current = rules.allowedExtensions ?? DEFAULT_FILE_EXTENSIONS;
                  return (
                    <label key={ext} className="ext-chip">
                      <input
                        type="checkbox"
                        checked={current.includes(ext)}
                        disabled={readOnly}
                        onChange={(e) => setRule('allowedExtensions', e.target.checked ? [...current, ext] : current.filter((x) => x !== ext))}
                      />
                      <span>.{ext}</span>
                    </label>
                  );
                })}
              </div>
              <FieldError>{err('rules.allowedExtensions')}</FieldError>
            </fieldset>
          )}
          {field.type === 'image' && <p className="field__hint">Imágenes admitidas: PNG, JPG y WEBP.</p>}
        </Section>
      )}

      {def.defaultValue && (
        <Section
          title="Valor predeterminado"
          aside={
            !readOnly &&
            field.defaultValue !== null &&
            field.defaultValue !== undefined && (
              <Button size="sm" variant="ghost" icon={X} onClick={() => onChange({ defaultValue: null })}>
                Quitar
              </Button>
            )
          }
        >
          <FieldControl
            id={`${uid}-default`}
            field={{ ...withEffectiveValues(field), required: false, description: null }}
            value={field.defaultValue ?? (field.type === 'multiselect' ? [] : '')}
            onChange={(v) => onChange({ defaultValue: v })}
            error={err('defaultValue')}
            disabled={readOnly}
            lookups={lookups}
          />
          <FieldError>{err('defaultValue')}</FieldError>
        </Section>
      )}

      <Section title="Mostrar u ocultar">
        {showIf && !source ? (
          // La condición apunta a un campo que ya no está antes de este (se reordenó o se borró).
          <div className="condition-broken">
            <FieldError>
              {err('rules.showIf') ??
                `La condición depende del campo «${showIf.field}», que ahora no está antes de este. Muévelo debajo de ese campo o quita la condición.`}
            </FieldError>
            {!readOnly && (
              <Button size="sm" icon={X} onClick={() => setRule('showIf', undefined)}>
                Quitar condición
              </Button>
            )}
          </div>
        ) : sources.length === 0 ? (
          <p className="muted fe-empty">
            Para mostrar este campo según una respuesta, agrega antes un campo de tipo lista, sí/no, texto corto o número.
          </p>
        ) : (
          <>
            <Toggle
              label="Mostrar solo si se cumple una condición"
              checked={Boolean(showIf)}
              onChange={(v) => setRule('showIf', v ? { field: sources[sources.length - 1].key, op: 'equals', value: '' } : undefined)}
              disabled={readOnly}
            />
            {showIf && (
              <div className="condition-row">
                <SelectField
                  label="Cuando el campo"
                  value={showIf.field}
                  onChange={(e) => setRule('showIf', { ...showIf, field: e.target.value, value: '' })}
                  options={sources.map((s) => ({ value: s.key, label: s.label || s.key }))}
                  disabled={readOnly}
                />
                <SelectField
                  label="Condición"
                  value={showIf.op}
                  onChange={(e) => setRule('showIf', { ...showIf, op: e.target.value })}
                  options={SHOW_IF_OPERATORS}
                  disabled={readOnly}
                />
                {needsValue &&
                  (source && FIELD_TYPES[source.type].options ? (
                    <SelectField
                      label="Valor"
                      value={String(showIf.value ?? '')}
                      onChange={(e) => setRule('showIf', { ...showIf, value: e.target.value })}
                      options={(source.options ?? []).map((o) => ({ value: o.value || slugify(o.label, 70), label: o.label || '(sin texto)' }))}
                      placeholder="Selecciona"
                      disabled={readOnly}
                    />
                  ) : source?.type === 'boolean' ? (
                    <SelectField
                      label="Valor"
                      value={String(showIf.value ?? '')}
                      onChange={(e) => setRule('showIf', { ...showIf, value: e.target.value })}
                      options={[
                        { value: 'true', label: 'Sí' },
                        { value: 'false', label: 'No' },
                      ]}
                      placeholder="Selecciona"
                      disabled={readOnly}
                    />
                  ) : (
                    <TextField
                      label="Valor"
                      value={String(showIf.value ?? '')}
                      onChange={(e) => setRule('showIf', { ...showIf, value: e.target.value })}
                      maxLength={150}
                      disabled={readOnly}
                    />
                  ))}
              </div>
            )}
            <FieldError>{err('rules.showIf')}</FieldError>
          </>
        )}
      </Section>
    </div>
  );
}
