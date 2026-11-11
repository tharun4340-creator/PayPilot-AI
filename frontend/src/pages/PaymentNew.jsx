import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Sparkles } from 'lucide-react';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import Field from '../components/Field.jsx';
import Button from '../components/Button.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import CopyButton from '../components/CopyButton.jsx';
import Badge from '../components/Badge.jsx';
import { checkPaymentSafety, createPayment, suggestDescription } from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useSystem } from '../context/SystemContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useFormat from '../hooks/useFormat.js';
import { isValidEmail, newIdempotencyKey } from '../utils/format.js';

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP'];

export default function PaymentNew() {
  const { t, lang } = useLanguage();
  const { mode, defaultCurrency } = useSystem();
  const toast = useToast();
  const fmt = useFormat();
  const [form, setForm] = useState({ customer_name: '', customer_email: '', amount: '', currency: defaultCurrency, description: '' });
  const [errors, setErrors] = useState({});
  const [checking, setChecking] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [created, setCreated] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const key = useRef(newIdempotencyKey());
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const demo = mode === 'demo';

  const review = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.customer_name.trim()) errs.customer_name = t('payments.err.name');
    if (form.customer_email && !isValidEmail(form.customer_email)) errs.customer_email = t('payments.err.email');
    if (!(Number(form.amount) > 0)) errs.amount = t('payments.err.amount');
    if (!form.description.trim()) errs.description = t('payments.err.description');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setChecking(true);
    try {
      const res = await checkPaymentSafety({ customer_name: form.customer_name.trim(), amount: Number(form.amount), currency: form.currency });
      setWarnings(res.warnings || []);
    } catch {
      setWarnings([]);
    } finally {
      setChecking(false);
    }
    key.current = newIdempotencyKey();
    setDialogError('');
    setConfirmOpen(true);
  };

  const create = async () => {
    setCreating(true);
    setDialogError('');
    try {
      const res = await createPayment({
        customer_name: form.customer_name.trim(), customer_email: form.customer_email.trim() || null, amount: Number(form.amount),
        currency: form.currency, description: form.description.trim(), confirm: true, idempotency_key: key.current,
      });
      setCreated(res);
      setConfirmOpen(false);
      toast.success(t('payments.created.title'));
    } catch (err) {
      setDialogError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const suggest = async () => {
    if (!form.description.trim()) return;
    try {
      setSuggestions((await suggestDescription({ text: form.description, language: lang })).suggestions);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (created) {
    return (
      <>
        <PageHeader title={t('payments.created.title')} />
        <Card className="max-w-xl space-y-3">
          <p className="text-lg font-semibold">{fmt.money(created.amount, created.currency)} · {created.customer_name}</p>
          {created.is_demo ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t('payments.created.demo')}</p> : (
            <>
              <p className="text-sm text-ink-600">{t('payments.created.share')}</p>
              <p className="break-all rounded-lg bg-ink-50 p-3 text-xs">{created.approval_url}</p>
              <div className="flex flex-wrap gap-2">
                <a className="btn btn-primary btn-sm" href={created.approval_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" aria-hidden="true" />{t('payments.openLink')}</a>
                <CopyButton text={created.approval_url} label={t('payments.copyLink')} />
              </div>
            </>
          )}
          {created.warnings?.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-700">{created.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          <div className="flex gap-2 pt-2">
            <Link to={`/app/payments/${created.id}`} className="btn btn-secondary btn-sm">{t('payments.created.view')}</Link>
            <Button size="sm" variant="ghost" onClick={() => { setCreated(null); setForm({ ...form, customer_name: '', amount: '', description: '' }); }}>{t('payments.created.another')}</Button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('page.paymentNew')} subtitle={t('page.paymentNew.sub')} back="/app/payments" />
      <form onSubmit={review} noValidate className="card max-w-xl space-y-4 p-5">
        {demo && <Badge tone="warning">{t('banner.demo')}</Badge>}
        <Field label={t('payments.form.customerName')} error={errors.customer_name}><input className="input" value={form.customer_name} onChange={set('customer_name')} maxLength={120} /></Field>
        <Field label={t('payments.form.customerEmail')} optional error={errors.customer_email}><input className="input" type="email" value={form.customer_email} onChange={set('customer_email')} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('payments.form.amount')} error={errors.amount} className="col-span-2"><input className="input" inputMode="decimal" type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} /></Field>
          <Field label={t('common.currency')}><select className="input" value={form.currency} onChange={set('currency')}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <Field label={t('payments.form.description')} error={errors.description}><input className="input" value={form.description} onChange={set('description')} maxLength={240} /></Field>
        <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-pilot-600" onClick={suggest}><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{t('payments.form.suggest')}</button>
        {suggestions.length > 0 && (
          <div><p className="text-xs text-ink-500">{t('payments.form.suggestions')}</p>
            <div className="mt-1 flex flex-wrap gap-2">{suggestions.map((s) => <button key={s} type="button" className="rounded-full border border-ink-200 px-3 py-1 text-xs hover:bg-ink-50" onClick={() => { setForm({ ...form, description: s }); setSuggestions([]); }}>{s}</button>)}</div></div>
        )}
        <Button type="submit" loading={checking} className="w-full">{checking ? t('payments.form.checking') : t('payments.form.review')}</Button>
      </form>
      <ConfirmDialog open={confirmOpen} title={demo ? t('payments.confirm.titleDemo') : t('payments.confirm.title')} confirmLabel={t('payments.confirm.action')}
        onConfirm={create} onCancel={() => setConfirmOpen(false)} loading={creating} error={dialogError}>
        <p className="text-sm text-ink-600">{demo ? t('payments.confirm.bodyDemo') : t('payments.confirm.body')}</p>
        <p className="mt-3 font-semibold">{fmt.money(Number(form.amount), form.currency)} · {form.customer_name}</p>
        <p className="text-sm text-ink-500">{form.description}</p>
        {warnings.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800"><p className="font-semibold">{t('payments.safety.title')}</p>
            <ul className="mt-1 list-disc pl-4">{warnings.map((w) => <li key={w.type}>{w.title}: {w.explanation}</li>)}</ul>
            <p className="mt-1">{t('payments.safety.note')}</p></div>
        )}
      </ConfirmDialog>
    </>
  );
}
