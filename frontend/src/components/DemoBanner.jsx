import { FlaskConical } from 'lucide-react';
import { useSystem } from '../context/SystemContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Tooltip from './Tooltip.jsx';

export default function DemoBanner() {
  const { mode } = useSystem();
  const { t } = useLanguage();

  if (mode === 'demo') {
    return (
      <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm">
        {t('banner.demo')}
      </div>
    );
  }
  if (mode === 'sandbox') {
    return (
      <div role="status" className="flex items-center justify-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-1.5 text-xs text-blue-900">
        <Tooltip text={t('tip.sandbox')}>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 font-semibold text-white">
            <FlaskConical className="h-3 w-3" aria-hidden="true" />
            {t('banner.sandbox')}
          </span>
        </Tooltip>
        <span className="hidden sm:inline">{t('banner.sandboxNote')}</span>
      </div>
    );
  }
  return null;
}
