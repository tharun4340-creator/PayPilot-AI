import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.jsx';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, children, footer, size = 'md', sheet = false, hideClose = false }) {
  const { t } = useLanguage();
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const node = ref.current;
    const first = node && node.querySelector(FOCUSABLE);
    (first || node)?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && node) {
        const items = Array.from(node.querySelectorAll(FOCUSABLE));
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (previous && previous.focus) previous.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const width = size === 'lg' ? 'sm:max-w-2xl' : size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-lg';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink-950/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-pop animate-sheet-up sm:rounded-2xl sm:p-6 ${width} ${sheet ? 'pb-8' : ''}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          {title ? (
            <h2 id={titleId} className="text-lg font-semibold text-ink-950">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}
