import { useEffect, useState } from 'react';
import { Hash, Plus, PowerOff, Save } from 'lucide-react';
import { departmentsService } from '../../services/organizationService';
import { Alert, Button, SelectField, TextAreaField, TextField } from '../ui';
import { useConfirm } from '../../hooks';

const EMPTY = { name: '', code: '', description: '', managerId: '', status: 'active' };
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]*$/;

function validate(form) {
  const errors = {};
  const name = form.name.trim();
  const code = form.code.trim();
  if (!name) errors.name = 'El nombre es obligatorio';
  else if (name.length < 2) errors.name = 'El nombre debe tener al menos 2 caracteres';
  if (!code) errors.code = 'El código es obligatorio';
  else if (code.length < 2) errors.code = 'El código debe tener al menos 2 caracteres';
  else if (!CODE_RE.test(code)) errors.code = 'Usa solo letras sin acentos, números, guion o guion bajo (sin espacios)';
  if (form.description.length > 500) errors.description = 'Máximo 500 caracteres';
  return errors;
}

/**
 * Formulario de alta/edición de departamentos.
 * El responsable se elige entre usuarios activos de la empresa; si no
 * pertenece al departamento, el backend lo añade como integrante.
 */
export function DepartmentForm({ mode = 'create', initial, canChangeStatus = true, onSubmit, onCancel }) {
  const isCreate = mode === 'create';
  const confirm = useConfirm();
  const [form, setForm] = useState(() =>
    initial
      ? {
          name: initial.name,
          code: initial.code,
          description: initial.description ?? '',
          managerId: initial.manager ? String(initial.manager.id) : '',
          status: initial.status,
        }
      : EMPTY,
  );
  const [candidates, setCandidates] = useState(null);
  const [candidatesError, setCandidatesError] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    departmentsService
      .managerOptions(initial ? { departmentId: initial.id } : {}, { signal: controller.signal })
      .then((d) => setCandidates(d.users))
      .catch((err) => err.name !== 'AbortError' && setCandidatesError(err.message));
    return () => controller.abort();
  }, [initial]);

  const update = (field) => (e) => {
    let value = e.target.value;
    if (field === 'code') value = value.toUpperCase().replace(/\s+/g, '');
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: null }));
  };

  const option = (u) => ({
    value: String(u.id),
    label: `${u.fullName} · ${u.role.name}${u.department && !u.isMember ? ` · ${u.department.name}` : ''}`,
  });
  const members = candidates?.filter((u) => u.isMember) ?? [];
  const others = candidates?.filter((u) => !u.isMember) ?? [];
  // Responsable actual inactivo: se muestra para no perderlo, pero no se puede elegir de nuevo.
  const currentInactive =
    initial?.manager && candidates && !candidates.some((u) => u.id === initial.manager.id)
      ? [{ value: String(initial.manager.id), label: `${initial.manager.fullName} (inactivo)`, disabled: true }]
      : [];
  const selected = candidates?.find((u) => String(u.id) === form.managerId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const next = validate(form);
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim() || null,
      managerId: form.managerId ? Number(form.managerId) : null,
    };
    if (isCreate || canChangeStatus) payload.status = form.status;

    if (!isCreate && initial.status === 'active' && form.status === 'inactive') {
      const ok = await confirm({
        tone: 'warning',
        icon: PowerOff,
        title: `¿Deseas desactivar el departamento de ${initial.name}?`,
        message: 'Los usuarios y datos asociados se conservarán. Dejará de aparecer para nuevas asignaciones.',
        confirmLabel: 'Desactivar y guardar',
      });
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      if (err.details) setErrors((er) => ({ ...er, ...err.details }));
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-section">
        {formError && <Alert tone="error" title={formError} />}
        {!isCreate && initial.membersCount > 0 && (
          <Alert tone="info" title={`Este departamento tiene ${initial.membersCount} usuario(s) asociado(s)`}>
            Los cambios no afectan a sus integrantes: seguirán perteneciendo al departamento.
          </Alert>
        )}
        <div className="form-section__head">
          <h3>Información general</h3>
          <p>Nombre visible y código corto que identifica al departamento.</p>
        </div>
        <div className="form-grid form-grid--code">
          <TextField
            label="Nombre"
            placeholder="Tecnologías de la Información"
            value={form.name}
            onChange={update('name')}
            error={errors.name}
            maxLength={120}
            disabled={submitting}
            autoFocus
            required
          />
          <TextField
            label="Código"
            icon={Hash}
            placeholder="TI"
            value={form.code}
            onChange={update('code')}
            error={errors.code}
            hint="Único en la empresa. Ej.: TI, RH, COMPRAS"
            maxLength={20}
            autoComplete="off"
            disabled={submitting}
            required
          />
          <div className="span-2">
            <TextAreaField
              label="Descripción"
              placeholder="Departamento encargado de soporte e infraestructura tecnológica."
              value={form.description}
              onChange={update('description')}
              error={errors.description}
              maxLength={500}
              rows={3}
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__head">
          <h3>Responsable y estado</h3>
          <p>El responsable debe ser un usuario activo de la empresa.</p>
        </div>
        {candidatesError && <Alert tone="error" title="No se pudieron cargar los usuarios">{candidatesError}</Alert>}
        <div className="form-grid">
          <SelectField
            label="Responsable"
            value={form.managerId}
            onChange={update('managerId')}
            placeholder={candidates ? 'Sin responsable' : 'Cargando usuarios…'}
            options={currentInactive}
            groups={[
              { label: 'Integrantes del departamento', options: members.map(option) },
              { label: isCreate ? 'Usuarios activos' : 'Otros usuarios activos', options: others.map(option) },
            ]}
            error={errors.managerId}
            hint={
              selected && !selected.isMember
                ? `${selected.fullName} se añadirá como integrante del departamento.`
                : 'Opcional. Puedes asignarlo más tarde.'
            }
            disabled={submitting || !candidates}
          />
          <div className="field">
            <span className="field__label">Estado</span>
            <div className="segmented" role="radiogroup" aria-label="Estado">
              {[
                ['active', 'Activo'],
                ['inactive', 'Inactivo'],
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="status"
                    value={value}
                    checked={form.status === value}
                    onChange={update('status')}
                    disabled={submitting || (!isCreate && !canChangeStatus)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="field__hint">Un departamento inactivo no admite nuevas asignaciones.</p>
          </div>
        </div>
      </div>

      <div className="form-footer">
        <Button onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={submitting} icon={isCreate ? Plus : Save}>
          {isCreate ? 'Crear departamento' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}
