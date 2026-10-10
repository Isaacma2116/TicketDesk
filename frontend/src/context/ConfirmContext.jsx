import { createContext, useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export const ConfirmContext = createContext(null);

/**
 * Permite pedir confirmación de forma imperativa:
 *   const ok = await confirm({ title, message, confirmLabel, tone: 'danger' });
 * Si se pasa `onConfirm`, el diálogo muestra el estado de carga mientras se
 * ejecuta y solo se cierra cuando termina.
 */
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [loading, setLoading] = useState(false);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    setDialog(options);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!dialog.onConfirm) return close(true);
    setLoading(true);
    try {
      await dialog.onConfirm();
      close(true);
    } catch {
      // El llamador muestra el error; el diálogo se cierra igualmente.
      close(false);
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <ConfirmDialog
          {...dialog}
          loading={loading}
          onConfirm={handleConfirm}
          onCancel={() => !loading && close(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}
