import en from './en.js';
import ta from './ta.js';
import hi from './hi.js';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
];

export const dictionaries = { en, ta, hi };

/** Translate a key. Falls back to English, then to the key itself. Supports {var} placeholders. */
export function translate(lang, key, vars) {
  const dict = dictionaries[lang] || en;
  let text = dict[key];
  if (text === undefined) text = en[key];
  if (text === undefined) return key;
  if (vars) {
    text = text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? String(vars[name]) : match));
  }
  return text;
}
