import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { SeverityBadge } from '../components/Badge.jsx';
import { SkeletonRows } from '../components/Skeleton.jsx';
import useFetch from '../hooks/useFetch.js';
import useFormat from '../hooks/useFormat.js';
import { getSafetyActivity, getSafetyAlerts } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Safety() {
  const { t } = useLanguage();
  const fmt = useFormat();
  const alerts = useFetch(() => getSafetyAlerts(), []);
  const activity = useFetch(() => getSafetyActivity({ limit: 30 }), []);
  return (
    <>
      <PageHeader title={t('page.safety')} subtitle={t('page.safety.sub')} />
      <p className="mb-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t('safety.note')}</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>{t('safety.alerts')}</CardTitle>
          {alerts.loading ? <SkeletonRows rows={3} /> : alerts.error ? <ErrorState error={alerts.error} onRetry={alerts.reload} /> : alerts.data.items.length === 0 ? (
            <EmptyState illustration="shield" title={t('safety.noAlerts.title')} body={t('safety.noAlerts.body')} />
          ) : (
            <ul className="mt-3 space-y-3">
              {alerts.data.items.map((a) => (
                <li key={a.id} className="rounded-xl border border-ink-100 p-4">
                  <div className="flex items-center gap-2"><SeverityBadge severity={a.severity} /><h3 className="text-sm font-semibold">{a.title}</h3></div>
                  <p className="mt-1 text-sm text-ink-600">{a.explanation}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">{a.payment_ids.map((pid) => <Link key={pid} to={`/app/payments/${pid}`} className="font-medium text-pilot-600">{t('safety.viewPayment')} #{pid}</Link>)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>{t('safety.activity')}</CardTitle>
          {activity.loading ? <SkeletonRows rows={4} /> : activity.error ? <ErrorState error={activity.error} onRetry={activity.reload} /> : activity.data.length === 0 ? <p className="py-4 text-sm text-ink-500">{t('safety.noActivity')}</p> : (
            <ul className="mt-3 divide-y divide-ink-100 text-xs">{activity.data.map((a) => <li key={a.id} className="py-2"><p className="font-medium text-ink-800">{a.action}</p>{a.details && <p className="truncate text-ink-500">{a.details}</p>}<p className="text-[11px] text-ink-400">{fmt.dateTime(a.time)}</p></li>)}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
