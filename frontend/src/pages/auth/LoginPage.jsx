import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, LogIn, Mail } from 'lucide-react';
import { AuthLayout } from '../../layouts/AuthLayout';
import { Alert, Button, Checkbox, PasswordField, TextField } from '../../components/ui';
import { useAuth, useDocumentTitle } from '../../hooks';
import { validateEmail } from '../../utils/validation';

export default function LoginPage() {
  useDocumentTitle('Iniciar sesión');
  const { login, expired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const passwordRef = useRef(null);

  const [form, setForm] = useState({ email: '', password: '', rememberMe: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const next = {
      email: validateEmail(form.email),
      password: form.password ? null : 'La contraseña es obligatoria',
    };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;

    setSubmitting(true);
    try {
      const data = await login({ email: form.email.trim(), password: form.password, rememberMe: form.rememberMe });
      const from = location.state?.from?.pathname;
      navigate(data.user.mustChangePassword ? '/cambiar-contrasena' : from || '/dashboard', { replace: true });
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR') setErrors(err.details);
      setFormError(err.message);
      setForm((f) => ({ ...f, password: '' }));
      passwordRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth__header">
        <h1 className="auth__title">Iniciar sesión</h1>
        <p className="auth__subtitle">Introduce tus credenciales para acceder a la plataforma.</p>
      </div>

      {expired && !formError && (
        <Alert tone="warning" title="Tu sesión ha finalizado">
          Por seguridad, vuelve a iniciar sesión para continuar.
        </Alert>
      )}
      {formError && <Alert tone="error" title={formError} />}

      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Correo electrónico"
          type="email"
          name="email"
          icon={Mail}
          placeholder="nombre@empresa.com"
          autoComplete="username"
          autoFocus
          value={form.email}
          onChange={update('email')}
          error={errors.email}
          disabled={submitting}
          required
        />

        <PasswordField
          ref={passwordRef}
          label="Contraseña"
          name="password"
          icon={Lock}
          placeholder="••••••••"
          autoComplete="current-password"
          value={form.password}
          onChange={update('password')}
          error={errors.password}
          disabled={submitting}
          required
        />

        <div className="auth__row">
          <Checkbox label="Recordarme" checked={form.rememberMe} onChange={update('rememberMe')} disabled={submitting} />
          <Link to="/olvide-contrasena" className="auth__link">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" block loading={submitting} icon={LogIn}>
          {submitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </Button>
      </form>

      <p className="auth__footnote">
        ¿No tienes cuenta? Las cuentas las crea el administrador de tu organización.
      </p>
    </AuthLayout>
  );
}
