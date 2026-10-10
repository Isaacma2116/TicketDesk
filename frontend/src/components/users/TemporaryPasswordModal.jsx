import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Modal, useModalIds } from '../ui/Modal';
import { Alert, Button, IconButton } from '../ui';

/** Muestra UNA sola vez la contraseña temporal generada por el sistema. */
export function TemporaryPasswordModal({ user, password, title = 'Usuario creado', onClose }) {
  const { titleId, textId } = useModalIds();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal onClose={onClose} labelledBy={titleId} describedBy={textId} maxWidth={500}>
      <div className="modal__body">
        <div className="modal__icon modal__icon--success">
          <KeyRound aria-hidden="true" />
        </div>
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        <p className="modal__text" id={textId}>
          Entrega esta contraseña temporal a <strong>{user.fullName}</strong> ({user.email}) por un canal seguro. Deberá
          cambiarla en su primer inicio de sesión.
        </p>
        <div className="secret-box">
          <code>{password}</code>
          <IconButton icon={copied ? Check : Copy} label={copied ? 'Copiada' : 'Copiar contraseña'} onClick={copy} />
        </div>
        <div style={{ marginTop: 16 }}>
          <Alert tone="warning" title="Solo se mostrará esta vez">
            Por seguridad no se almacena en texto plano y no podrás volver a consultarla.
          </Alert>
        </div>
      </div>
      <div className="modal__footer">
        <Button variant="primary" onClick={onClose} data-autofocus>
          Entendido
        </Button>
      </div>
    </Modal>
  );
}
