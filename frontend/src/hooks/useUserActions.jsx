import { useState } from 'react';
import { Power, PowerOff } from 'lucide-react';
import { usersService } from '../services/usersService';
import { useConfirm, useToast } from './index';
import { TemporaryPasswordModal } from '../components/users/TemporaryPasswordModal';

/**
 * Acciones sensibles sobre un usuario, con confirmación y notificaciones.
 * Lo usan el listado y el detalle. Devuelve también el modal de contraseña
 * temporal, que el componente debe renderizar (`modal`).
 */
export function useUserActions({ onChanged, onDeleted } = {}) {
  const confirm = useConfirm();
  const toast = useToast();
  const [tempPassword, setTempPassword] = useState(null);

  const toggleStatus = (user) => {
    const activating = user.status !== 'active';
    return confirm({
      tone: activating ? 'info' : 'warning',
      icon: activating ? Power : PowerOff,
      title: activating ? '¿Activar usuario?' : '¿Desactivar usuario?',
      message: activating ? (
        <>
          <strong>{user.fullName}</strong> podrá volver a iniciar sesión en la plataforma.
        </>
      ) : (
        <>
          <strong>{user.fullName}</strong> no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Podrás
          reactivarlo en cualquier momento.
        </>
      ),
      confirmLabel: activating ? 'Activar' : 'Desactivar',
      onConfirm: async () => {
        try {
          const { user: updated } = await usersService.changeStatus(user.id, activating ? 'active' : 'inactive');
          toast.success(activating ? 'Usuario activado' : 'Usuario desactivado', updated.fullName);
          onChanged?.(updated);
        } catch (err) {
          toast.error('No se pudo cambiar el estado', err.message);
          throw err;
        }
      },
    });
  };

  const remove = (user) =>
    confirm({
      tone: 'danger',
      title: '¿Eliminar usuario?',
      message: (
        <>
          Se eliminará la cuenta de <strong>{user.fullName}</strong> ({user.email}) y se cerrarán sus sesiones. Esta
          acción no se puede deshacer desde la aplicación. Si solo quieres impedir el acceso, desactívalo.
        </>
      ),
      confirmLabel: 'Eliminar usuario',
      onConfirm: async () => {
        try {
          await usersService.remove(user.id);
          toast.success('Usuario eliminado', user.fullName);
          onDeleted?.(user);
        } catch (err) {
          toast.error('No se pudo eliminar', err.message);
          throw err;
        }
      },
    });

  const resetPassword = (user) =>
    confirm({
      tone: 'warning',
      title: '¿Restablecer contraseña?',
      message: (
        <>
          Se generará una contraseña temporal para <strong>{user.fullName}</strong>. Su contraseña actual dejará de
          funcionar, se cerrarán sus sesiones y deberá crear una nueva al iniciar sesión.
        </>
      ),
      confirmLabel: 'Generar contraseña temporal',
      onConfirm: async () => {
        try {
          const result = await usersService.update(user.id, { resetPassword: true });
          setTempPassword({ user: result.user, password: result.temporaryPassword });
          onChanged?.(result.user);
        } catch (err) {
          toast.error('No se pudo restablecer la contraseña', err.message);
          throw err;
        }
      },
    });

  const modal = tempPassword && (
    <TemporaryPasswordModal
      user={tempPassword.user}
      password={tempPassword.password}
      title="Contraseña restablecida"
      onClose={() => setTempPassword(null)}
    />
  );

  return { toggleStatus, remove, resetPassword, modal };
}
