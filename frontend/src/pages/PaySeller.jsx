import { useState } from 'react';
import { ArrowUpRight, ExternalLink, Link2, LockKeyhole, ShieldCheck } from 'lucide-react';
import Button from '../components/Button.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import Field from '../components/Field.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { validatePayPalPaymentLink } from '../utils/paypalPaymentLink.js';

export default function PaySeller() {
  const { t } = useLanguage();
  const [paymentLink, setPaymentLink] = useState('');
  const [reviewLink, setReviewLink] = useState(null);
  const [error, setError] = useState('');

  const review = (event) => {
    event.preventDefault();
    const result = validatePayPalPaymentLink(paymentLink);
    if (result.error) {
      setReviewLink(null);
      setError(t(`paySeller.error.${result.error}`));
      return;
    }
    setError('');
    setReviewLink(result);
  };

  const editLink = () => {
    setReviewLink(null);
    setError('');
  };

  return (
    <>
      <PageHeader title={t('page.paySeller')} subtitle={t('page.paySeller.sub')} />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardTitle>
            <span className="flex items-center gap-2"><Link2 className="h-4 w-4 text-pilot-600" aria-hidden="true" />{t('paySeller.form.title')}</span>
          </CardTitle>
          <p className="mb-4 text-sm leading-relaxed text-ink-600">{t('paySeller.form.body')}</p>

          {!reviewLink ? (
            <form onSubmit={review} className="space-y-4">
              <Field label={t('paySeller.form.label')} hint={t('paySeller.form.hint')} error={error}>
                <input
                  className="input"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://www.paypal.com/invoice/..."
                  value={paymentLink}
                  onChange={(event) => { setPaymentLink(event.target.value); setError(''); }}
                  required
                  maxLength={2000}
                />
              </Field>
              <Button type="submit" className="w-full sm:w-auto">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('paySeller.form.review')}
              </Button>
            </form>
          ) : (
            <div className="rounded-2xl border border-pilot-100 bg-pilot-50/70 p-4 sm:p-5">
              <p className="flex items-center gap-2 text-xs font-semibold text-pilot-700">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('paySeller.review.eyebrow')}
              </p>
              <h2 className="mt-3 text-lg font-semibold text-ink-950">{t('paySeller.review.title')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{t('paySeller.review.body')}</p>
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white bg-white/80 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pilot-100 text-pilot-700"><LockKeyhole className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="text-xs text-ink-500">{t('paySeller.review.destination')}</p>
                  <p className="truncate text-sm font-semibold text-ink-900">{reviewLink.host}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <a className="btn btn-primary w-full justify-center sm:w-auto" href={reviewLink.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />{t('paySeller.review.continue')}
                </a>
                <Button variant="secondary" onClick={editLink}>{t('paySeller.review.edit')}</Button>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-ink-500">{t('paySeller.review.reminder')}</p>
            </div>
          )}
        </Card>

        <section className="rounded-2xl bg-ink-950 p-5 text-white shadow-card lg:col-span-2 sm:p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-pilot-200"><ArrowUpRight className="h-5 w-5" aria-hidden="true" /></div>
          <h2 className="mt-4 text-lg font-semibold">{t('paySeller.safety.title')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{t('paySeller.safety.body')}</p>
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-white/70">{t('paySeller.safety.private')}</p>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-white/45">{t('paySeller.safety.separate')}</p>
        </section>
      </div>
    </>
  );
}
