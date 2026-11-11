import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationsContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import useFormat from '../hooks/useFormat.js';

export default function NotificationsPanel() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const { t } = useLanguage();
  const fmt = useFormat();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn-ghost relative p-2" aria-label={t('nav.notifications')} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pilot-600 px-1 text-[10px] font-bold text-white">{unread}</span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-80 max-w-[90vw] p-0 shadow-xl">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="text-sm font-semibold">{t('notif.title')}</h2>
            {unread > 0 && <button type="button" className="text-xs font-medium text-pilot-600" onClick={markAllRead}>{t('reports.markAll')}</button>}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-500">{t('notif.empty')}</li>}
            {items.map((n) => (
              <li key={n.id} className={`border-b border-ink-50 px-4 py-3 ${n.read ? '' : 'bg-pilot-50/50'}`}>
                <p className="text-sm font-medium text-ink-900">{n.title}</p>
                <p className="mt-0.5 text-xs text-ink-600">{n.body}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-ink-400">{fmt.dateTime(n.created_at)}</span>
                  {!n.read && <button type="button" className="text-[11px] font-medium text-pilot-600" onClick={() => markRead(n.id)}>{t('reports.markRead')}</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
