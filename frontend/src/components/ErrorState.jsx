import { AlertTriangle } from 'lucide-react';
import Button from './Button.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function ErrorState({ error, onRetry }) {
  const { t } = useLanguage();
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 p-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold text-ink-900">{t('error.title')}</h2>
      <p className="max-w-md text-sm text-ink-500">{error?.message || t('common.error')}</p>
      {onRetry && (
        <Button variant="secondary" onClick={() => onRetry()}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
