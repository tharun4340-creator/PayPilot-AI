import { useCallback, useEffect, useRef, useState } from 'react';
import { SPEECH_LANGS } from '../utils/format.js';

export function getSpeechRecognitionClass() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/**
 * Browser speech-to-text (Web Speech API). Not available in every browser (e.g. Firefox).
 * onFinal(text) is called once with the final transcript when listening ends.
 */
export default function useSpeechRecognition({ language = 'en', onFinal } = {}) {
  const Recognition = getSpeechRecognitionClass();
  const supported = Boolean(Recognition);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef(null);
  const finalRef = useRef('');
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(
    () => () => {
      if (recRef.current) {
        try {
          recRef.current.abort();
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  const start = useCallback(() => {
    const Rec = getSpeechRecognitionClass();
    if (!Rec) return;
    setError('');
    setInterim('');
    finalRef.current = '';
    const rec = new Rec();
    rec.lang = SPEECH_LANGS[language] || 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      finalRef.current = finalText;
      setInterim(finalText || interimText);
    };
    rec.onerror = (event) => {
      setError(event.error || 'error');
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      const text = (finalRef.current || '').trim();
      setInterim('');
      if (text && onFinalRef.current) onFinalRef.current(text);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [language]);

  const stop = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  return { supported, listening, interim, error, start, stop };
}
