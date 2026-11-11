import { useId } from 'react';

/** Small accessible tooltip: shows on hover and keyboard focus. Use for jargon. */
export default function Tooltip({ text, children, className = '' }) {
  const id = useId();
  return (
    <span className={`group relative inline-flex ${className}`}>
      <span
        tabIndex={0}
        aria-describedby={id}
        className="cursor-help rounded underline decoration-dotted decoration-ink-300 underline-offset-4"
      >
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden w-56 -translate-x-1/2 rounded-lg bg-ink-950 px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-pop group-focus-within:block group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}
