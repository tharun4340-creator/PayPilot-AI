import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import StatCard from '../components/StatCard.jsx';
import PaymentList from '../components/PaymentList.jsx';
import ErrorState from '../components/ErrorState.jsx';
import DemoBadge from '../components/DemoBadge.jsx';
import { StatusBadge } from '../components/Badge.jsx';
import { SkeletonRows } from '../components/Skeleton.jsx';
import useFetch from '../hooks/useFetch.js';
import useFormat from '../hooks/useFormat.js';
import { getCustomer } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useSystem } from '../context/SystemContext.jsx';

export default function CustomerDetail() {
  const { id } = useParams();
  const { t } = useLanguage();
  const fmt = useFormat();
  const { defaultCurrency } = useSystem();
  const { data, loading, error, reload } = useFetch(() => getCustomer(id), [id]);
  if (loading) return <SkeletonRows rows={5} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { customer: c, payments, invoices, totals } = data;
  const cur = payments[0]?.currency || defaultCurrency;
  return (
    <>
      <PageHeader title={c.name} subtitle={[c.email, c.phone].filter(Boolean).join(' · ')} back="/app/customers" actions={c.is_demo && <DemoBadge />} />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t('customers.totalPaid')} value={fmt.money(totals.paid, cur)} />
        <StatCard label={t('customers.pending')} value={fmt.money(totals.pending, cur)} />
        <StatCard label={t('customers.payments')} value={fmt.number(totals.count)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card><CardTitle>{t('customers.history')}</CardTitle>{payments.length ? <PaymentList items={payments} /> : <p className="py-4 text-sm text-ink-500">{t('customers.noPayments')}</p>}</Card>
        <Card><CardTitle>{t('customers.invoices')}</CardTitle>
          {invoices.length ? <ul className="divide-y divide-ink-100">{invoices.map((i) => (
            <li key={i.id}><Link to={`/app/invoices/${i.id}`} className="flex items-center justify-between py-3 text-sm"><span>{i.number}</span><span className="flex items-center gap-2"><b>{fmt.money(i.total, i.currency)}</b><StatusBadge status={i.status} /></span></Link></li>))}</ul>
            : <p className="py-4 text-sm text-ink-500">{t('customers.noInvoices')}</p>}
        </Card>
      </div>
    </>
  );
}
