import { useState } from 'react';
import { Check, Circle, KeyRound } from 'lucide-react';
import { Alert, Button, PasswordField } from '../ui';
import { useAuth } from '../../hooks';
import { PASSWORD_RULES, validatePassword } from '../../utils/validation';

export function PasswordRules({ value }) {
  return (
    <ul className="password-rules" aria-label="Requisitos de la contraseña">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li key={rule.id} data-ok={ok}>
            {ok ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
            <span>{rule.label}</span>
            <span className="sr-only">{ok ? '(cumplido)' : '(pendiente)'}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ChangePasswordForm({ onSuccess, submitLabel = 'Actualizar contraseña', extraActions }) {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {
      currentPassword: form.currentPassword ? null : 'Introduce tu contraseña actual',
      newPassword: validatePassword(form.newPassword),
      confirmPassword:
        form.confirmPassword !== form.newPassword ? 'Las contraseñas no coinciden' : !form.confirmPassword ? 'Confirma la nueva contraseña' : null,
    };
    if (!next.newPassword && form.newPassword === form.currentPassword) {
      next.newPassword = 'Debe ser distinta a la contraseña actual';
    }
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    try {
      await changePassword(form);
      onSuccess?.();
    } catch (err) {
      setErrors(err.details || {});
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form-stack" onSubmit={handleSubmit} noValidate>
      {formError && <Alert tone="error" title={formError} />}
      <PasswordField
        label="Contraseña actual"
        autoComplete="current-password"
        value={form.currentPassword}
        onChange={update('currentPassword')}
        error={errors.currentPassword}
        disabled={submitting}
        required
      />
      <PasswordField
        label="Nueva contraseña"
        autoComplete="new-password"
        value={form.newPassword}
        onChange={update('newPassword')}
        error={errors.newPassword}
        disabled={submitting}
        required
      />
      <PasswordRules value={form.newPassword} />
      <PasswordField
        label="Confirmar nueva contraseña"
        autoComplete="new-password"
        value={form.confirmPassword}
        onChange={update('confirmPassword')}
        error={errors.confirmPassword}
        disabled={submitting}
        required
      />
      <div className="form-actions">
        {extraActions}
        <Button type="submit" variant="primary" loading={submitting} icon={KeyRound}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
