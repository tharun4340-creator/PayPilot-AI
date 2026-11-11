import { useLanguage } from '../context/LanguageContext.jsx';

export default function DemoBadge({ className = '' }) {
  const { t } = useLanguage();
  return (
    <span
      className={`inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 ${className}`}
      title={t('demo.notice')}
    >
      {t('common.demoData')}
    </span>
  );
}
