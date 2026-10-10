import { useEffect, useRef, useState } from 'react';
import { ImageOff, Trash2, Upload } from 'lucide-react';
import { Button, FieldError } from '../ui';

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Vista previa y carga del logo. Valida tipo y tamaño en el cliente para dar
 * feedback inmediato; el backend vuelve a validar el contenido real del archivo.
 */
export function LogoUploader({ logoUrl, companyName, disabled, onUpload, onRemove }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'upload' | 'remove'

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!LOGO_TYPES.includes(file.type)) return setError('Formato no permitido. Usa PNG, JPG o WEBP.');
    if (file.size > LOGO_MAX_BYTES) return setError('La imagen supera el tamaño máximo de 2 MB.');

    const url = URL.createObjectURL(file);
    setPreview(url);
    setBusy('upload');
    try {
      await onUpload(file);
    } catch (err) {
      setError(err.details?.logo || err.message);
    } finally {
      setPreview(null);
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    setBusy('remove');
    try {
      await onRemove();
    } finally {
      setBusy(null);
    }
  };

  const src = preview || logoUrl;
  return (
    <div className="logo-uploader">
      <div className="logo-uploader__preview" data-empty={!src}>
        {src ? (
          <img src={src} alt={`Logo de ${companyName}`} />
        ) : (
          <span className="logo-uploader__placeholder">
            <ImageOff aria-hidden="true" />
            Sin logo
          </span>
        )}
      </div>
      <div className="logo-uploader__body">
        <p className="field__label">Logo de la empresa</p>
        <p className="field__hint">PNG, JPG o WEBP · máximo 2 MB · se recomienda formato cuadrado.</p>
        {!disabled && (
          <div className="logo-uploader__actions">
            <input
              ref={inputRef}
              type="file"
              accept={LOGO_TYPES.join(',')}
              className="sr-only"
              onChange={handleFile}
              aria-label="Seleccionar logo"
              tabIndex={-1}
            />
            <Button size="sm" icon={Upload} loading={busy === 'upload'} disabled={!!busy} onClick={() => inputRef.current?.click()}>
              {logoUrl ? 'Cambiar logo' : 'Subir logo'}
            </Button>
            {logoUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                icon={Trash2}
                loading={busy === 'remove'}
                disabled={!!busy}
                onClick={handleRemove}
              >
                Eliminar
              </Button>
            )}
          </div>
        )}
        <FieldError>{error}</FieldError>
      </div>
    </div>
  );
}
