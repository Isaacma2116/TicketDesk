import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Modal accesible: foco atrapado, Escape para cerrar y bloqueo del scroll. */
export function Modal({ onClose, labelledBy, describedBy, children, maxWidth }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    const focusables = () =>
      node.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])');
    (node.querySelector('[data-autofocus]') || focusables()[0])?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
      if (e.key === 'Tab') {
        const items = Array.from(focusables());
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        style={maxWidth ? { maxWidth } : undefined}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function useModalIds() {
  const id = useId();
  return { titleId: `${id}-title`, textId: `${id}-text` };
}
