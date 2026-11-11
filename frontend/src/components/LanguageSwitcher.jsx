import { Globe } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { LANGUAGES } from '../i18n/index.js';

export default function LanguageSwitcher({ dark = false, className = '' }) {
  const { lang, setLanguage, t } = useLanguage();
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t('common.language')}</span>
      <Globe
        className={`pointer-events-none absolute left-2.5 h-4 w-4 ${dark ? 'text-ink-200' : 'text-ink-400'}`}
        aria-hidden="true"
      />
      <select
        value={lang}
        onChange={(e) => setLanguage(e.target.value)}
        className={`appearance-none rounded-xl border py-2 pl-8 pr-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-pilot-400 ${
          dark
            ? 'border-white/20 bg-white/10 text-white [&>option]:text-ink-900'
            : 'border-ink-200 bg-white text-ink-700'
        }`}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
