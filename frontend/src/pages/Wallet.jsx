import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowDownLeft, ArrowUpRight, Banknote, Check, CircleAlert, LockKeyhole, QrCode, ShieldCheck, Smartphone, WalletCards } from 'lucide-react';
import Button from '../components/Button.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import Field from '../components/Field.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const VPA_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/;

function makeUpiLink({ vpa, name, amount, note }) {
  const params = new URLSearchParams({ pa: vpa.trim(), cu: 'INR' });
  if (name.trim()) params.set('pn', name.trim());
  if (amount) params.set('am', Number(amount).toFixed(2));
  if (note.trim()) params.set('tn', note.trim());
  return `upi://pay?${params.toString()}`;
}

export default function Wallet() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ vpa: '', name: '', amount: '', note: '' });
  const [payment, setPayment] = useState(null);
  const [errors, setErrors] = useState({});
  const upiLink = useMemo(() => payment && makeUpiLink(payment), [payment]);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setPayment(null);
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const prepare = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!VPA_PATTERN.test(form.vpa.trim())) nextErrors.vpa = t('wallet.error.vpa');
    if (form.amount && (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0)) nextErrors.amount = t('wallet.error.amount');
    setErrors(nextErrors);
    setPayment(null);
    if (Object.keys(nextErrors).length === 0) setPayment({ ...form, vpa: form.vpa.trim() });
  };

  return (
    <>
      <PageHeader title={t('wallet.title')} subtitle={t('wallet.subtitle')} />

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#21483c] to-[#356652] p-5 text-white shadow-card sm:p-7">
        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-100"><WalletCards className="h-3.5 w-3.5" aria-hidden="true" />{t('wallet.hero.label')}</span>
              <span className="rounded-full bg-amber-300/15 px-3 py-1 text-[11px] font-semibold text-amber-100">{t('wallet.hero.unlinked')}</span>
            </div>
            <p className="mt-7 text-xs font-medium uppercase tracking-[0.18em] text-white/55">{t('wallet.hero.balance')}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{t('wallet.hero.unavailable')}</p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">{t('wallet.hero.body')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
              <ArrowUpRight className="h-5 w-5 text-emerald-200" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">{t('wallet.hero.pay')}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/55">{t('wallet.hero.payNote')}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
              <ArrowDownLeft className="h-5 w-5 text-sky-200" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">{t('wallet.hero.receive')}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/55">{t('wallet.hero.receiveNote')}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardTitle>
            <span className="flex items-center gap-2"><Banknote className="h-4 w-4 text-pilot-600" aria-hidden="true" />{t('wallet.upi.title')}</span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">{t('wallet.upi.badge')}</span>
          </CardTitle>
          <p className="mb-5 text-sm leading-relaxed text-ink-600">{t('wallet.upi.body')}</p>

          <form onSubmit={prepare} className="space-y-4">
            <Field label={t('wallet.upi.vpa')} hint={t('wallet.upi.vpaHint')} error={errors.vpa}>
              <input className="input" value={form.vpa} onChange={update('vpa')} placeholder="name@bank" autoComplete="off" maxLength={320} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('wallet.upi.name')} optional={t('common.optional')}>
                <input className="input" value={form.name} onChange={update('name')} placeholder={t('wallet.upi.namePlaceholder')} maxLength={80} />
              </Field>
              <Field label={t('wallet.upi.amount')} optional={t('common.optional')} error={errors.amount}>
                <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">₹</span><input className="input pl-8" type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount} onChange={update('amount')} placeholder="0.00" /></div>
              </Field>
            </div>
            <Field label={t('wallet.upi.note')} optional={t('common.optional')}>
              <input className="input" value={form.note} onChange={update('note')} placeholder={t('wallet.upi.notePlaceholder')} maxLength={80} />
            </Field>
            <Button type="submit" className="w-full sm:w-auto"><QrCode className="h-4 w-4" aria-hidden="true" />{t('wallet.upi.create')}</Button>
          </form>

          {payment && upiLink && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5" aria-live="polite">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Check className="h-5 w-5" aria-hidden="true" /></span>
                <div><h3 className="font-semibold text-emerald-950">{t('wallet.upi.ready')}</h3><p className="mt-1 text-sm leading-relaxed text-emerald-900/80">{t('wallet.upi.readyBody')}</p></div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="space-y-2 rounded-xl bg-white/80 p-3 text-sm">
                  <p><span className="text-ink-500">{t('wallet.upi.to')}:</span> <strong className="break-all text-ink-900">{payment.name || payment.vpa}</strong></p>
                  {payment.name && <p><span className="text-ink-500">{t('wallet.upi.vpa')}:</span> <strong className="break-all text-ink-900">{payment.vpa}</strong></p>}
                  <p><span className="text-ink-500">{t('wallet.upi.amount')}:</span> <strong className="text-ink-900">{payment.amount ? `₹${Number(payment.amount).toFixed(2)}` : t('wallet.upi.anyAmount')}</strong></p>
                  {payment.note && <p className="break-words"><span className="text-ink-500">{t('wallet.upi.note')}:</span> <strong className="text-ink-900">{payment.note}</strong></p>}
                </div>
                <div className="mx-auto rounded-2xl border border-ink-100 bg-white p-3"><QRCodeSVG value={upiLink} size={156} level="M" includeMargin /></div>
              </div>
              <a href={upiLink} className="btn btn-primary mt-4 w-full justify-center sm:w-auto"><Smartphone className="h-4 w-4" aria-hidden="true" />{t('wallet.upi.openApp')}</a>
              <p className="mt-3 text-xs leading-relaxed text-emerald-950/70">{t('wallet.upi.verify')}</p>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" /><div><h2 className="font-semibold text-amber-950">{t('wallet.bank.title')}</h2><p className="mt-2 text-sm leading-relaxed text-amber-950/80">{t('wallet.bank.body')}</p></div></div>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200/70 bg-white/60 p-3.5"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" aria-hidden="true" /><p className="text-xs leading-relaxed text-amber-950/80">{t('wallet.bank.privacy')}</p></div>
          </section>

          <Card>
            <CardTitle>{t('wallet.other.title')}</CardTitle>
            <p className="text-sm leading-relaxed text-ink-600">{t('wallet.other.body')}</p>
            <Link to="/app/pay-seller" className="btn btn-secondary mt-4 w-full justify-center"><ArrowUpRight className="h-4 w-4" aria-hidden="true" />{t('wallet.other.action')}</Link>
          </Card>

          <div className="flex items-start gap-3 px-1 text-xs leading-relaxed text-ink-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-pilot-600" aria-hidden="true" /><p>{t('wallet.disclaimer')}</p></div>
        </div>
      </div>
    </>
  );
}
