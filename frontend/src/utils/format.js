export const LOCALES = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' };
export const SPEECH_LANGS = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' };

export function localeFor(lang) {
  return LOCALES[lang] || LOCALES.en;
}

export function formatMoney(amount, currency, lang = 'en') {
  if (amount === null || amount === undefined || amount === '' || Number.isNaN(Number(amount))) return '—';
  const value = Number(amount);
  try {
    return new Intl.NumberFormat(localeFor(lang), {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || ''}`.trim();
  }
}

export function formatNumber(value, lang = 'en') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 2 }).format(Number(value));
}

function toDate(value) {
  if (!value) return null;
  // Backend timestamps are UTC; if no zone is present, treat as UTC.
  const str = String(value);
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(str);
  const d = new Date(str.includes('T') && !hasZone ? `${str}Z` : str);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value, lang = 'en') {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export function formatDateTime(value, lang = 'en') {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

/** "2025-03" -> "Mar 2025" in the selected language. */
export function formatMonth(ym, lang = 'en') {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || '';
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat(localeFor(lang), { month: 'short', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback for very old browsers / insecure contexts.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

export function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
