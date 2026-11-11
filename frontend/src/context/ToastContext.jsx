import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, message) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((list) => [...list.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-md animate-fade-in items-start gap-3 rounded-xl border border-ink-100 bg-white p-3.5 shadow-pop"
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            )}
            <p className="flex-1 text-sm text-ink-800">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="rounded p-0.5 text-ink-400 hover:text-ink-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
