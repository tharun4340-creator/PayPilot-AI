import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import Card from '../components/Card.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function PaymentCancelled() {
  const { t } = useLanguage();
  return (
    <>
      <PageHeader title={t('page.cancelled')} />
      <Card className="max-w-xl space-y-4">
        <p className="text-sm text-ink-600">{t('payments.cancelled.body')}</p>
        <Link to="/app/payments" className="btn btn-primary">{t('payments.cancelled.cta')}</Link>
      </Card>
    </>
  );
}
