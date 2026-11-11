import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import CopyButton from '../components/CopyButton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import Tooltip from '../components/Tooltip.jsx';
import DemoBadge from '../components/DemoBadge.jsx';
import { StatusBadge } from '../components/Badge.jsx';
import { SkeletonRows } from '../components/Skeleton.jsx';
import useFetch from '../hooks/useFetch.js';
import useFormat from '../hooks/useFormat.js';
import { capturePayment, getPayment, verifyPayment } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { newIdempotencyKey } from '../utils/format.js';

export default function PaymentDetail() {
  const { id } = useParams();
  const { t } = useLanguage();
  const fmt = useFormat();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => getPayment(id), [id]);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dialogError, setDialogError] = useState('');

  if (loading) return <SkeletonRows rows={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { payment: p, events, safety_warnings: warns } = data;

  const verify = async () => {
    setBusy(true);
    try { await verifyPayment(p.id); toast.success(t('payments.detail.verified')); await reload({ silent: true }); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const capture = async () => {
    setBusy(true); setDialogError('');
    try { await capturePayment(p.id, { confirm: true, idempotency_key: newIdempotencyKey() }); setConfirmOpen(false); toast.success(t('payments.detail.captured')); await reload({ silent: true }); }
    catch (err) { setDialogError(err.message); } finally { setBusy(false); }
  };
  const rows = [
    [t('common.customer'), p.customer_name], [t('common.amount'), fmt.money(p.amount, p.currency)], [t('common.description'), p.description],
    [t('payments.detail.source'), t(`payments.source.${p.source}`)], [t('common.created'), fmt.dateTime(p.created_at)],
    p.paypal_order_id && [t('payments.detail.paypalOrder'), p.paypal_order_id], p.paypal_capture_id && [t('payments.detail.capture'), p.paypal_capture_id],
    p.verified_at && [t('payments.detail.verifiedAt'), fmt.dateTime(p.verified_at)], p.completed_at && [t('payments.detail.completedAt'), fmt.dateTime(p.completed_at)],
    p.failure_reason && [t('payments.detail.failure'), p.failure_reason],
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={`${t('page.paymentDetail')} #${p.id}`} back="/app/payments" actions={<><StatusBadge status={p.status} />{p.is_demo && <DemoBadge />}</>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-2 text-sm">
            {rows.map(([k, v]) => <Fragment key={k}><dt className="text-ink-500">{k}</dt><dd className="break-all font-medium">{v}</dd></Fragment>)}
            {p.invoice_id && <><dt className="text-ink-500">{t('payments.detail.invoice')}</dt><dd><Link className="text-pilot-600" to={`/app/invoices/${p.invoice_id}`}>#{p.invoice_id}</Link></dd></>}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            {!p.is_demo && <Button variant="secondary" size="sm" onClick={verify} loading={busy}><RefreshCw className="h-4 w-4" aria-hidden="true" />{t('payments.detail.verify')}</Button>}
            {!p.is_demo && p.status === 'APPROVED' && <Button size="sm" onClick={() => { setDialogError(''); setConfirmOpen(true); }}><Tooltip text={t('tip.capture')}><span>{t('payments.detail.capture.btn')}</span></Tooltip></Button>}
            {p.status === 'CREATED' && p.approval_url && <>
              <a className="btn btn-secondary btn-sm" href={p.approval_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />{t('payments.openLink')}</a>
              <CopyButton text={p.approval_url} label={t('payments.copyLink')} /></>}
          </div>
        </Card>
        <div className="space-y-4">
          {warns.length > 0 && <Card><CardTitle>{t('payments.detail.warnings')}</CardTitle><ul className="mt-2 list-disc pl-4 text-xs text-amber-700">{warns.map((w) => <li key={w}>{w}</li>)}</ul></Card>}
          <Card>
            <CardTitle>{t('payments.detail.events')}</CardTitle>
            <ol className="mt-3 space-y-3 border-l border-ink-100 pl-4">
              {events.map((e, i) => <li key={i} className="relative text-xs text-ink-600"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-pilot-500" aria-hidden="true" /><p>{e.message}</p><p className="text-[11px] text-ink-400">{fmt.dateTime(e.time)}</p></li>)}
            </ol>
          </Card>
        </div>
      </div>
      <ConfirmDialog open={confirmOpen} title={t('payments.detail.captureTitle')} confirmLabel={t('payments.detail.captureAction')} onConfirm={capture} onCancel={() => setConfirmOpen(false)} loading={busy} error={dialogError}>
        <p className="text-sm text-ink-600">{t('payments.detail.captureBody')}</p>
        <p className="mt-2 font-semibold">{fmt.money(p.amount, p.currency)} · {p.customer_name}</p>
      </ConfirmDialog>
    </>
  );
}
