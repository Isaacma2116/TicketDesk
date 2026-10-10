import { Power, PowerOff } from 'lucide-react';
import { departmentsService } from '../services/organizationService';
import { useConfirm, useToast } from './index';

/** Acciones sensibles sobre un departamento, con confirmación y notificaciones. */
export function useDepartmentActions({ onChanged, onDeleted } = {}) {
  const confirm = useConfirm();
  const toast = useToast();

  const toggleStatus = (department) => {
    const activating = department.status !== 'active';
    return confirm({
      tone: activating ? 'info' : 'warning',
      icon: activating ? Power : PowerOff,
      title: activating
        ? `¿Deseas activar el departamento de ${department.name}?`
        : `¿Deseas desactivar el departamento de ${department.name}?`,
      message: activating ? (
        'Volverá a estar disponible para asignar usuarios y, más adelante, para recibir solicitudes.'
      ) : (
        <>
          Los usuarios y datos asociados se conservarán ({department.membersCount} usuario
          {department.membersCount === 1 ? '' : 's'}). El departamento dejará de aparecer para nuevas asignaciones.
        </>
      ),
      confirmLabel: activating ? 'Activar' : 'Desactivar',
      onConfirm: async () => {
        try {
          const { department: updated } = await departmentsService.changeStatus(
            department.id,
            activating ? 'active' : 'inactive',
          );
          toast.success(activating ? 'Departamento activado' : 'Departamento desactivado', updated.name);
          onChanged?.(updated);
        } catch (err) {
          toast.error('No se pudo cambiar el estado', err.message);
          throw err;
        }
      },
    });
  };

  const remove = (department) =>
    confirm({
      tone: 'danger',
      title: `¿Eliminar el departamento ${department.name}?`,
      message:
        'El departamento no tiene usuarios asociados, por lo que puede eliminarse definitivamente. Esta acción no se puede deshacer. Si podrías necesitarlo más adelante, desactívalo en su lugar.',
      confirmLabel: 'Eliminar departamento',
      onConfirm: async () => {
        try {
          await departmentsService.remove(department.id);
          toast.success('Departamento eliminado', department.name);
          onDeleted?.(department);
        } catch (err) {
          toast.error('No se pudo eliminar', err.message);
          throw err;
        }
      },
    });

  return { toggleStatus, remove };
}
