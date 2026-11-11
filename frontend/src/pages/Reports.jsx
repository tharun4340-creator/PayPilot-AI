import { useState } from 'react';
import { Bell, Download } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';
import DemoBadge from '../components/DemoBadge.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { SkeletonRows } from '../components/Skeleton.jsx';
import useFetch from '../hooks/useFetch.js';
import useFormat from '../hooks/useFormat.js';
import { downloadReportCsv, generateReminders, getReport } from '../services/api.js';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { currentMonth } from '../utils/format.js';

export default function Reports() {
  const { t } = useLanguage();
  const fmt = useFormat();
  const toast = useToast();
  const notifs = useNotifications();
  const [month, setMonth] = useState(currentMonth());
  const { data, loading, error, reload } = useFetch(() => getReport({ month }), [month]);
  const [reminders, setReminders] = useState(null);
  const [busy, setBusy] = useState('');

  const csv = async () => { setBusy('csv'); try { await downloadReportCsv(month, `paypilot-${month}.csv`); } catch (e) { toast.error(e.message); } finally { setBusy(''); } };
  const remind = async () => {
    setBusy('rem');
    try { const r = await generateReminders(); setReminders(r); toast.success(r.created ? t('reports.reminders.created', { n: r.created }) : t('reports.reminders.none')); notifs.reload(); } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };

  return (
    <>
      <PageHeader title={t('page.reports')} subtitle={t('page.reports.sub')} actions={data?.data_mode === 'demo' && <DemoBadge />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="text-sm font-medium text-ink-700">{t('reports.month')}<input className="input mt-1 block" type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
            <Button variant="secondary" onClick={csv} loading={busy === 'csv'}><Download className="h-4 w-4" aria-hidden="true" />{t('reports.csv')}</Button>
          </div>
          {loading ? <SkeletonRows rows={4} /> : error ? <ErrorState error={error} onRetry={reload} /> : (
            <div className="mt-4 space-y-4">
              <div><div className="mb-1 flex items-center gap-2"><CardTitle>{t('reports.text')}</CardTitle><Badge tone={data.generated_by === 'llm' ? 'violet' : 'neutral'}>{t(`common.generatedBy.${data.generated_by}`)}</Badge></div><p className="whitespace-pre-wrap text-sm text-ink-700">{data.text}</p></div>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-xl bg-ink-50 p-3"><dt className="text-xs text-ink-500">{t('dash.received')}</dt><dd className="font-semibold">{fmt.money(data.totals.received, data.totals.currency)}</dd></div>
                <div className="rounded-xl bg-ink-50 p-3"><dt className="text-xs text-ink-500">{t('dash.pending')}</dt><dd className="font-semibold">{fmt.money(data.totals.pending_amount, data.totals.currency)}</dd></div>
                <div className="rounded-xl bg-ink-50 p-3"><dt className="text-xs text-ink-500">{t('dash.completed')}</dt><dd className="font-semibold">{data.totals.completed_count}</dd></div>
                <div className="rounded-xl bg-ink-50 p-3"><dt className="text-xs text-ink-500">{t('payments.tab.failed')}</dt><dd className="font-semibold">{data.totals.failed_count}</dd></div>
              </dl>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><h3 className="text-sm font-semibold">{t('reports.topCustomers')}</h3><ul className="mt-1 divide-y divide-ink-100 text-sm">{data.top_customers.map((c) => <li key={c.name} className="flex justify-between py-1.5"><span>{c.name}</span><b>{fmt.money(c.total, data.totals.currency)}</b></li>)}</ul></div>
                <div><h3 className="text-sm font-semibold">{t('reports.categories')}</h3><ul className="mt-1 divide-y divide-ink-100 text-sm">{data.categories.map((c) => <li key={c.category} className="flex justify-between py-1.5"><span>{c.category}</span><b>{fmt.money(c.total, data.totals.currency)}</b></li>)}</ul></div>
              </div>
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardTitle>{t('reports.reminders')}</CardTitle>
            <p className="mt-1 text-xs text-ink-500">{t('reports.reminders.note')}</p>
            <Button className="mt-3 w-full" variant="secondary" onClick={remind} loading={busy === 'rem'}><Bell className="h-4 w-4" aria-hidden="true" />{t('reports.reminders')}</Button>
            {reminders && <ul className="mt-3 space-y-2 text-xs text-ink-700">{reminders.items.length === 0 ? <li>{t('reports.reminders.none')}</li> : reminders.items.map((r) => <li key={r.invoice_id} className="rounded-lg bg-ink-50 p-2">{r.message}</li>)}</ul>}
          </Card>
          <Card>
            <div className="flex items-center justify-between"><CardTitle>{t('reports.notifications')}</CardTitle>{notifs.unread > 0 && <button type="button" className="text-xs font-medium text-pilot-600" onClick={notifs.markAllRead}>{t('reports.markAll')}</button>}</div>
            {notifs.items.length === 0 ? <p className="py-3 text-sm text-ink-500">{t('reports.noNotifications')}</p> : (
              <ul className="mt-2 divide-y divide-ink-100">{notifs.items.slice(0, 8).map((n) => <li key={n.id} className="py-2 text-xs"><p className={n.read ? 'text-ink-600' : 'font-semibold text-ink-900'}>{n.title}</p><p className="text-ink-500">{n.body}</p>{!n.read && <button type="button" className="mt-1 font-medium text-pilot-600" onClick={() => notifs.markRead(n.id)}>{t('reports.markRead')}</button>}</li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
