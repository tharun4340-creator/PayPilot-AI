import { useState } from 'react';
import { Database } from 'lucide-react';
import Button from './Button.jsx';
import { seedDemoData } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function LoadDemoButton({ onDone, variant = 'secondary', label }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      await seedDemoData();
      toast.success(t('settings.demo.loaded'));
      if (onDone) await onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={variant} loading={busy} onClick={load}>
      {!busy && <Database className="h-4 w-4" aria-hidden="true" />}
      {label || t('settings.demo.load')}
    </Button>
  );
}
