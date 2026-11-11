import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import Field from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import InvoicePreview from '../components/InvoicePreview.jsx';
import { checkInvoiceDuplicate, createInvoice, suggestDescription } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useSystem } from '../context/SystemContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { isValidEmail, todayPlusDays } from '../utils/format.js';

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP'];
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function InvoiceNew() {
  const { t, lang } = useLanguage();
  const { defaultCurrency, mode } = useSystem();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({ customer_name: '', customer_email: '', tax_rate: '0', due_date: todayPlusDays(14), currency: defaultCurrency, notes: '', create_paypal_invoice: false });
  const [items, setItems] = useState([{ description: '', quantity: '1', unit_price: '' }]);
  const [errors, setErrors] = useState({});
  const [dup, setDup] = useState([]);
  const [sugg, setSugg] = useState({ idx: null, list: [] });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setItem = (i, k, v) => setItems(items.map((it, n) => (n === i ? { ...it, [k]: v } : it)));

  const calc = items.map((i) => ({ ...i, amount: round2((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)) }));
  const subtotal = round2(calc.reduce((s, i) => s + i.amount, 0));
  const taxAmount = round2((subtotal * (Number(f.tax_rate) || 0)) / 100);
  const total = round2(subtotal + taxAmount);

  const checkDup = async () => {
    if (!f.customer_name.trim() || total <= 0) return setDup([]);
    try { setDup((await checkInvoiceDuplicate({ customer_name: f.customer_name.trim(), total })).duplicates); } catch { setDup([]); }
  };
  const suggest = async (i) => {
    if (!items[i].description.trim()) return;
    try { setSugg({ idx: i, list: (await suggestDescription({ text: items[i].description, language: lang })).suggestions }); } catch (err) { toast.error(err.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!f.customer_name.trim()) errs.customer_name = t('invoices.err.name');
    if (f.customer_email && !isValidEmail(f.customer_email)) errs.customer_email = t('invoices.err.email');
    if (!items.length || items.some((i) => !i.description.trim() || !(Number(i.quantity) > 0) || !(Number(i.unit_price) >= 0) || i.unit_price === '')) errs.items = t('invoices.err.items');
    if (!f.due_date) errs.due = t('invoices.err.due');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const inv = await createInvoice({
        customer_name: f.customer_name.trim(), customer_email: f.customer_email.trim() || null, tax_rate: Number(f.tax_rate) || 0, due_date: f.due_date,
        currency: f.currency, notes: f.notes.trim() || null, create_paypal_invoice: f.create_paypal_invoice,
        items: items.map((i) => ({ description: i.description.trim(), quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
      });
      toast.success(t('invoices.new'));
      navigate(`/app/invoices/${inv.id}`, { state: { warnings: inv.warnings } });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title={t('page.invoiceNew')} subtitle={t('page.invoiceNew.sub')} back="/app/invoices" />
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={submit} noValidate className="card space-y-4 p-5">
          <Field label={t('invoices.form.customerName')} error={errors.customer_name}><input className="input" value={f.customer_name} onChange={set('customer_name')} onBlur={checkDup} maxLength={120} /></Field>
          <Field label={t('invoices.form.customerEmail')} optional error={errors.customer_email}><input className="input" type="email" value={f.customer_email} onChange={set('customer_email')} /></Field>
          <fieldset className="space-y-3">
            <legend className="label">{t('invoices.form.items')}</legend>
            {items.map((it, i) => (
              <div key={i} className="rounded-xl border border-ink-100 p-3">
                <input className="input" aria-label={t('invoices.form.itemDescription')} placeholder={t('invoices.form.itemDescription')} value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} maxLength={240} />
                <div className="mt-2 grid grid-cols-[1fr,1fr,auto] items-end gap-2">
                  <label className="text-xs text-ink-500">{t('invoices.form.quantity')}<input className="input mt-1" type="number" min="0.01" step="0.01" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} onBlur={checkDup} /></label>
                  <label className="text-xs text-ink-500">{t('invoices.form.unitPrice')}<input className="input mt-1" type="number" min="0" step="0.01" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} onBlur={checkDup} /></label>
                  <button type="button" className="btn-ghost p-2" aria-label={t('invoices.form.removeItem')} disabled={items.length === 1} onClick={() => setItems(items.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </div>
                <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-pilot-600" onClick={() => suggest(i)}><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{t('invoices.form.suggest')}</button>
                {sugg.idx === i && sugg.list.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{sugg.list.map((s) => <button key={s} type="button" className="rounded-full border border-ink-200 px-3 py-1 text-xs hover:bg-ink-50" onClick={() => { setItem(i, 'description', s); setSugg({ idx: null, list: [] }); }}>{s}</button>)}</div>}
              </div>
            ))}
            {errors.items && <p className="field-error">{errors.items}</p>}
            <Button variant="secondary" size="sm" onClick={() => setItems([...items, { description: '', quantity: '1', unit_price: '' }])}><Plus className="h-4 w-4" aria-hidden="true" />{t('invoices.form.addItem')}</Button>
          </fieldset>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('invoices.form.tax')}><input className="input" type="number" min="0" max="100" step="0.01" value={f.tax_rate} onChange={set('tax_rate')} /></Field>
            <Field label={t('common.currency')}><select className="input" value={f.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label={t('invoices.form.dueDate')} error={errors.due}><input className="input" type="date" value={f.due_date} onChange={set('due_date')} /></Field>
          </div>
          <Field label={t('invoices.form.notes')} optional><textarea className="input min-h-20" value={f.notes} onChange={set('notes')} maxLength={2000} /></Field>
          <label className="flex items-start gap-2 text-sm text-ink-700"><input type="checkbox" className="mt-1" checked={f.create_paypal_invoice} onChange={(e) => setF({ ...f, create_paypal_invoice: e.target.checked })} />{t('invoices.form.paypalDraft')}{mode === 'demo' && <span className="text-xs text-amber-700"> ({t('banner.demo')})</span>}</label>
          {dup.length > 0 && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{t('invoices.form.duplicate', { number: dup[0].number })}</p>}
          <Button type="submit" loading={busy} className="w-full">{t('invoices.form.create')}</Button>
        </form>
        <Card className="h-fit lg:sticky lg:top-20">
          <CardTitle>{t('invoices.form.preview')}</CardTitle>
          <div className="mt-3"><InvoicePreview invoice={{ customer_name: f.customer_name, customer_email: f.customer_email, due_date: f.due_date, currency: f.currency, tax_rate: f.tax_rate, subtotal, tax_amount: taxAmount, total, notes: f.notes, items: calc }} /></div>
        </Card>
      </div>
    </>
  );
}
