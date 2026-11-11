import { Loader2 } from 'lucide-react';

export default function Spinner({ label, className = '' }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2 py-8 text-sm text-ink-400 ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      {label && <span>{label}</span>}
    </div>
  );
}
