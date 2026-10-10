import { forwardRef, useId, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Eye, EyeOff, Inbox } from 'lucide-react';
import { avatarColor, initials } from '../../utils/format';

export function Spinner({ size, label }) {
  return <span className={`spinner${size === 'lg' ? ' spinner--lg' : ''}`} role="status" aria-label={label || 'Cargando'} />;
}

export function Button({ variant = 'secondary', size, block, loading, icon: Icon, children, className = '', ...props }) {
  const classes = [
    'btn',
    variant !== 'secondary' && `btn--${variant}`,
    size && `btn--${size}`,
    block && 'btn--block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} disabled={loading || props.disabled} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner /> : Icon && <Icon aria-hidden="true" />}
      {children}
    </button>
  );
}

export function IconButton({ label, icon: Icon, size = 'sm', className = '', ...props }) {
  return (
    <button
      type="button"
      className={`btn btn--ghost btn--icon btn--${size} ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p className="field__error" id={id}>
      <AlertCircle aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Campo con etiqueta, ayuda y error accesibles. Renderiza su hijo con los atributos aria. */
function Field({ label, required, hint, error, children, id }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children({
        id,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined,
      })}
      {hint && !error && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

export const TextField = forwardRef(function TextField(
  { label, required, hint, error, icon: Icon, className = '', ...props },
  ref,
) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} id={props.id || id}>
      {(aria) => (
        <div className="input-wrap">
          {Icon && <Icon className="input-wrap__icon" aria-hidden="true" />}
          <input
            ref={ref}
            className={`input${Icon ? ' input--with-icon' : ''} ${className}`}
            required={required}
            {...aria}
            {...props}
          />
        </div>
      )}
    </Field>
  );
});

export const PasswordField = forwardRef(function PasswordField(
  { label, required, hint, error, icon: Icon, ...props },
  ref,
) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} required={required} hint={hint} error={error} id={props.id || id}>
      {(aria) => (
        <div className="input-wrap">
          {Icon && <Icon className="input-wrap__icon" aria-hidden="true" />}
          <input
            ref={ref}
            type={visible ? 'text' : 'password'}
            className={`input input--with-action${Icon ? ' input--with-icon' : ''}`}
            required={required}
            {...aria}
            {...props}
          />
          <button
            type="button"
            className="input-action"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={visible}
            title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
      )}
    </Field>
  );
});

function renderOptions(options) {
  return options.map((o) => (
    <option key={o.value} value={o.value} disabled={o.disabled}>
      {o.label}
    </option>
  ));
}

/** Select accesible. Acepta `options` planas o `groups` ({ label, options }). */
export function SelectField({ label, required, hint, error, options = [], groups, placeholder, ...props }) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} id={props.id || id}>
      {(aria) => (
        <select className="select" required={required} {...aria} {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {renderOptions(options)}
          {groups
            ?.filter((g) => g.options.length)
            .map((g) => (
              <optgroup key={g.label} label={g.label}>
                {renderOptions(g.options)}
              </optgroup>
            ))}
        </select>
      )}
    </Field>
  );
}

export function TextAreaField({ label, required, hint, error, maxLength, value = '', ...props }) {
  const id = useId();
  return (
    <Field
      label={label}
      required={required}
      hint={maxLength ? `${hint ? `${hint} · ` : ''}${value.length}/${maxLength}` : hint}
      error={error}
      id={props.id || id}
    >
      {(aria) => <textarea className="input textarea" maxLength={maxLength} value={value} {...aria} {...props} />}
    </Field>
  );
}

export function CodeBadge({ children }) {
  return <span className="code-badge">{children}</span>;
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Alert({ tone = 'info', title, icon: Icon = AlertCircle, children }) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div>
        {title && <p className="alert__title">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export function Card({ title, subtitle, actions, footer, children, bodyClassName = 'card__body', className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card__header">
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
      {footer && <footer className="card__footer">{footer}</footer>}
    </section>
  );
}

export function Avatar({ firstName, lastName, seed, size }) {
  return (
    <span
      className={`avatar${size ? ` avatar--${size}` : ''}`}
      style={{ '--avatar-bg': avatarColor(seed ?? `${firstName}${lastName}`) }}
      aria-hidden="true"
    >
      {initials(firstName, lastName)}
    </span>
  );
}

export function Badge({ tone = 'neutral', dot, children }) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return status === 'active' ? (
    <Badge tone="success" dot>
      Activo
    </Badge>
  ) : (
    <Badge tone="neutral" dot>
      Inactivo
    </Badge>
  );
}

export function RoleBadge({ role }) {
  if (!role) return null;
  return <Badge tone={`role-${role.code}`}>{role.name}</Badge>;
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Icon aria-hidden="true" />
      </div>
      <p className="empty-state__title">{title}</p>
      {text && <p className="empty-state__text">{text}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export function PageLoader({ full, label = 'Cargando…' }) {
  return (
    <div className={`page-loader${full ? ' page-loader--full' : ''}`}>
      <Spinner size="lg" label={label} />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ width = '100%', height = 14, radius, style }) {
  return <span className="skeleton" style={{ display: 'block', width, height, borderRadius: radius, ...style }} />;
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <>
      {back}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">{title}</h1>
          {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
    </>
  );
}

export function Pagination({ page, totalPages, total, pageSize, onChange }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav className="pagination" aria-label="Paginación">
      <span className="tabular">
        Mostrando <strong>{from}</strong>–<strong>{to}</strong> de <strong>{total}</strong>
      </span>
      <div className="pagination__controls">
        <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Anterior
        </Button>
        <span className="tabular">
          {page} / {totalPages}
        </span>
        <Button size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Siguiente
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
