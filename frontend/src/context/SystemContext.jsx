import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSystemStatus } from '../services/api.js';

const SystemContext = createContext(null);

export function SystemProvider({ children }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setStatus(await getSystemStatus());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(
    () => ({
      status,
      loading,
      reload,
      mode: status ? status.mode : null, // 'demo' | 'sandbox' | 'live' | null (unknown)
      llmConfigured: Boolean(status && status.llm_configured),
      defaultCurrency: (status && status.default_currency) || 'USD',
    }),
    [status, loading, reload],
  );
  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
}

export function useSystem() {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error('useSystem must be used inside SystemProvider');
  return ctx;
}
