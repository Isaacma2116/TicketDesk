import { useEffect, useMemo, useState } from 'react';
import { Globe, Mail, PowerOff, RotateCw, Save, Trash2 } from 'lucide-react';
import { companyService } from '../../services/organizationService';
import { LogoUploader } from '../../components/company/LogoUploader';
import { Alert, Button, PageHeader, PageLoader, SelectField, StatusBadge, TextField } from '../../components/ui';
import { useAuth, useConfirm, useDocumentTitle, useToast } from '../../hooks';
import { formatDateTime } from '../../utils/format';
import { PERMISSIONS } from '../../utils/permissions';
import { validateEmail } from '../../utils/validation';

const FIELDS = ['name', 'tradeName', 'rfc', 'email', 'phone', 'address', 'city', 'state', 'postalCode', 'country', 'website', 'timezone', 'status'];

function toForm(company) {
  return Object.fromEntries(FIELDS.map((f) => [f, company[f] ?? '']));
}

function validate(form) {
  const e = {};
  if (!form.name.trim()) e.name = 'El nombre de la empresa es obligatorio';
  if (form.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(form.rfc.trim().toUpperCase())) e.rfc = 'RFC no válido (ej. ABC123456XY1)';
  if (form.email && validateEmail(form.email)) e.email = 'Introduce un correo electrónico válido';
  if (form.phone && !/^[+\d][\d\s().-]{6,29}$/.test(form.phone.trim())) e.phone = 'Teléfono no válido';
  if (form.postalCode && !/^[A-Za-z0-9 -]{3,10}$/.test(form.postalCode.trim())) e.postalCode = 'Código postal no válido';
  if (form.website && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(form.website.trim())) {
    e.website = 'Introduce una URL válida que empiece por https://';
  }
  return e;
}

export default function CompanySettingsPage() {
  useDocumentTitle('Empresa');
  const { hasPermission, refreshProfile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const canEdit = hasPermission(PERMISSIONS.COMPANY_UPDATE);

  const [company, setCompany] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const timezones = useMemo(() => Intl.supportedValuesOf('timeZone'), []);

  useEffect(() => {
    const controller = new AbortController();
    companyService
      .get({ signal: controller.signal })
      .then(({ company: c }) => {
        setCompany(c);
        setForm(toForm(c));
        setLoadError(null);
      })
      .catch((err) => err.name !== 'AbortError' && setLoadError(err.message));
    return () => controller.abort();
  }, [reloadKey]);

  if (loadError) {
    return (
      <Alert tone="error" title="No se pudo cargar la información de la empresa">
        {loadError}{' '}
        <Button size="sm" variant="ghost" icon={RotateCw} onClick={() => setReloadKey((k) => k + 1)}>
          Reintentar
        </Button>
      </Alert>
    );
  }
  if (!company || !form) return <PageLoader label="Cargando empresa…" />;

  const update = (field) => (e) => {
    let value = e.target.value;
    if (field === 'rfc') value = value.toUpperCase().replace(/\s+/g, '');
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((er) => ({ ...er, [field]: null }));
  };

  const dirty = FIELDS.some((f) => (form[f] ?? '') !== (company[f] ?? ''));

  const afterChange = async (c, title) => {
    setCompany(c);
    toast.success(title, c.tradeName || c.name);
    // Actualiza nombre y logo en el menú lateral.
    refreshProfile().catch(() => {});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const next = validate(form);
    setErrors(next);
    if (Object.keys(next).length) return;

    if (company.status === 'active' && form.status === 'inactive') {
      const ok = await confirm({
        tone: 'danger',
        icon: PowerOff,
        title: '¿Desactivar la empresa?',
        message:
          'Mientras la empresa esté inactiva, solo los superadministradores podrán iniciar sesión. Los datos se conservan y puedes reactivarla en cualquier momento.',
        confirmLabel: 'Desactivar empresa',
      });
      if (!ok) return;
    }

    // Solo se envían los campos modificados.
    const payload = {};
    for (const f of FIELDS) {
      if ((form[f] ?? '') !== (company[f] ?? '')) payload[f] = typeof form[f] === 'string' ? form[f].trim() : form[f];
    }

    setSaving(true);
    try {
      const { company: c } = await companyService.update(payload);
      setForm(toForm(c));
      await afterChange(c, 'Datos de la empresa actualizados');
    } catch (err) {
      if (err.details) setErrors(err.details);
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file) => {
    const { company: c } = await companyService.uploadLogo(file);
    await afterChange(c, 'Logo actualizado');
  };

  const removeLogo = () =>
    confirm({
      tone: 'danger',
      icon: Trash2,
      title: '¿Eliminar el logo?',
      message: 'La empresa se mostrará sin logo hasta que subas uno nuevo.',
      confirmLabel: 'Eliminar logo',
      onConfirm: async () => {
        try {
          const { company: c } = await companyService.removeLogo();
          await afterChange(c, 'Logo eliminado');
        } catch (err) {
          toast.error('No se pudo eliminar el logo', err.message);
          throw err;
        }
      },
    });

  const field = (name, label, props = {}) => (
    <TextField
      label={label}
      value={form[name]}
      onChange={update(name)}
      error={errors[name]}
      disabled={!canEdit || saving}
      {...props}
    />
  );

  return (
    <>
      <PageHeader
        title="Empresa"
        subtitle={
          canEdit
            ? 'Datos generales de tu organización. Se usarán en la plataforma y, más adelante, en notificaciones y reportes.'
            : 'Consulta los datos generales de tu organización.'
        }
      />

      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        {!canEdit && (
          <div className="form-section">
            <Alert tone="info" title="Solo lectura">
              Tu rol puede consultar estos datos, pero solo un superadministrador puede modificarlos.
            </Alert>
          </div>
        )}

        <div className="form-section">
          {formError && <Alert tone="error" title={formError} />}
          <div className="form-section__head">
            <h3>Identidad</h3>
            <p>Nombre legal, nombre comercial e identificación fiscal.</p>
          </div>
          <LogoUploader
            logoUrl={company.logoUrl}
            companyName={company.name}
            disabled={!canEdit}
            onUpload={uploadLogo}
            onRemove={removeLogo}
          />
          <div className="form-grid">
            {field('name', 'Nombre de la empresa (razón social)', { required: true, maxLength: 150, autoFocus: canEdit })}
            {field('tradeName', 'Nombre comercial', { maxLength: 150 })}
            {field('rfc', 'RFC', { maxLength: 13, placeholder: 'ABC123456XY1', autoComplete: 'off' })}
            <div className="field">
              <span className="field__label">Estado de la empresa</span>
              {canEdit ? (
                <div className="segmented" role="radiogroup" aria-label="Estado de la empresa">
                  {[
                    ['active', 'Activa'],
                    ['inactive', 'Inactiva'],
                  ].map(([value, label]) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="status"
                        value={value}
                        checked={form.status === value}
                        onChange={update('status')}
                        disabled={saving}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              ) : (
                <StatusBadge status={company.status} />
              )}
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__head">
            <h3>Contacto</h3>
          </div>
          <div className="form-grid">
            {field('email', 'Correo electrónico', { type: 'email', icon: Mail, maxLength: 191, placeholder: 'contacto@empresa.com' })}
            {field('phone', 'Teléfono', { type: 'tel', maxLength: 30, placeholder: '+52 55 1234 5678' })}
            <div className="span-2">
              {field('website', 'Sitio web', { type: 'url', icon: Globe, maxLength: 255, placeholder: 'https://empresa.com' })}
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__head">
            <h3>Dirección</h3>
          </div>
          <div className="form-grid">
            <div className="span-2">{field('address', 'Dirección', { maxLength: 255, placeholder: 'Calle, número, colonia' })}</div>
            {field('city', 'Ciudad', { maxLength: 100 })}
            {field('state', 'Estado', { maxLength: 100 })}
            {field('postalCode', 'Código postal', { maxLength: 10, inputMode: 'numeric' })}
            {field('country', 'País', { maxLength: 100 })}
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__head">
            <h3>Configuración regional</h3>
            <p>Se usará para mostrar fechas y, más adelante, para calcular tiempos de atención.</p>
          </div>
          <div className="form-grid">
            <SelectField
              label="Zona horaria"
              value={form.timezone}
              onChange={update('timezone')}
              options={timezones.map((tz) => ({ value: tz, label: tz.replaceAll('_', ' ') }))}
              error={errors.timezone}
              disabled={!canEdit || saving}
            />
            <div className="field">
              <span className="field__label">Última modificación</span>
              <p className="muted" style={{ fontSize: 'var(--text-sm)', paddingTop: 10 }}>
                {formatDateTime(company.updatedAt)}
              </p>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="form-footer">
            <Button
              onClick={() => {
                setForm(toForm(company));
                setErrors({});
                setFormError(null);
              }}
              disabled={!dirty || saving}
            >
              Descartar cambios
            </Button>
            <Button type="submit" variant="primary" icon={Save} loading={saving} disabled={!dirty}>
              Guardar cambios
            </Button>
          </div>
        )}
      </form>
    </>
  );
}
