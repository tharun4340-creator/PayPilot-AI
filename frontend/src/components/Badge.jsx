import { useLanguage } from '../context/LanguageContext.jsx';

const TONES = {
  neutral: 'bg-ink-100 text-ink-600',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  violet: 'bg-pilot-50 text-pilot-700',
};

export default function Badge({ tone = 'neutral', className = '', children }) {
  return <span className={`badge ${TONES[tone] || TONES.neutral} ${className}`}>{children}</span>;
}

const STATUS_TONE = {
  CREATED: 'info',
  APPROVED: 'violet',
  COMPLETED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  DRAFT: 'neutral',
  UNPAID: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  PENDING: 'warning',
  CONFIRMED: 'success',
};

export function StatusBadge({ status }) {
  const { t } = useLanguage();
  if (!status) return null;
  return <Badge tone={STATUS_TONE[status] || 'neutral'}>{t(`status.${status}`)}</Badge>;
}

const SEVERITY_TONE = { info: 'info', warning: 'warning', high: 'danger' };

export function SeverityBadge({ severity }) {
  const { t } = useLanguage();
  return <Badge tone={SEVERITY_TONE[severity] || 'neutral'}>{t(`safety.severity.${severity}`)}</Badge>;
}
