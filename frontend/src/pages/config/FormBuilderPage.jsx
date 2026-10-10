import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  GripVertical,
  LayoutList,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react';
import { formsService } from '../../services/catalogService';
import { Modal, useModalIds } from '../../components/ui/Modal';
import { Alert, Badge, Button, CodeBadge, EmptyState, IconButton, PageLoader, StatusBadge } from '../../components/ui';
import { DynamicForm } from '../../components/forms/DynamicForm';
import { FieldEditor, newOption, withEffectiveValues } from '../../components/forms/FieldEditor';
import { FIELD_GROUPS, FIELD_TYPES, initialValues, slugify, visibleFields } from '../../components/forms/fieldTypes';
import { useAuth, useConfirm, useDocumentTitle, useToast } from '../../hooks';
import { useSortable } from '../../hooks/useSortable';
import { PERMISSIONS } from '../../utils/permissions';
import { TicketTypeNotFound } from './TicketTypeFormPages';
import { useFormLookups } from './TicketTypeDetailPage';

let cidSeq = 0;
const nextCid = () => `f${++cidSeq}`;

/** Campo guardado → borrador editable. */
function toDraft(f) {
  return {
    ...f,
    _cid: nextCid(),
    description: f.description ?? '',
    placeholder: f.placeholder ?? '',
    options: f.options.map((o) => ({ ...o, _cid: `o${o.id}` })),
    rules: { ...(f.rules ?? {}) },
  };
}

function newField(type, label, existingKeys) {
  const base = slugify(label) || 'campo';
  let key = base;
  let n = 2;
  while (existingKeys.has(key)) key = `${base}_${n++}`;
  return {
    _cid: nextCid(),
    key,
    keyTouched: false,
    label,
    description: '',
    placeholder: '',
    type,
    required: false,
    defaultValue: null,
    rules: type === 'currency' ? { currency: 'MXN' } : {},
    visibleToRequester: true,
    visibleToAgent: true,
    status: 'active',
    options: FIELD_TYPES[type].options ? [newOption('Opción 1'), newOption('Opción 2')] : [],
  };
}

/** Borrador → cuerpo de la API (sin datos internos de la interfaz). */
function toPayload(f) {
  const def = FIELD_TYPES[f.type];
  const payload = {
    ...(f.id ? { id: f.id } : {}),
    key: f.key || undefined,
    label: f.label.trim(),
    description: f.description?.trim() || null,
    placeholder: def.placeholder ? f.placeholder?.trim() || null : null,
    type: f.type,
    required: f.required,
    rules: f.rules ?? {},
    visibleToRequester: f.visibleToRequester,
    visibleToAgent: f.visibleToAgent,
    status: f.status,
    options: def.options
      ? f.options.map((o) => ({
          ...(o.id ? { id: o.id } : {}),
          value: o.value || slugify(o.label, 70) || undefined,
          label: o.label.trim(),
          isActive: o.isActive,
        }))
      : [],
  };
  const hasDefault = f.defaultValue !== null && f.defaultValue !== undefined && f.defaultValue !== '' && !(Array.isArray(f.defaultValue) && !f.defaultValue.length);
  if (def.defaultValue && hasDefault) {
    payload.defaultValue = ['number', 'currency'].includes(f.type) && typeof f.defaultValue === 'string' ? Number(f.defaultValue) : f.defaultValue;
  }
  return payload;
}

/** Validación local rápida (el servidor valida todo de nuevo). */
function localErrors(fields) {
  const errors = {};
  fields.forEach((f) => {
    const e = {};
    if (!f.label.trim()) e.label = 'La etiqueta es obligatoria';
    if (!f.key) e.key = 'El nombre interno es obligatorio';
    if (FIELD_TYPES[f.type].options) {
      if (!f.options.some((o) => o.isActive && o.label.trim())) e.options = 'Agrega al menos una opción activa';
      f.options.forEach((o, i) => {
        if (!o.label.trim()) e[`options.${i}.label`] = 'La opción necesita un texto';
      });
    }
    if (!f.visibleToRequester && !f.visibleToAgent) e.visibleToRequester = 'El campo debe ser visible para alguien';
    if (Object.keys(e).length) errors[f._cid] = e;
  });
  return errors;
}

function TypePalette({ onPick, onClose }) {
  const { titleId } = useModalIds();
  return (
    <Modal onClose={onClose} labelledBy={titleId} maxWidth={720}>
      <div className="modal__body">
        <h2 className="modal__title" id={titleId}>
          Agregar campo
        </h2>
        <p className="modal__text">Elige el tipo de dato que debe capturar el usuario.</p>
        {FIELD_GROUPS.map((g) => (
          <div key={g} className="palette-group">
            <p className="palette-group__title">{g}</p>
            <div className="palette-grid">
              {Object.entries(FIELD_TYPES)
                .filter(([, t]) => t.group === g)
                .map(([type, t]) => {
                  const Icon = t.icon;
                  return (
                    <button key={type} type="button" className="palette-item" onClick={() => onPick(type)} data-autofocus={type === 'short_text' || undefined}>
                      <Icon aria-hidden="true" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      <div className="modal__footer">
        <Button onClick={onClose}>Cancelar</Button>
      </div>
    </Modal>
  );
}

function FieldCard({ field, index, total, selected, errors, readOnly, sortable, onSelect, onChange, onDuplicate, onRemove, previous, lookups, cardRef }) {
  const def = FIELD_TYPES[field.type];
  const Icon = def.icon;
  const errorCount = Object.keys(errors ?? {}).length;
  return (
    <li className="field-card" data-selected={selected || undefined} data-inactive={field.status === 'inactive' || undefined} ref={cardRef} {...sortable.rowProps(index)}>
      <div className="field-card__head">
        {!readOnly && (
          <span className="drag-handle" title="Arrastra para ordenar" {...sortable.handleProps(index)}>
            <GripVertical />
          </span>
        )}
        <button type="button" className="field-card__summary" onClick={onSelect} aria-expanded={selected}>
          <span className="field-card__icon">
            <Icon aria-hidden="true" />
          </span>
          <span className="field-card__text">
            <span className="field-card__label">
              {field.label || <em className="muted">Sin etiqueta</em>}
              {field.required && <span className="req"> *</span>}
            </span>
            <span className="field-card__meta">
              {def.label} · <code>{field.key || '—'}</code>
            </span>
          </span>
          <span className="badge-row field-card__badges">
            {errorCount > 0 && (
              <Badge tone="danger">
                <AlertCircle className="badge__icon" aria-hidden="true" /> {errorCount} error{errorCount > 1 ? 'es' : ''}
              </Badge>
            )}
            {field.rules?.showIf && <Badge tone="role-admin">Condicional</Badge>}
            {!field.visibleToRequester && <Badge tone="role-agent">Solo agentes</Badge>}
            {!field.visibleToAgent && <Badge tone="neutral">Solo solicitante</Badge>}
            {field.status === 'inactive' && <Badge tone="neutral">Inactivo</Badge>}
            {!field.id && <Badge tone="success">Nuevo</Badge>}
          </span>
          {selected ? <ChevronUp className="field-card__chevron" aria-hidden="true" /> : <ChevronDown className="field-card__chevron" aria-hidden="true" />}
        </button>
        {!readOnly && (
          <span className="row-actions field-card__actions">
            <IconButton icon={ChevronUp} label="Subir campo" disabled={index === 0} onClick={() => sortable.move(index, index - 1)} />
            <IconButton icon={ChevronDown} label="Bajar campo" disabled={index === total - 1} onClick={() => sortable.move(index, index + 1)} />
            <IconButton icon={Copy} label="Duplicar campo" onClick={onDuplicate} />
            <IconButton icon={Trash2} className="text-danger" label="Eliminar campo" onClick={onRemove} />
          </span>
        )}
      </div>
      {selected && (
        <div className="field-card__body">
          <FieldEditor field={field} previous={previous} errors={errors} onChange={onChange} readOnly={readOnly} lookups={lookups} />
        </div>
      )}
    </li>
  );
}

export default function FormBuilderPage() {
  const { id } = useParams();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const readOnlyByRole = !hasPermission(PERMISSIONS.FORMS_UPDATE);

  const [load, setLoad] = useState({ loadedId: null, data: null, error: null });
  const [fields, setFields] = useState([]);
  const [baseline, setBaseline] = useState('[]');
  const [selected, setSelected] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [palette, setPalette] = useState(false);
  const [panel, setPanel] = useState('design'); // vista en pantallas estrechas
  const [audience, setAudience] = useState('requester');
  const [previewValues, setPreviewValues] = useState({});
  const [previewErrors, setPreviewErrors] = useState({});
  const [previewResult, setPreviewResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const cardRefs = useRef(new Map());

  useDocumentTitle(load.data ? `Formulario · ${load.data.ticketType.name}` : 'Formulario');

  const applyServerForm = (data) => {
    const drafts = data.fields.map(toDraft);
    setFields(drafts);
    setBaseline(JSON.stringify(drafts.map(toPayload)));
    setPreviewValues(initialValues(data.fields));
    setPreviewErrors({});
    setPreviewResult(null);
    setErrors({});
  };

  useEffect(() => {
    const c = new AbortController();
    formsService
      .get(id, { signal: c.signal })
      .then((data) => {
        setLoad({ loadedId: id, data, error: null });
        applyServerForm(data);
      })
      .catch((err) => err.name !== 'AbortError' && setLoad({ loadedId: id, data: null, error: err }));
    return () => c.abort();
  }, [id]);

  const payload = useMemo(() => fields.map(toPayload), [fields]);
  const dirty = JSON.stringify(payload) !== baseline;
  const previewFields = useMemo(() => fields.map(withEffectiveValues), [fields]);
  const lookups = useFormLookups(fields);

  // Avisar antes de cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const sortable = useSortable(fields, (next) => setFields(next), { disabled: readOnlyByRole });

  if (load.loadedId !== id) return <PageLoader label="Cargando formulario…" />;
  if (load.error) return <TicketTypeNotFound error={load.error} />;

  const { ticketType } = load.data;
  const readOnly = readOnlyByRole || !ticketType.capabilities.editForm;

  const updateField = (cid, patch) => {
    setFields((list) => {
      const current = list.find((f) => f._cid === cid);
      let next = { ...current, ...patch };
      // Clave automática a partir de la etiqueta (solo campos nuevos sin clave editada).
      if (patch.label !== undefined && !current.id && !current.keyTouched) {
        const used = new Set(list.filter((f) => f._cid !== cid).map((f) => f.key));
        const base = slugify(patch.label) || 'campo';
        let key = base;
        let n = 2;
        while (used.has(key)) key = `${base}_${n++}`;
        next.key = key;
      }
      if (patch.type && patch.type !== current.type) {
        const def = FIELD_TYPES[patch.type];
        next = {
          ...next,
          defaultValue: null,
          placeholder: def.placeholder ? next.placeholder : '',
          rules: { ...(next.rules.showIf ? { showIf: next.rules.showIf } : {}), ...(patch.type === 'currency' ? { currency: 'MXN' } : {}) },
          options: def.options ? (current.options.length ? current.options : [newOption('Opción 1'), newOption('Opción 2')]) : [],
        };
      }
      // Si cambia la clave de un campo nuevo, se actualizan las condiciones que la usan.
      const renamed = next.key !== current.key ? [current.key, next.key] : null;
      return list.map((f) => {
        if (f._cid === cid) return next;
        if (renamed && f.rules?.showIf?.field === renamed[0]) return { ...f, rules: { ...f.rules, showIf: { ...f.rules.showIf, field: renamed[1] } } };
        return f;
      });
    });
    setErrors((e) => (e[cid] ? { ...e, [cid]: undefined } : e));
  };

  const addField = (type) => {
    setPalette(false);
    const field = newField(type, FIELD_TYPES[type].label, new Set(fields.map((f) => f.key)));
    setFields((list) => [...list, field]);
    setSelected(field._cid);
    setPanel('design');
    setTimeout(() => cardRefs.current.get(field._cid)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const duplicate = (f) => {
    const used = new Set(fields.map((x) => x.key));
    const copy = { ...newField(f.type, `${f.label} (copia)`, used), ...structuredClone({ ...f, id: undefined, _cid: undefined }) };
    copy._cid = nextCid();
    copy.id = undefined;
    copy.label = `${f.label} (copia)`;
    copy.keyTouched = false;
    let key = `${f.key}_copia`;
    let n = 2;
    while (used.has(key)) key = `${f.key}_copia_${n++}`;
    copy.key = key;
    copy.options = f.options.map((o) => ({ ...newOption(o.label), isActive: o.isActive }));
    const index = fields.findIndex((x) => x._cid === f._cid);
    setFields((list) => [...list.slice(0, index + 1), copy, ...list.slice(index + 1)]);
    setSelected(copy._cid);
  };

  const remove = (f) => {
    const dependent = fields.find((x) => x.rules?.showIf?.field === f.key);
    if (dependent) {
      toast.error('No se puede eliminar', `El campo "${dependent.label}" depende de este campo. Quita esa condición primero.`);
      return;
    }
    const doRemove = () => {
      setFields((list) => list.filter((x) => x._cid !== f._cid));
      if (selected === f._cid) setSelected(null);
    };
    if (!f.id) return doRemove();
    return confirm({
      tone: 'danger',
      title: `¿Eliminar el campo "${f.label}"?`,
      message:
        'Se quitará del formulario al guardar. Las solicitudes futuras conservarán una copia del formulario con el que se crearon. Si solo quieres dejar de pedirlo, desactívalo.',
      confirmLabel: 'Eliminar campo',
      onConfirm: doRemove,
    });
  };

  const discard = () =>
    confirm({
      tone: 'warning',
      icon: Undo2,
      title: '¿Descartar los cambios?',
      message: 'Se perderán los cambios que no hayas guardado.',
      confirmLabel: 'Descartar',
      onConfirm: () => applyServerForm(load.data),
    });

  const save = async () => {
    const local = localErrors(fields);
    if (Object.keys(local).length) {
      setErrors(local);
      const first = fields.find((f) => local[f._cid]);
      setSelected(first._cid);
      toast.error('Revisa el formulario', 'Hay campos con datos incompletos.');
      return;
    }
    setSaving(true);
    try {
      const data = await formsService.save(ticketType.id, payload);
      setLoad((l) => ({ ...l, data }));
      applyServerForm(data);
      setSelected(null);
      toast.success('Formulario guardado', `Versión ${data.ticketType.formVersion}`);
    } catch (err) {
      // Errores del servidor con forma "fields.<índice>.<propiedad>".
      const mapped = {};
      for (const [k, msg] of Object.entries(err.details ?? {})) {
        const m = /^fields\.(\d+)(?:\.(.+))?$/.exec(k);
        if (!m) continue;
        const cid = fields[Number(m[1])]?._cid;
        if (!cid) continue;
        mapped[cid] = { ...(mapped[cid] ?? {}), [m[2] ?? 'label']: msg };
      }
      setErrors(mapped);
      const firstCid = fields.find((f) => mapped[f._cid])?._cid;
      if (firstCid) setSelected(firstCid);
      toast.error('No se pudo guardar el formulario', err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitPreview = async () => {
    const shown = visibleFields(previewFields, previewValues, audience);
    const values = Object.fromEntries(shown.filter((f) => previewValues[f.key] !== undefined).map((f) => [f.key, previewValues[f.key]]));
    setValidating(true);
    setPreviewResult(null);
    try {
      const res = await formsService.validate(ticketType.id, { fields: payload, values, audience });
      setPreviewErrors(res.errors);
      setPreviewResult(res.valid ? 'ok' : 'errors');
    } catch (err) {
      setPreviewResult(null);
      toast.error('No se pudo validar', err.code === 'INVALID_FORM' ? 'Corrige primero la configuración de los campos.' : err.message);
    } finally {
      setValidating(false);
    }
  };

  const resetPreview = () => {
    setPreviewValues(initialValues(payload));
    setPreviewErrors({});
    setPreviewResult(null);
  };

  return (
    <>
      <Link to={`/configuracion/tipos-solicitud/${ticketType.id}`} className="back-link">
        <ArrowLeft aria-hidden="true" /> Volver al tipo de solicitud
      </Link>

      <div className="builder-header">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-header__title">Formulario: {ticketType.name}</h1>
          <p className="page-header__subtitle builder-header__meta">
            <span>{ticketType.department.name}</span>
            {ticketType.category && <span>› {ticketType.category.name}</span>}
            <CodeBadge>{ticketType.code}</CodeBadge>
            <StatusBadge status={ticketType.status} />
            <span className="muted">Versión {ticketType.formVersion}</span>
            {dirty && <Badge tone="warning">Cambios sin guardar</Badge>}
          </p>
        </div>
        {!readOnly && (
          <div className="page-header__actions">
            <Button icon={Undo2} onClick={discard} disabled={!dirty || saving}>
              Descartar
            </Button>
            <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={!dirty}>
              Guardar formulario
            </Button>
          </div>
        )}
      </div>

      {readOnly && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="info" title="Solo lectura">
            Puedes consultar el formulario, pero no modificarlo.
          </Alert>
        </div>
      )}

      <div className="segmented builder-tabs" role="tablist" aria-label="Vista">
        {[
          ['design', 'Diseño', LayoutList],
          ['preview', 'Vista previa', Eye],
        ].map(([value, label, Icon]) => (
          <label key={value}>
            <input type="radio" name="builder-panel" checked={panel === value} onChange={() => setPanel(value)} />
            <Icon aria-hidden="true" className="badge__icon" /> {label}
          </label>
        ))}
      </div>

      <div className="builder" data-panel={panel}>
        <section className="card builder__design" aria-label="Diseño del formulario">
          <header className="card__header">
            <div>
              <h2 className="card__title">Campos ({fields.length})</h2>
              <p className="card__subtitle">Arrastra ☰ o usa las flechas para ordenar. Haz clic en un campo para configurarlo.</p>
            </div>
            {!readOnly && (
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setPalette(true)}>
                Agregar campo
              </Button>
            )}
          </header>
          {fields.length === 0 ? (
            <EmptyState
              icon={LayoutList}
              title="El formulario está vacío"
              text="Agrega los campos que el usuario deberá completar, por ejemplo: equipo, tipo de problema, descripción y evidencia."
              action={
                !readOnly && (
                  <Button variant="primary" icon={Plus} onClick={() => setPalette(true)}>
                    Agregar el primer campo
                  </Button>
                )
              }
            />
          ) : (
            <ul className="field-list">
              {fields.map((f, i) => (
                <FieldCard
                  key={f._cid}
                  field={f}
                  index={i}
                  total={fields.length}
                  selected={selected === f._cid}
                  errors={errors[f._cid]}
                  readOnly={readOnly}
                  sortable={sortable}
                  previous={previewFields.slice(0, i)}
                  lookups={lookups}
                  cardRef={(el) => (el ? cardRefs.current.set(f._cid, el) : cardRefs.current.delete(f._cid))}
                  onSelect={() => setSelected((s) => (s === f._cid ? null : f._cid))}
                  onChange={(patch) => updateField(f._cid, patch)}
                  onDuplicate={() => duplicate(f)}
                  onRemove={() => remove(f)}
                />
              ))}
            </ul>
          )}
          {!readOnly && fields.length > 0 && (
            <div className="builder__add">
              <Button icon={Plus} onClick={() => setPalette(true)}>
                Agregar campo
              </Button>
            </div>
          )}
        </section>

        <aside className="card builder__preview" aria-label="Vista previa">
          <header className="card__header">
            <div>
              <h2 className="card__title">Vista previa</h2>
              <p className="card__subtitle">Se actualiza mientras editas, incluso sin guardar.</p>
            </div>
            <div className="segmented segmented--sm" role="radiogroup" aria-label="Ver como">
              {[
                ['requester', 'Solicitante'],
                ['agent', 'Agente'],
              ].map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name="audience" checked={audience === value} onChange={() => setAudience(value)} />
                  {label}
                </label>
              ))}
            </div>
          </header>
          <div className="card__body">
            <div className="preview-sheet">
              <p className="preview-sheet__title">{ticketType.name}</p>
              {ticketType.description && <p className="preview-sheet__desc">{ticketType.description}</p>}
              <DynamicForm
                fields={previewFields}
                values={previewValues}
                onChange={(k, v) => {
                  setPreviewValues((s) => ({ ...s, [k]: v }));
                  setPreviewErrors((e) => ({ ...e, [k]: undefined }));
                  setPreviewResult(null);
                }}
                errors={previewErrors}
                audience={audience}
                lookups={lookups}
              />
              {previewResult === 'ok' && (
                <Alert tone="success" icon={CheckCircle2} title="Formulario válido">
                  Los datos cumplen todas las reglas. En la siguiente etapa, aquí se creará el ticket.
                </Alert>
              )}
              {previewResult === 'errors' && (
                <Alert tone="error" title="Hay datos por corregir">
                  {previewErrors._ ?? 'Revisa los campos marcados.'}
                </Alert>
              )}
              <div className="preview-sheet__actions">
                <Button size="sm" variant="ghost" icon={RotateCcw} onClick={resetPreview}>
                  Restablecer
                </Button>
                <Button variant="primary" icon={Send} onClick={submitPreview} loading={validating} disabled={!fields.length}>
                  Enviar solicitud
                </Button>
              </div>
              <p className="field__hint preview-sheet__note">Prueba: valida los datos con las reglas reales del servidor, sin crear ninguna solicitud.</p>
            </div>
          </div>
        </aside>
      </div>

      {palette && <TypePalette onPick={addField} onClose={() => setPalette(false)} />}
    </>
  );
}
