import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bot, CreditCard, FileText, LayoutDashboard, LogOut, MoreHorizontal, Settings as SettingsIcon, ShieldCheck, BarChart3, Users, ClipboardList, WalletCards } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import DemoBanner from '../components/DemoBanner.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import NotificationsPanel from '../components/NotificationsPanel.jsx';
import Onboarding from '../components/Onboarding.jsx';
import Modal from '../components/Modal.jsx';
import { NotificationsProvider } from '../context/NotificationsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { initials } from '../utils/format.js';

const NAV = [
  { to: '/app', key: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/wallet', key: 'nav.wallet', icon: WalletCards },
  { to: '/app/assistant', key: 'nav.assistant', icon: Bot },
  { to: '/app/payments', key: 'nav.payments', icon: CreditCard },
  { to: '/app/invoices', key: 'nav.invoices', icon: FileText },
  { to: '/app/pay-seller', key: 'nav.paySeller', icon: ArrowUpRight },
  { to: '/app/customers', key: 'nav.customers', icon: Users },
  { to: '/app/insights', key: 'nav.insights', icon: BarChart3 },
  { to: '/app/safety', key: 'nav.safety', icon: ShieldCheck },
  { to: '/app/reports', key: 'nav.reports', icon: ClipboardList },
  { to: '/app/settings', key: 'nav.settings', icon: SettingsIcon },
];
const PRIMARY_MOBILE = NAV.slice(0, 4);

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [more, setMore] = useState(false);

  const signOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <NotificationsProvider>
      <div className="min-h-screen bg-ink-50">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">{t('nav.skip')}</a>
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-ink-950 p-4 lg:flex">
          <Logo dark className="px-2 py-2" />
          <nav aria-label={t('nav.main')} className="mt-6 flex-1 space-y-1">
            {NAV.map(({ to, key, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white/10 text-white' : 'text-ink-300 hover:bg-white/5 hover:text-white'}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />{t(key)}
              </NavLink>
            ))}
          </nav>
          <button type="button" onClick={signOut} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 hover:bg-white/5 hover:text-white">
            <LogOut className="h-4 w-4" aria-hidden="true" />{t('nav.logout')}
          </button>
        </aside>

        <div className="lg:pl-60">
          <DemoBanner />
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-100 bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6">
            <Logo className="lg:hidden" size={28} />
            <p className="hidden text-sm text-ink-500 lg:block">{user?.business_name || user?.full_name}</p>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <NotificationsPanel />
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pilot-100 text-xs font-bold text-pilot-700" aria-hidden="true">{initials(user?.full_name)}</span>
            </div>
          </header>
          <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
            <Outlet />
          </main>
        </div>

        <nav aria-label={t('nav.main')} className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-100 bg-white lg:hidden">
          {PRIMARY_MOBILE.map(({ to, key, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-pilot-600' : 'text-ink-500'}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />{t(key)}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-500">
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />{t('nav.more')}
          </button>
        </nav>
        <Modal open={more} onClose={() => setMore(false)} title={t('nav.more')} sheet>
          <div className="grid grid-cols-2 gap-2">
            {NAV.slice(4).map(({ to, key, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={() => setMore(false)} className="flex items-center gap-2 rounded-xl border border-ink-100 p-3 text-sm font-medium text-ink-700">
                <Icon className="h-4 w-4" aria-hidden="true" />{t(key)}
              </NavLink>
            ))}
            <button type="button" onClick={signOut} className="flex items-center gap-2 rounded-xl border border-ink-100 p-3 text-sm font-medium text-ink-700">
              <LogOut className="h-4 w-4" aria-hidden="true" />{t('nav.logout')}
            </button>
          </div>
        </Modal>
        <Onboarding />
      </div>
    </NotificationsProvider>
  );
}
