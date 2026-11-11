import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import LoadDemoButton from '../components/LoadDemoButton.jsx';
import DemoBadge from '../components/DemoBadge.jsx';
import { SkeletonRows } from '../components/Skeleton.jsx';
import useFetch from '../hooks/useFetch.js';
import useFormat from '../hooks/useFormat.js';
import { createCustomer, getCustomers } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useSystem } from '../context/SystemContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { isValidEmail } from '../utils/format.js';

export default function Customers() {
  const { t } = useLanguage();
  const fmt = useFormat();
  const toast = useToast();
  const { defaultCurrency } = useSystem();
  const { data, loading, error, reload } = useFetch(() => getCustomers(), []);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const e = {};
    if (!form.name.trim()) e.name = t('customers.err.name');
    if (form.email && !isValidEmail(form.email)) e.email = t('payments.err.email');
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await createCustomer({ name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null });
      toast.success(t('customers.added'));
      setOpen(false); setForm({ name: '', email: '', phone: '' });
      reload({ silent: true });
    } catch (x) { toast.error(x.message); } finally { setBusy(false); }
  };
  const list = (data || []).filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title={t('page.customers')} subtitle={t('page.customers.sub')} actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" />{t('customers.add')}</Button>} />
      <Card>
        <input className="input mb-4 sm:max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('customers.search')} aria-label={t('customers.search')} />
        {loading ? <SkeletonRows rows={5} /> : error ? <ErrorState error={error} onRetry={reload} /> : list.length === 0 ? (
          <EmptyState illustration="customers" title={t('customers.empty.title')} body={t('customers.empty.body')}><LoadDemoButton onDone={reload} /></EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {list.map((c) => (
              <li key={c.id}><Link to={`/app/customers/${c.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-ink-50/60">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{c.name} {c.is_demo && <DemoBadge />}</p><p className="truncate text-xs text-ink-500">{c.email || '—'}</p></div>
                <div className="text-right"><p className="text-sm font-semibold">{fmt.money(c.total_paid, defaultCurrency)}</p><p className="text-xs text-ink-500">{t('dash.paymentsCount', { n: c.payment_count })}</p></div>
              </Link></li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title={t('customers.add')} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save} loading={busy}>{t('common.save')}</Button></>}>
        <div className="space-y-3">
          <Field label={t('common.name')} error={err.name}><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} /></Field>
          <Field label={t('common.email')} optional error={err.email}><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={t('common.phone')} optional><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={40} /></Field>
        </div>
      </Modal>
    </>
  );
}
