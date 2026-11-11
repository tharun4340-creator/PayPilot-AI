import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translate, LANGUAGES } from '../i18n/index.js';
import { getToken, updateMe } from '../services/api.js';

const LANG_KEY = 'paypilot_lang';
const LanguageContext = createContext(null);

function readInitialLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored && LANGUAGES.some((l) => l.code === stored)) return stored;
  } catch {
    /* ignore */
  }
  return 'en';
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // sync=false is used when the language comes from the server (no need to send it back).
  const setLanguage = useCallback((code, { sync = true } = {}) => {
    if (!LANGUAGES.some((l) => l.code === code)) return;
    setLangState(code);
    try {
      localStorage.setItem(LANG_KEY, code);
    } catch {
      /* ignore */
    }
    if (sync && getToken()) {
      updateMe({ language: code }).catch(() => {
        /* the choice is still saved locally */
      });
    }
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(() => ({ lang, setLanguage, t }), [lang, setLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
