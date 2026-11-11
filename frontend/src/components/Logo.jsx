export function LogoMark({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="PayPilot AI">
      <rect width="32" height="32" rx="9" fill="#0B1220" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#6F63EE" strokeOpacity="0.45" />
      <path
        d="M9.5 23V9h7a4.7 4.7 0 0 1 0 9.4h-3.4"
        fill="none"
        stroke="#8A80F4"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M17.2 22.8l5.6-5.6" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ dark = false, size = 32, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-ink-950'}`}>
        PayPilot<span className={dark ? 'text-pilot-300' : 'text-pilot-600'}> AI</span>
      </span>
    </span>
  );
}
