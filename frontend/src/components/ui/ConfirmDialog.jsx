import { AlertTriangle, Info, Trash2 } from 'lucide-react';
import { Modal, useModalIds } from './Modal';
import { Button } from './index';

const TONES = {
  danger: { icon: Trash2, button: 'danger' },
  warning: { icon: AlertTriangle, button: 'primary' },
  info: { icon: Info, button: 'primary' },
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'warning',
  icon,
  loading,
  onConfirm,
  onCancel,
}) {
  const { titleId, textId } = useModalIds();
  const config = TONES[tone] ?? TONES.warning;
  const Icon = icon ?? config.icon;
  return (
    <Modal onClose={onCancel} labelledBy={titleId} describedBy={textId}>
      <div className="modal__body">
        <div className={`modal__icon modal__icon--${tone}`}>
          <Icon aria-hidden="true" />
        </div>
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        <div className="modal__text" id={textId}>
          {message}
        </div>
      </div>
      <div className="modal__footer">
        <Button onClick={onCancel} disabled={loading} data-autofocus>
          {cancelLabel}
        </Button>
        <Button variant={config.button} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
