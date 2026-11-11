import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api.js';
import { useLanguage } from './LanguageContext.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { setLanguage } = useLanguage();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(api.getToken()));

  const adoptUser = useCallback(
    (u) => {
      setUser(u);
      if (u && u.language) setLanguage(u.language, { sync: false });
    },
    [setLanguage],
  );

  // Any 401 from the API logs the user out; ProtectedRoute then redirects to /login.
  useEffect(() => {
    api.setUnauthorizedHandler(() => setUser(null));
    return () => api.setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!api.getToken()) {
      setLoading(false);
      return undefined;
    }
    api
      .getMe()
      .then((u) => {
        if (!cancelled) adoptUser(u);
      })
      .catch((err) => {
        // 401 is handled globally. For network errors keep the token but show logged-out state.
        if (!cancelled && err.status === 401) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email, password) => {
      const res = await api.login({ email, password });
      api.setToken(res.access_token);
      adoptUser(res.user);
      return res.user;
    },
    [adoptUser],
  );

  const signup = useCallback(
    async ({ email, password, full_name }) => {
      const res = await api.register({ email, password, full_name });
      api.setToken(res.access_token);
      adoptUser(res.user);
      return res.user;
    },
    [adoptUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* even if the server call fails, sign out locally */
    }
    api.clearToken();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const u = await api.getMe();
    adoptUser(u);
    return u;
  }, [adoptUser]);

  const updateUser = useCallback(
    async (patch) => {
      const u = await api.updateMe(patch);
      setUser(u);
      return u;
    },
    [],
  );

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: Boolean(user), login, signup, logout, refresh, updateUser }),
    [user, loading, login, signup, logout, refresh, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
