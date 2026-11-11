import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Download, ExternalLink } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ErrorState from '../components/ErrorState.jsx';
import InvoicePreview from '../components/InvoicePreview.jsx';
import DemoBadge from '../components/DemoBadge.jsx';
import { StatusBadge } from '../components/Badge.jsx';
import { SkeletonRows } from '../components/Skeleton.jsx';
import useFetch from '../hooks/useFetch.js';
import { downloadInvoicePdf, getInvoice, payInvoice, sendInvoice, updateInvoice } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useSystem } from '../context/SystemContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { newIdempotencyKey } from '../utils/format.js';

export default function InvoiceDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { t } = useLanguage();
  const { mode } = useSystem();
  const toast = useToast();
  const { data: inv, loading, error, reload } = useFetch(() => getInvoice(id), [id]);
  const [dialog, setDialog] = useState(null); // 'pay' | 'send' | 'cancel'
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');

  if (loading) return <SkeletonRows rows={6} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const warnings = [...(location.state?.warnings || []), ...(inv.warnings || [])];
  const open = inv.status === 'UNPAID' || inv.status === 'OVERDUE';

  const pdf = async () => {
    try { await downloadInvoicePdf(inv.id, `${inv.number}.pdf`); toast.success(t('invoices.detail.pdfDone')); } catch (err) { toast.error(err.message); }
  };
  const run = async (fn, okMsg) => {
    setBusy(true); setDialogError('');
    try { await fn(); setDialog(null); toast.success(okMsg); await reload({ silent: true }); } catch (err) { setDialogError(err.message); } finally { setBusy(false); }
  };
  const actions = {
    pay: () => run(async () => { await payInvoice(inv.id, { confirm: true, idempotency_key: newIdempotencyKey() }); }, t('invoices.detail.paymentCreated')),
    send: () => run(() => sendInvoice(inv.id, { confirm: true }), t('invoices.detail.send')),
    cancel: () => run(() => updateInvoice(inv.id, { status: 'CANCELLED' }), t('status.CANCELLED')),
  };
  const dialogs = {
    pay: [t('invoices.detail.payTitle'), mode === 'demo' ? t('invoices.detail.payBodyDemo') : t('invoices.detail.payBody'), t('invoices.detail.pay')],
    send: [t('invoices.detail.sendTitle'), t('invoices.detail.sendBody'), t('invoices.detail.send')],
    cancel: [t('invoices.detail.cancelTitle'), t('invoices.detail.cancelBody'), t('invoices.detail.cancel')],
  };

  return (
    <>
      <PageHeader title={`${t('page.invoiceDetail')} ${inv.number}`} back="/app/invoices" actions={<><StatusBadge status={inv.status} />{inv.is_demo && <DemoBadge />}</>} />
      {warnings.length > 0 && <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"><p className="font-semibold">{t('invoices.detail.warnings')}</p><ul className="mt-1 list-disc pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><InvoicePreview invoice={inv} /></div>
        <Card className="h-fit space-y-2">
          <Button variant="secondary" className="w-full" onClick={pdf}><Download className="h-4 w-4" aria-hidden="true" />{t('invoices.detail.pdf')}</Button>
          {open && <Button className="w-full" onClick={() => { setDialogError(''); setDialog('pay'); }}>{t('invoices.detail.pay')}</Button>}
          {inv.status === 'DRAFT' && inv.paypal_invoice_id && <Button className="w-full" onClick={() => { setDialogError(''); setDialog('send'); }}>{t('invoices.detail.send')}</Button>}
          {inv.paypal_invoice_id && <p className="text-xs text-ink-500">{t('invoices.detail.paypalInvoice')}: {inv.paypal_invoice_id} ({inv.paypal_invoice_status})</p>}
          {inv.paypal_invoice_url && <a className="btn btn-secondary btn-sm w-full" href={inv.paypal_invoice_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />{t('invoices.detail.openPaypal')}</a>}
          {inv.payment_id && <Link className="btn btn-secondary btn-sm w-full" to={`/app/payments/${inv.payment_id}`}>{t('payments.detail.invoice')} → #{inv.payment_id} ({inv.payment_status})</Link>}
          {(open || inv.status === 'DRAFT') && <Button variant="danger" className="w-full" onClick={() => { setDialogError(''); setDialog('cancel'); }}>{t('invoices.detail.cancel')}</Button>}
          {inv.status === 'CANCELLED' && <Button variant="secondary" className="w-full" onClick={() => run(() => updateInvoice(inv.id, { status: 'UNPAID' }), t('status.UNPAID'))} loading={busy}>{t('invoices.detail.reopen')}</Button>}
        </Card>
      </div>
      {dialog && (
        <ConfirmDialog open title={dialogs[dialog][0]} confirmLabel={dialogs[dialog][2]} cancelLabel={dialog === 'cancel' ? t('invoices.detail.cancelKeep') : undefined}
          danger={dialog === 'cancel'} onConfirm={actions[dialog]} onCancel={() => setDialog(null)} loading={busy} error={dialogError}>
          <p className="text-sm text-ink-600">{dialogs[dialog][1]}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
