import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Bot, CreditCard, FileText, BarChart3, ShieldCheck, Languages, ArrowRight, Lock, Play, Activity, WalletCards } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { seedDemoData } from '../services/api.js';

const FEATURES = [
  ['assistant', Bot], ['payments', CreditCard], ['wallet', WalletCards], ['invoices', FileText], ['insights', BarChart3], ['safety', ShieldCheck], ['languages', Languages], ['runway', Activity],
];

export default function Landing() {
  const { t } = useLanguage();
  const { signup, updateUser } = useAuth();
  const navigate = useNavigate();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState('');

  const launchDemo = async () => {
    setDemoBusy(true);
    setDemoError('');
    const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await signup({ email: `visitor-${suffix}@demo.paypilot.local`, password: `Pp-demo-${suffix}!`, full_name: 'Demo Visitor' });
      await updateUser({ onboarding_completed: true });
      try { await seedDemoData(); } catch { /* Dashboard has its own one-click sample-data action. */ }
      navigate('/app');
    } catch (err) {
      setDemoError(err.message || 'The demo could not start. Please try again.');
    } finally {
      setDemoBusy(false);
    }
  };
  return (
    <div className="bg-white text-ink-900">
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo dark />
          <nav className="hidden items-center gap-6 text-sm text-ink-200 md:flex">
            <a href="#features" className="hover:text-white">{t('landing.nav.features')}</a>
            <a href="#how" className="hover:text-white">{t('landing.nav.how')}</a>
            <a href="#security" className="hover:text-white">{t('landing.nav.security')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher dark />
            <Link to="/login" className="btn btn-sm bg-white/10 text-white hover:bg-white/20">{t('landing.cta.signin')}</Link>
          </div>
        </div>
      </header>

      <section className="future-landing-hero bg-ink-950 px-4 pb-20 pt-28 text-white sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="badge bg-white/10 text-pilot-200">{t('landing.badge')}</span>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{t('landing.hero.title')}</h1>
            <p className="mt-4 max-w-xl text-base text-ink-200 sm:text-lg">{t('landing.hero.subtitle')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/signup" className="btn btn-primary">{t('landing.cta.start')} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <button type="button" onClick={launchDemo} disabled={demoBusy} className="btn border border-white/20 bg-white/10 text-white hover:bg-white/15 disabled:opacity-60"><Play className="h-4 w-4" aria-hidden="true" />{demoBusy ? t('landing.cta.demo.busy') : t('landing.cta.demo')}</button>
              <Link to="/login" className="btn bg-white/10 text-white hover:bg-white/20">{t('landing.cta.signin')}</Link>
            </div>
            {demoError && <p role="alert" className="mt-3 max-w-lg rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{demoError}</p>}
            <p className="mt-4 text-xs text-ink-300">{t('landing.hero.note')}</p>
          </div>
          <div className="glass rounded-2xl p-5" role="img" aria-label={t('landing.preview.label')}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-pilot-200">{t('landing.preview.label')}</p>
            <div className="space-y-3 text-sm">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-pilot-600 px-4 py-2.5">
                <p className="text-[11px] opacity-70">{t('landing.preview.you')}</p>{t('landing.preview.ask')}
              </div>
              <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-white/10 px-4 py-3">
                <p>{t('landing.preview.reply')}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-ink-900/60 p-3 text-xs">
                  <dt className="text-ink-300">{t('landing.preview.customer')}</dt><dd className="text-right font-semibold">Rahul</dd>
                  <dt className="text-ink-300">{t('landing.preview.amount')}</dt><dd className="text-right font-semibold">₹1,500</dd>
                </dl>
                <p className="mt-2 text-xs text-amber-200">{t('landing.preview.waiting')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{t('landing.about.title')}</h2>
          <p className="mt-3 text-ink-600">{t('landing.about.body')}</p>
        </div>
      </section>

      <section id="features" className="bg-ink-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">{t('landing.features.title')}</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([key, Icon]) => (
              <div key={key} className="card p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pilot-50 text-pilot-600"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <h3 className="mt-4 font-semibold">{t(`landing.feature.${key}.title`)}</h3>
                <p className="mt-1 text-sm text-ink-600">{t(`landing.feature.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">{t('landing.how.title')}</h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <li key={n}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-950 text-sm font-bold text-white">{n}</span>
                <h3 className="mt-3 font-semibold">{t(`landing.how.${n}.title`)}</h3>
                <p className="mt-1 text-sm text-ink-600">{t(`landing.how.${n}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="security" className="bg-ink-950 px-4 py-16 text-white sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="flex items-center justify-center gap-2 text-2xl font-bold sm:text-3xl"><Lock className="h-6 w-6 text-pilot-300" aria-hidden="true" />{t('landing.security.title')}</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <li key={n} className="rounded-xl bg-white/5 p-4 text-sm text-ink-100">{t(`landing.security.${n}`)}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">{t('landing.cta.title')}</h2>
        <p className="mx-auto mt-2 max-w-xl text-ink-600">{t('landing.cta.body')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/signup" className="btn btn-primary">{t('landing.cta.start')}</Link>
          <button type="button" onClick={launchDemo} disabled={demoBusy} className="btn btn-dark disabled:opacity-60"><Play className="h-4 w-4" aria-hidden="true" />{demoBusy ? t('landing.cta.demo.busy') : t('landing.cta.demo')}</button>
        </div>
      </section>

      <footer className="border-t border-ink-100 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-ink-500 sm:flex-row">
          <Logo size={24} />
          <p>{t('landing.footer.note')}</p>
          <p>© {new Date().getFullYear()} PayPilot AI. {t('landing.footer.rights')}</p>
        </div>
      </footer>
    </div>
  );
}
