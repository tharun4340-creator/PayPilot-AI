import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import PaymentList from '../components/PaymentList.jsx';
import Pagination from '../components/Pagination.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import LoadDemoButton from '../components/LoadDemoButton.jsx';
import { SkeletonRows } from '../components/Skeleton.jsx';
import useFetch from '../hooks/useFetch.js';
import useDebounce from '../hooks/useDebounce.js';
import { getPayments } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';

const TABS = ['all', 'pending', 'completed', 'failed'];
const LIMIT = 20;

export default function Payments() {
  const { t } = useLanguage();
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [source, setSource] = useState('auto');
  const [offset, setOffset] = useState(0);
  const dq = useDebounce(q, 300);
  const { data, loading, error, reload } = useFetch(() => getPayments({ status: tab, q: dq || undefined, source, limit: LIMIT, offset }), [tab, dq, source, offset]);

  return (
    <>
      <PageHeader title={t('page.payments')} subtitle={t('page.payments.sub')}
        actions={<Link to="/app/payments/new" className="btn btn-primary"><Plus className="h-4 w-4" aria-hidden="true" />{t('payments.new')}</Link>} />
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" className="flex gap-1 overflow-x-auto">
            {TABS.map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => { setTab(k); setOffset(0); }}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-ink-950 text-white' : 'text-ink-600 hover:bg-ink-100'}`}>{t(`payments.tab.${k}`)}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
              <input className="input pl-9" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder={t('payments.search')} aria-label={t('payments.search')} />
            </div>
            <select className="input w-auto" value={source} onChange={(e) => { setSource(e.target.value); setOffset(0); }} aria-label={t('common.source')}>
              {['auto', 'real', 'demo', 'all'].map((s) => <option key={s} value={s}>{t(`common.source.${s}`)}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          {loading ? <SkeletonRows rows={6} /> : error ? <ErrorState error={error} onRetry={reload} /> : data.items.length === 0 ? (
            <EmptyState illustration="payments" title={t('payments.empty.title')} body={t('payments.empty.body')}>
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/app/payments/new" className="btn btn-primary">{t('payments.new')}</Link>
                <LoadDemoButton onDone={reload} />
              </div>
            </EmptyState>
          ) : (
            <>
              <PaymentList items={data.items} />
              <Pagination offset={offset} limit={LIMIT} total={data.total} onChange={setOffset} />
            </>
          )}
        </div>
      </Card>
    </>
  );
}
