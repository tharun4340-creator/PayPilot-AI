import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Bot, Check, CircleDollarSign, Clock3, Fingerprint, Plus, ShieldCheck, WalletCards } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTip, XAxis } from 'recharts';
import PageHeader from '../components/PageHeader.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import StatCard from '../components/StatCard.jsx';
import PaymentList from '../components/PaymentList.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DemoBadge from '../components/DemoBadge.jsx';
import LoadDemoButton from '../components/LoadDemoButton.jsx';
import { SkeletonCards } from '../components/Skeleton.jsx';
import useFetch from '../hooks/useFetch.js';
import useFormat from '../hooks/useFormat.js';
import { getDashboard } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

const horizons = ['1M', '3M', '6M'];

function savedNumber(key, fallback) {
  try { const value = Number(localStorage.getItem(key)); return value > 0 ? value : fallback; } catch { return fallback; }
}

export default function Dashboard() {
  const { t } = useLanguage();
  const fmt = useFormat();
  const { data, loading, error, reload } = useFetch(() => getDashboard(), []);
  const [horizon, setHorizon] = useState('3M');
  const [reserve, setReserve] = useState(1200);
  const [monthlyCosts, setMonthlyCosts] = useState(1000);
  const [savedCurrency, setSavedCurrency] = useState(null);
  const actions = <Link to="/app/payments/new" className="future-primary"><Plus className="h-4 w-4" />Create payment</Link>;

  const chart = useMemo(() => {
    const rows = data?.monthly || [];
    const count = horizon === '1M' ? 1 : horizon === '3M' ? 3 : 6;
    return rows.slice(-count).map((m) => ({ ...m, label: fmt.month(m.month) }));
  }, [data, fmt, horizon]);

  const currency = data?.totals?.currency || 'USD';
  const reserveKey = `paypilot-reserve-${currency.toLowerCase()}`;
  const costsKey = `paypilot-costs-${currency.toLowerCase()}`;
  const localCurrency = currency === 'INR';
  const reserveFallback = localCurrency ? 60000 : 1200;
  const costsFallback = localCurrency ? 50000 : 1000;
  useEffect(() => {
    if (savedCurrency === currency) return;
    setReserve(savedNumber(reserveKey, reserveFallback));
    setMonthlyCosts(savedNumber(costsKey, costsFallback));
    setSavedCurrency(currency);
  }, [currency, costsKey, reserveFallback, reserveKey, costsFallback, savedCurrency]);
  useEffect(() => {
    if (savedCurrency !== currency) return;
    try { localStorage.setItem(reserveKey, String(reserve)); localStorage.setItem(costsKey, String(monthlyCosts)); } catch { /* storage may be unavailable */ }
  }, [reserve, monthlyCosts, reserveKey, costsKey, savedCurrency, currency]);

  if (loading) return <><PageHeader title={t('page.dashboard')} /><SkeletonCards count={4} /></>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (data.data_mode === 'empty') return <><PageHeader title={t('page.dashboard')} subtitle={t('page.dashboard.sub')} /><Card><EmptyState illustration="chart" title={t('dash.empty.title')} body={t('dash.empty.body')}><LoadDemoButton onDone={reload} variant="primary" /></EmptyState></Card></>;

  const { totals: tt } = data;
  const cur = tt.currency;
  const weeksCovered = monthlyCosts > 0 ? (reserve / monthlyCosts) * 4.345 : 0;
  const largestShare = tt.received > 0 && data.top_customers.length ? Math.round((data.top_customers[0].total / tt.received) * 100) : 0;
  return (
    <div className="future-dashboard">
      <PageHeader title="Cash flow" subtitle="Payments, invoices, and the reserve you set in one place." actions={<>{data.data_mode === 'demo' && <DemoBadge />}{actions}</>} />

      <section className="future-hero" aria-label="Account overview">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="future-eyebrow"><span className="future-live-dot" /> Payments received</div>
            <p className="mt-5 text-sm text-white/65">Total received</p>
            <p className="future-balance">{fmt.money(tt.received, cur)}</p>
            <p className="mt-2 text-sm text-white/70">
              {data.alert_count > 0
                ? <Link className="text-amber-200 hover:text-amber-100" to="/app/safety">{data.alert_count} recent alert{data.alert_count === 1 ? '' : 's'} to review</Link>
                : 'No recent safety alerts.'}
            </p>
          </div>
          <div className="hidden rounded-2xl border border-white/15 bg-white/10 p-3 text-emerald-100 sm:block"><WalletCards className="h-7 w-7" aria-hidden="true" /></div>
        </div>
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-4 border-t border-white/15 pt-5 sm:grid-cols-4">
          <div><p className="future-mini-label">Awaiting payment</p><p className="mt-1 text-lg font-semibold">{fmt.money(tt.pending_amount, cur)}</p></div>
          <div><p className="future-mini-label">Completed</p><p className="mt-1 text-lg font-semibold">{fmt.number(tt.completed_count)} <span className="text-xs font-normal text-white/65">payments</span></p></div>
          <div><p className="future-mini-label">Payments made</p><p className="mt-1 text-lg font-semibold">{tt.sent == null ? '?' : fmt.money(tt.sent, cur)}</p></div>
          <div className="flex items-end sm:justify-end"><Link to="/app/insights" className="future-text-link">View insights <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('dash.received')} value={fmt.money(tt.received, cur)} icon={ArrowDownLeft} />
        <StatCard label={t('dash.sent')} value={tt.sent == null ? t('common.notAvailable') : fmt.money(tt.sent, cur)} note={tt.sent == null ? t('dash.sentNote') : undefined} icon={ArrowUpRight} muted={tt.sent == null} />
        <StatCard label={t('dash.pending')} value={fmt.money(tt.pending_amount, cur)} note={t('dash.pendingCount', { n: tt.pending_count })} icon={Clock3} />
        <StatCard label={t('dash.completed')} value={fmt.number(tt.completed_count)} note={t('dash.paymentsCount', { n: tt.completed_count })} icon={Check} />
      </div>

      {data.alert_count > 0 && <Link to="/app/safety" className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"><ShieldCheck className="h-4 w-4" />{t('dash.alerts', { n: data.alert_count })}<ArrowRight className="ml-auto h-4 w-4" /></Link>}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="future-chart-card xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-base font-semibold text-ink-900">Payments received</h2><p className="mt-1 text-sm text-ink-500">Monthly totals</p></div>
            <div className="future-tabs" role="group" aria-label="Chart time range">{horizons.map((item) => <button key={item} type="button" aria-pressed={horizon === item} onClick={() => setHorizon(item)} className={horizon === item ? 'active' : ''}>{item}</button>)}</div>
          </div>
          <div className="mt-3 h-56" role="img" aria-label={t('dash.monthly')}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ left: 0, right: 6, top: 12 }}><defs><linearGradient id="receivedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#39745e" stopOpacity={0.23} /><stop offset="96%" stopColor="#39745e" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e9e9f0" /><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: '#777f7a' }} /><ChartTip formatter={(v) => fmt.money(v, cur)} contentStyle={{ borderRadius: 12, border: '1px solid #ececf2', boxShadow: '0 8px 30px #15152a12' }} /><Area type="monotone" dataKey="received" stroke="#39745e" strokeWidth={2.5} fill="url(#receivedFill)" activeDot={{ r: 5, fill: '#39745e', stroke: '#fff', strokeWidth: 3 }} /></AreaChart></ResponsiveContainer></div>
          <div className="flex items-center gap-2 border-t border-ink-100 pt-3 text-xs text-ink-500"><span className="h-2 w-2 rounded-full bg-emerald-700" /> Received <span className="ml-auto">Unpaid requests are excluded</span></div>
        </Card>

        <Card className="future-ai-card">
          <div className="flex items-center justify-between"><span className="future-ai-icon"><ShieldCheck className="h-4 w-4" /></span><span className="future-ai-status">Cash runway</span></div>
          <p className="mt-5 text-sm font-medium text-ink-500">A simple planning estimate</p>
          <h2 className="mt-2 text-xl font-semibold leading-snug text-ink-950">How long could your reserve cover essentials?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">Enter a reserve and monthly costs to see how the numbers compare.</p>
          <div className="future-goal-box mt-4">
            <div className="flex items-end justify-between"><div><p className="text-xs font-medium text-ink-500">Cash reserve</p><p className="mt-1 text-2xl font-semibold text-ink-950">{fmt.money(reserve, cur)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${weeksCovered >= 4.3 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{weeksCovered.toFixed(1)} weeks</span></div>
            <input aria-label="Cash reserve" className="future-range mt-3" type="range" min={localCurrency ? 5000 : 100} max={localCurrency ? 500000 : 10000} step={localCurrency ? 5000 : 100} value={Math.min(reserve, localCurrency ? 500000 : 10000)} onChange={(e) => setReserve(Number(e.target.value))} />
            <div className="mt-4 flex items-end justify-between"><div><p className="text-xs font-medium text-ink-500">Essential monthly costs</p><p className="mt-1 text-lg font-semibold text-ink-950">{fmt.money(monthlyCosts, cur)}</p></div></div>
            <input aria-label="Essential monthly costs" className="future-range mt-3" type="range" min={localCurrency ? 10000 : 200} max={localCurrency ? 300000 : 6000} step={localCurrency ? 5000 : 100} value={Math.min(monthlyCosts, localCurrency ? 300000 : 6000)} onChange={(e) => setMonthlyCosts(Number(e.target.value))} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">Your inputs stay in this browser. This estimate is not a forecast and does not include pending payments.</p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5"><span className="text-xs text-ink-500">Share from your largest customer</span><strong className="text-sm text-ink-900">{largestShare}%</strong></div>
          <Link to="/app/assistant" className="future-ai-link mt-3">Ask about late payments <ArrowRight className="h-4 w-4" /></Link>
        </Card>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-base font-semibold text-ink-900">Shortcuts</h2><p className="mt-1 text-sm text-ink-500">Common tasks</p></div><Link to="/app/payments/new" className="future-copy-link">New payment request <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
          <Link to="/app/payments/new" className="future-command"><span className="future-command-icon purple"><Plus /></span><span><strong>Request payment</strong><small>Create a PayPal link</small></span><ArrowRight className="future-command-arrow" /></Link>
          <Link to="/app/wallet" className="future-command"><span className="future-command-icon mint"><ArrowUpRight /></span><span><strong>Pay anyone</strong><small>Use a UPI app</small></span><ArrowRight className="future-command-arrow" /></Link>
          <Link to="/app/invoices/new" className="future-command"><span className="future-command-icon blue"><CircleDollarSign /></span><span><strong>New invoice</strong><small>Bill a customer</small></span><ArrowRight className="future-command-arrow" /></Link>
          <Link to="/app/assistant" className="future-command"><span className="future-command-icon mint"><Bot /></span><span><strong>Ask the assistant</strong><small>Get help with follow-ups</small></span><ArrowRight className="future-command-arrow" /></Link>
          <Link to="/app/safety" className="future-command"><span className="future-command-icon amber"><Fingerprint /></span><span><strong>Safety alerts</strong><small>Review recent activity</small></span><ArrowRight className="future-command-arrow" /></Link>
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardTitle action={<Link to="/app/payments" className="future-text-link">All payments <ArrowRight className="h-3.5 w-3.5" /></Link>}>{t('dash.recent')}</CardTitle>{data.recent.length ? <PaymentList items={data.recent} /> : <p className="py-6 text-sm text-ink-500">{t('payments.empty.title')}</p>}</Card>
        <div className="space-y-4"><Card><CardTitle action={<Link to="/app/customers" className="text-xs text-pilot-600">View all</Link>}>{t('dash.topCustomers')}</CardTitle><ul className="divide-y divide-ink-100">{data.top_customers.map((c) => <li key={c.name} className="flex items-center justify-between gap-2 py-2.5 text-sm"><span className="flex min-w-0 items-center gap-2"><span className="future-customer-avatar">{c.name?.slice(0, 1)}</span><span className="truncate">{c.name}</span></span><span className="whitespace-nowrap font-medium">{fmt.money(c.total, cur)}</span></li>)}</ul></Card><Card><CardTitle>{t('dash.timeline')}</CardTitle><ol className="mt-2 space-y-3 border-l border-ink-100 pl-4">{data.timeline.slice(0, 4).map((e, i) => <li key={i} className="relative text-xs text-ink-600"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-pilot-500 ring-4 ring-white" /><p>{e.message}</p><p className="mt-0.5 text-[11px] text-ink-400">{fmt.dateTime(e.time)}</p></li>)}</ol></Card></div>
      </div>
      <footer className="future-footer"><span>Figures come from payment records in your account.</span></footer>
    </div>
  );
}
