import { useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { formatDate, formatDateTime, formatMoney, formatMonth, formatNumber } from '../utils/format.js';

/** Formatting helpers bound to the selected language. */
export default function useFormat() {
  const { lang } = useLanguage();
  return useMemo(
    () => ({
      money: (amount, currency) => formatMoney(amount, currency, lang),
      number: (n) => formatNumber(n, lang),
      date: (v) => formatDate(v, lang),
      dateTime: (v) => formatDateTime(v, lang),
      month: (v) => formatMonth(v, lang),
    }),
    [lang],
  );
}
