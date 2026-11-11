import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api.js';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const list = await api.getNotifications();
      setItems(Array.isArray(list) ? list : []);
    } catch {
      /* the bell simply stays as it was */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, 60000);
    return () => clearInterval(timer);
  }, [reload]);

  const markRead = useCallback(async (id) => {
    await api.markNotificationRead(id);
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(async () => {
    await api.markAllNotificationsRead();
    setItems((list) => list.map((n) => ({ ...n, read: true })));
  }, []);

  const value = useMemo(
    () => ({ items, loading, unread: items.filter((n) => !n.read).length, reload, markRead, markAllRead }),
    [items, loading, reload, markRead, markAllRead],
  );
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
