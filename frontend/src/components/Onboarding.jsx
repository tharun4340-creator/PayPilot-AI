import { useState } from 'react';
import Modal from './Modal.jsx';
import Button from './Button.jsx';
import LoadDemoButton from './LoadDemoButton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const open = Boolean(user) && !user.onboarding_completed;

  const finish = async () => {
    setBusy(true);
    try {
      await updateUser({ onboarding_completed: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={finish}
      title={t(`onboarding.${step}.title`)}
      hideClose
      footer={
        <>
          <Button variant="ghost" onClick={finish} disabled={busy}>{t('common.skip')}</Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>{t('common.next')}</Button>
          ) : (
            <Button onClick={finish} loading={busy}>{t('onboarding.start')}</Button>
          )}
        </>
      }
    >
      <p className="text-xs font-medium text-pilot-600">{t('onboarding.step', { n: step, total: 3 })}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{t(`onboarding.${step}.body`)}</p>
      {step === 3 && (
        <div className="mt-4">
          <LoadDemoButton label={t('onboarding.loadDemo')} variant="secondary" />
        </div>
      )}
    </Modal>
  );
}
