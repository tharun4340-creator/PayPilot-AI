import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Spinner from '../components/Spinner.jsx';
import { StatusBadge } from '../components/Badge.jsx';
import useFetch from '../hooks/useFetch.js';
import useFormat from '../hooks/useFormat.js';
import { capturePayment, getPaymentByOrder } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { newIdempotencyKey } from '../utils/format.js';

export default function PaymentReturn() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { t } = useLanguage();
  const fmt = useFormat();
  const toast = useToast();
  const { data: p, setData, loading, error, reload } = useFetch(() => (token ? getPaymentByOrder(token) : Promise.resolve(null)), [token]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');

  if (!token) return <><PageHeader title={t('page.return')} /><Card><p className="text-sm">{t('payments.return.noToken')}</p></Card></>;
  if (loading) return <Spinner label={t('payments.return.checking')} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const capture = async () => {
    setBusy(true); setDialogError('');
    try { setData(await capturePayment(p.id, { confirm: true, idempotency_key: newIdempotencyKey() })); setOpen(false); toast.success(t('payments.detail.captured')); }
    catch (err) { setDialogError(err.message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title={t('page.return')} />
      <Card className="max-w-xl space-y-3">
        <p className="text-sm text-ink-500">{t('payments.return.status')}</p>
        <div className="flex items-center gap-2"><StatusBadge status={p.status} /><span className="text-sm text-ink-700">{t(`payments.return.${p.status}`)}</span></div>
        <p className="text-lg font-semibold">{fmt.money(p.amount, p.currency)} · {p.customer_name}</p>
        <div className="flex gap-2 pt-1">
          {p.status === 'APPROVED' && <Button onClick={() => { setDialogError(''); setOpen(true); }}>{t('payments.return.capture')}</Button>}
          <Link to={`/app/payments/${p.id}`} className="btn btn-secondary">{t('payments.created.view')}</Link>
        </div>
      </Card>
      <ConfirmDialog open={open} title={t('payments.detail.captureTitle')} confirmLabel={t('payments.detail.captureAction')} onConfirm={capture} onCancel={() => setOpen(false)} loading={busy} error={dialogError}>
        <p className="text-sm text-ink-600">{t('payments.detail.captureBody')}</p>
      </ConfirmDialog>
    </>
  );
}
