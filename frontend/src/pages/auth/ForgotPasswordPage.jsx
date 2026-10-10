import { Link } from 'react-router-dom';
import { ArrowLeft, LifeBuoy } from 'lucide-react';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useDocumentTitle } from '../../hooks';

/**
 * Recuperación de contraseña.
 * En esta etapa no hay servicio de correo, así que el restablecimiento lo hace
 * un administrador desde el módulo Usuarios ("Restablecer contraseña"), que
 * genera una contraseña temporal. Cuando exista el módulo de notificaciones
 * se sustituirá por un enlace de restablecimiento enviado por correo.
 */
export default function ForgotPasswordPage() {
  useDocumentTitle('Recuperar contraseña');
  return (
    <AuthLayout>
      <div className="auth__header">
        <div className="modal__icon modal__icon--info">
          <LifeBuoy aria-hidden="true" />
        </div>
        <h1 className="auth__title">¿Olvidaste tu contraseña?</h1>
        <p className="auth__subtitle">
          Por seguridad, el restablecimiento de contraseñas lo realiza el administrador de la plataforma.
        </p>
      </div>

      <ol className="auth__steps">
        <li>Contacta con el administrador o con el área de soporte de tu organización.</li>
        <li>Te proporcionará una contraseña temporal de un solo uso.</li>
        <li>Al iniciar sesión, el sistema te pedirá crear una contraseña nueva.</li>
      </ol>

      <Link to="/login" className="btn btn--block btn--lg">
        <ArrowLeft aria-hidden="true" /> Volver a iniciar sesión
      </Link>
    </AuthLayout>
  );
}
