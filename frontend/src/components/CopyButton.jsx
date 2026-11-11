import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';
import Button from './Button.jsx';

export default function CopyButton({ text, label, variant = 'secondary', size = 'sm' }) {
  const { t } = useLanguage();
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers without the async clipboard API.
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      area.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1800);
  }

  return (
    <Button variant={variant} size={size} onClick={copy}>
      {done ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {done ? t('common.copied') : label || t('common.copy')}
    </Button>
  );
}
