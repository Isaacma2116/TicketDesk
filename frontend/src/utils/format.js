const LOCALE = 'es-MX';

export function formatDate(value, options = {}) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short', year: 'numeric', ...options }).format(
    new Date(value),
  );
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatLongDate(value = new Date()) {
  const text = new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatRelative(value) {
  if (!value) return 'Nunca';
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return 'hace un momento';
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function initials(firstName = '', lastName = '') {
  return `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase() || '?';
}

const AVATAR_COLORS = ['#4f46e5', '#0e9384', '#c11574', '#dc6803', '#1570ef', '#6941c6', '#067647', '#b42318'];
export function avatarColor(seed = '') {
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
