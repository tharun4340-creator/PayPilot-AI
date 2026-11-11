import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-bold text-pilot-600">404</p>
      <h1 className="mt-3 text-xl font-semibold text-ink-900">{t('page.notFound')}</h1>
      <p className="mt-1 text-sm text-ink-500">{t('notfound.body')}</p>
      <Link to="/" className="btn btn-primary mt-5">{t('notfound.cta')}</Link>
    </div>
  );
}
