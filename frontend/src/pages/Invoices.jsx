import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import LoadDemoButton from '../components/LoadDemoButton.jsx';
import DemoBadge from '../components/DemoBadge.jsx';
import { StatusBadge } from '../components/Badge.jsx';
import { SkeletonRows } from '../components/Skeleton.jsx';
import useFetch from '../hooks/useFetch.js';
import useDebounce from '../hooks/useDebounce.js';
import useFormat from '../hooks/useFormat.js';
import { getInvoices } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

const STATUSES = ['all', 'UNPAID', 'PAID', 'OVERDUE', 'DRAFT', 'CANCELLED'];

export default function Invoices() {
  const { t } = useLanguage();
  const fmt = useFormat();
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const dq = useDebounce(q, 300);
  const { data, loading, error, reload } = useFetch(() => getInvoices({ status, q: dq || undefined }), [status, dq]);

  return (
    <>
      <PageHeader title={t('page.invoices')} subtitle={t('page.invoices.sub')} actions={<Link to="/app/invoices/new" className="btn btn-primary"><Plus className="h-4 w-4" aria-hidden="true" />{t('invoices.new')}</Link>} />
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto" role="tablist">
            {STATUSES.map((s) => (
              <button key={s} role="tab" aria-selected={status === s} type="button" onClick={() => setStatus(s)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${status === s ? 'bg-ink-950 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>{s === 'all' ? t('common.all') : t(`status.${s}`)}</button>
            ))}
          </div>
          <div className="relative sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
            <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('invoices.search')} aria-label={t('invoices.search')} />
          </div>
        </div>
        <div className="mt-4">
          {loading ? <SkeletonRows rows={5} /> : error ? <ErrorState error={error} onRetry={reload} /> : data.length === 0 ? (
            <EmptyState illustration="invoices" title={t('invoices.empty.title')} body={t('invoices.empty.body')}>
              <div className="flex flex-wrap justify-center gap-2"><Link to="/app/invoices/new" className="btn btn-primary">{t('invoices.new')}</Link><LoadDemoButton onDone={reload} /></div>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.map((i) => (
                <li key={i.id}>
                  <Link to={`/app/invoices/${i.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-ink-50/60">
                    <div className="min-w-0"><p className="text-sm font-medium">{i.number} · {i.customer_name}</p><p className="text-xs text-ink-500">{t('invoices.due')} {fmt.date(i.due_date)}</p></div>
                    <div className="flex shrink-0 flex-col items-end gap-1"><b className="text-sm">{fmt.money(i.total, i.currency)}</b><span className="flex items-center gap-1"><StatusBadge status={i.status} />{i.is_demo && <DemoBadge />}</span></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </>
  );
}
