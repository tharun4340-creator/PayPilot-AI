import { useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import useSpeechRecognition from '../hooks/useSpeechRecognition.js';
import { useLanguage } from '../context/LanguageContext.jsx';

/** Microphone button. Calls onTranscript(text) with the final spoken text. */
export default function VoiceButton({ onTranscript, className = '', onInterim }) {
  const { lang, t } = useLanguage();
  const { supported, listening, interim, start, stop } = useSpeechRecognition({
    language: lang,
    onFinal: onTranscript,
  });

  // Let the parent show live text while the user speaks.
  useEffect(() => {
    if (onInterim) onInterim(listening ? interim : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, interim]);

  const label = !supported
    ? t('assistant.voice.unsupported')
    : listening
      ? t('assistant.voice.stop')
      : t('assistant.voice.start');

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      disabled={!supported}
      aria-label={label}
      aria-pressed={listening}
      title={label}
      className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        listening
          ? 'border-red-300 bg-red-50 text-red-600'
          : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
      } ${className}`}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-xl bg-red-200/60" aria-hidden="true" />}
      {supported ? <Mic className="relative h-5 w-5" aria-hidden="true" /> : <MicOff className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}
