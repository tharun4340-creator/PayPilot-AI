import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Pagination({ offset, limit, total, onChange }) {
  const { t } = useLanguage();
  if (!total) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-xs text-ink-500">{t('common.showing', { from, to, total })}</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={offset <= 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t('common.previous')}
        </Button>
        <Button variant="secondary" size="sm" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
          {t('common.next')}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
