import { useEffect, useState } from 'react';
import { Mail, Save, UserPlus } from 'lucide-react';
import { rolesService } from '../../services/usersService';
import { departmentsService } from '../../services/organizationService';
import { Alert, Button, PasswordField, SelectField, TextField } from '../ui';
import { PasswordRules } from './ChangePasswordForm';
import { validateEmail, validateName, validatePassword } from '../../utils/validation';

const EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  roleId: '',
  departmentId: '',
  status: 'active',
  passwordMode: 'auto',
  password: '',
};

/**
 * Formulario de alta/edición de usuarios.
 *  mode="create": incluye estado y contraseña temporal.
 *  mode="edit": datos básicos y rol (el estado y la contraseña se gestionan
 *  con acciones dedicadas que piden confirmación).
 */
export function UserForm({
  mode = 'create',
  initialUser,
  canChangeRole = true,
  canChangeDepartment = true,
  onSubmit,
  onCancel,
}) {
  const isCreate = mode === 'create';
  const [form, setForm] = useState(() =>
    initialUser
      ? {
          ...EMPTY,
          firstName: initialUser.firstName,
          lastName: initialUser.lastName,
          email: initialUser.email,
          roleId: String(initialUser.role.id),
          departmentId: initialUser.department ? String(initialUser.department.id) : '',
          status: initialUser.status,
        }
      : EMPTY,
  );
  const [roles, setRoles] = useState([]);
  const [rolesError, setRolesError] = useState(null);
  const [departments, setDepartments] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    rolesService
      .list({ signal: controller.signal })
      .then((data) => setRoles(data.roles))
      .catch((err) => err.name !== 'AbortError' && setRolesError(err.message));
    // Solo departamentos activos: los inactivos no admiten nuevas asignaciones.
    departmentsService
      .options({}, { signal: controller.signal })
      .then((data) => setDepartments(data.departments))
      .catch((err) => err.name !== 'AbortError' && setDepartments([]));
    return () => controller.abort();
  }, []);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: null }));
  };

  const roleOptions = roles.map((r) => ({
    value: String(r.id),
    label: r.assignable ? r.name : `${r.name} (sin permiso para asignar)`,
    disabled: !r.assignable && String(r.id) !== form.roleId,
  }));
  const selectedRole = roles.find((r) => String(r.id) === form.roleId);

  const currentDept = initialUser?.department;
  const departmentOptions = [
    ...(currentDept && currentDept.status !== 'active'
      ? [{ value: String(currentDept.id), label: `${currentDept.name} (inactivo)`, disabled: true }]
      : []),
    ...(departments ?? []).map((d) => ({ value: String(d.id), label: `${d.name} (${d.code})` })),
  ];

  const validate = () => {
    const next = {
      firstName: validateName(form.firstName, 'El nombre'),
      lastName: validateName(form.lastName, 'Los apellidos'),
      email: validateEmail(form.email),
      roleId: form.roleId ? null : 'Selecciona un rol',
      password: isCreate && form.passwordMode === 'manual' ? validatePassword(form.password) : null,
    };
    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
    };
    if (isCreate) {
      payload.roleId = Number(form.roleId);
      payload.status = form.status;
      if (form.departmentId) payload.departmentId = Number(form.departmentId);
      if (form.passwordMode === 'manual') payload.password = form.password;
    } else {
      if (canChangeRole && Number(form.roleId) !== initialUser.role.id) payload.roleId = Number(form.roleId);
      const currentId = initialUser.department ? String(initialUser.department.id) : '';
      if (canChangeDepartment && form.departmentId !== currentId) {
        payload.departmentId = form.departmentId ? Number(form.departmentId) : null;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') setErrors((er) => ({ ...er, email: err.message }));
      else if (err.code === 'USER_IS_DEPARTMENT_MANAGER') setErrors((er) => ({ ...er, departmentId: err.message }));
      else if (err.details) setErrors((er) => ({ ...er, ...err.details }));
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="form-section">
        {formError && <Alert tone="error" title={formError} />}
        {rolesError && <Alert tone="error" title="No se pudieron cargar los roles">{rolesError}</Alert>}

        <div className="form-section__head">
          <h3>Datos personales</h3>
          <p>Nombre y correo con el que la persona iniciará sesión.</p>
        </div>
        <div className="form-grid">
          <TextField
            label="Nombre"
            value={form.firstName}
            onChange={update('firstName')}
            error={errors.firstName}
            autoComplete="off"
            maxLength={100}
            disabled={submitting}
            autoFocus
            required
          />
          <TextField
            label="Apellidos"
            value={form.lastName}
            onChange={update('lastName')}
            error={errors.lastName}
            autoComplete="off"
            maxLength={100}
            disabled={submitting}
            required
          />
          <div className="span-2">
            <TextField
              label="Correo electrónico"
              type="email"
              icon={Mail}
              placeholder="nombre@empresa.com"
              value={form.email}
              onChange={update('email')}
              error={errors.email}
              autoComplete="off"
              maxLength={191}
              disabled={submitting}
              required
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section__head">
          <h3>Acceso</h3>
          <p>El rol determina qué secciones puede usar; el departamento, el área a la que pertenece.</p>
        </div>
        <div className="form-grid">
          <SelectField
            label="Rol"
            value={form.roleId}
            onChange={update('roleId')}
            options={roleOptions}
            placeholder={roles.length ? 'Selecciona un rol' : 'Cargando roles…'}
            error={errors.roleId}
            hint={!canChangeRole ? 'No puedes cambiar el rol de esta cuenta.' : selectedRole?.description}
            disabled={submitting || !canChangeRole || !roles.length}
            required
          />
          <SelectField
            label="Departamento"
            value={form.departmentId}
            onChange={update('departmentId')}
            options={departmentOptions}
            placeholder={departments ? 'Sin departamento' : 'Cargando departamentos…'}
            error={errors.departmentId}
            hint={
              !canChangeDepartment
                ? 'No puedes cambiar el departamento de esta cuenta.'
                : departments && !departments.length
                  ? 'No hay departamentos activos. Créalos en el módulo Departamentos.'
                  : 'Solo se muestran departamentos activos.'
            }
            disabled={submitting || !canChangeDepartment || !departments}
          />
          {isCreate && (
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
                      disabled={submitting}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="field__hint">Un usuario inactivo no puede iniciar sesión.</p>
            </div>
          )}
        </div>
      </div>

      {isCreate && (
        <div className="form-section">
          <div className="form-section__head">
            <h3>Contraseña temporal</h3>
            <p>El usuario deberá cambiarla en su primer inicio de sesión.</p>
          </div>
          <div className="choice-list" role="radiogroup" aria-label="Contraseña temporal">
            <label className="choice">
              <input
                type="radio"
                name="passwordMode"
                value="auto"
                checked={form.passwordMode === 'auto'}
                onChange={update('passwordMode')}
                disabled={submitting}
              />
              <span>
                <span className="choice__title">Generar automáticamente (recomendado)</span>
                <span className="choice__text">Se creará una contraseña segura que verás una sola vez al guardar.</span>
              </span>
            </label>
            <label className="choice">
              <input
                type="radio"
                name="passwordMode"
                value="manual"
                checked={form.passwordMode === 'manual'}
                onChange={update('passwordMode')}
                disabled={submitting}
              />
              <span>
                <span className="choice__title">Definir manualmente</span>
                <span className="choice__text">Escribe una contraseña temporal que cumpla la política.</span>
              </span>
            </label>
          </div>
          {form.passwordMode === 'manual' && (
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div>
                <PasswordField
                  label="Contraseña temporal"
                  value={form.password}
                  onChange={update('password')}
                  error={errors.password}
                  autoComplete="new-password"
                  disabled={submitting}
                  required
                />
                <PasswordRules value={form.password} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="form-footer">
        <Button onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={submitting} icon={isCreate ? UserPlus : Save}>
          {isCreate ? 'Crear usuario' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}
