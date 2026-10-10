import { createContext, useCallback, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

export const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (type, title, text, duration = 4500) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((list) => [...list.slice(-3), { id, type, title, text }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (title, text) => show('success', title, text),
      error: (title, text) => show('error', title, text, 6500),
      info: (title, text) => show('info', title, text),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="region" aria-label="Notificaciones" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className={`toast toast--${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
              <Icon className="toast__icon" aria-hidden="true" />
              <div className="toast__content">
                <p className="toast__title">{t.title}</p>
                {t.text && <p className="toast__text">{t.text}</p>}
              </div>
              <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Cerrar notificación">
                <X />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
