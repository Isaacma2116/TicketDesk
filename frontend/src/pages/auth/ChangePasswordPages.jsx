import { Navigate, useNavigate } from 'react-router-dom';
import { LogOut, ShieldAlert } from 'lucide-react';
import { AuthLayout } from '../../layouts/AuthLayout';
import { ChangePasswordForm } from '../../components/users/ChangePasswordForm';
import { Alert, Button, Card, PageHeader } from '../../components/ui';
import { useAuth, useDocumentTitle, useToast } from '../../hooks';

/** Cambio obligatorio tras recibir una contraseña temporal (sin menú). */
export function ForcedChangePasswordPage() {
  useDocumentTitle('Crea tu contraseña');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Sin contraseña temporal pendiente (o justo después de cambiarla) no hay nada que hacer aquí.
  if (!user.mustChangePassword) return <Navigate to="/dashboard" replace />;

  return (
    <AuthLayout>
      <div className="auth__header">
        <h1 className="auth__title">Crea tu contraseña</h1>
        <p className="auth__subtitle">
          Hola, {user.firstName}. Estás usando una contraseña temporal; define una contraseña personal para continuar.
        </p>
      </div>
      <Alert tone="info" icon={ShieldAlert} title="Paso obligatorio de seguridad">
        No compartas tu contraseña con nadie, ni siquiera con el administrador.
      </Alert>
      <ChangePasswordForm
        submitLabel="Guardar y continuar"
        onSuccess={() => {
          toast.success('Contraseña actualizada', 'Ya puedes usar la plataforma.');
          navigate('/dashboard', { replace: true });
        }}
        extraActions={
          <Button
            variant="ghost"
            icon={LogOut}
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            Cerrar sesión
          </Button>
        }
      />
    </AuthLayout>
  );
}

/** Cambio voluntario desde el menú de usuario. */
export function AccountPasswordPage() {
  useDocumentTitle('Cambiar contraseña');
  const toast = useToast();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="Cambiar contraseña" subtitle="Al cambiarla se cerrarán tus sesiones abiertas en otros dispositivos." />
      <Card className="narrow-card">
        <ChangePasswordForm
          onSuccess={() => {
            toast.success('Contraseña actualizada', 'Se cerraron tus sesiones en otros dispositivos.');
            navigate('/dashboard');
          }}
        />
      </Card>
    </>
  );
}
