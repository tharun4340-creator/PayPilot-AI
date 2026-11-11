import { useLanguage } from '../context/LanguageContext.jsx';
import useFormat from '../hooks/useFormat.js';

/** Visual invoice. Works for both the live form (draft) and saved invoices. */
export default function InvoicePreview({ invoice }) {
  const { t } = useLanguage();
  const fmt = useFormat();
  const cur = invoice.currency;
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 text-sm">
      <div className="flex items-start justify-between">
        <div><p className="text-lg font-bold text-ink-950">{invoice.number || t('invoices.form.preview')}</p>{invoice.due_date && <p className="text-xs text-ink-500">{t('invoices.due')} {fmt.date(invoice.due_date)}</p>}</div>
        {invoice.is_demo && <span className="badge bg-amber-50 text-amber-700">{t('common.demoData')}</span>}
      </div>
      <p className="mt-4 text-xs text-ink-500">{t('invoices.detail.billedTo')}</p>
      <p className="font-medium">{invoice.customer_name || '—'}</p>
      {invoice.customer_email && <p className="text-xs text-ink-500">{invoice.customer_email}</p>}
      <table className="mt-4 w-full text-left text-xs">
        <thead><tr className="border-b border-ink-100 text-ink-500"><th className="py-1.5 font-medium">{t('common.description')}</th><th className="text-right font-medium">{t('invoices.form.quantity')}</th><th className="text-right font-medium">{t('common.amount')}</th></tr></thead>
        <tbody>{invoice.items.map((i, n) => <tr key={n} className="border-b border-ink-50"><td className="py-1.5">{i.description || '—'}</td><td className="text-right">{i.quantity}</td><td className="text-right">{fmt.money(i.amount, cur)}</td></tr>)}</tbody>
      </table>
      <dl className="ml-auto mt-3 w-48 space-y-1 text-xs">
        <div className="flex justify-between"><dt className="text-ink-500">{t('invoices.form.subtotal')}</dt><dd>{fmt.money(invoice.subtotal, cur)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-500">{t('invoices.form.taxAmount')} ({invoice.tax_rate || 0}%)</dt><dd>{fmt.money(invoice.tax_amount, cur)}</dd></div>
        <div className="flex justify-between border-t border-ink-200 pt-1 text-sm font-bold"><dt>{t('common.total')}</dt><dd>{fmt.money(invoice.total, cur)}</dd></div>
      </dl>
      {invoice.notes && <p className="mt-4 whitespace-pre-wrap border-t border-ink-100 pt-3 text-xs text-ink-600">{invoice.notes}</p>}
    </div>
  );
}
