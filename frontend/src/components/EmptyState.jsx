function Illustration({ kind }) {
  const common = { width: 120, height: 96, viewBox: '0 0 120 96', fill: 'none', 'aria-hidden': true };
  const ink = '#0B1220';
  const accent = '#6F63EE';
  const soft = '#E4E2FD';
  switch (kind) {
    case 'invoices':
      return (
        <svg {...common}>
          <rect x="30" y="8" width="60" height="80" rx="8" fill="#fff" stroke={ink} strokeWidth="2" />
          <rect x="40" y="22" width="26" height="5" rx="2.5" fill={accent} />
          <rect x="40" y="36" width="40" height="4" rx="2" fill={soft} />
          <rect x="40" y="46" width="40" height="4" rx="2" fill={soft} />
          <rect x="40" y="56" width="24" height="4" rx="2" fill={soft} />
          <circle cx="82" cy="72" r="12" fill={accent} />
          <path d="M76 72l4 4 7-8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'customers':
      return (
        <svg {...common}>
          <circle cx="60" cy="34" r="14" fill={soft} stroke={ink} strokeWidth="2" />
          <path d="M32 84c0-16 12-26 28-26s28 10 28 26" fill="#fff" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <circle cx="94" cy="26" r="8" fill={accent} />
          <path d="M94 22v8M90 26h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M60 8l32 12v26c0 20-14 34-32 42-18-8-32-22-32-42V20L60 8z" fill="#fff" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M46 48l10 10 20-22" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <rect x="16" y="10" width="88" height="72" rx="10" fill="#fff" stroke={ink} strokeWidth="2" />
          <rect x="30" y="52" width="10" height="20" rx="3" fill={soft} />
          <rect x="48" y="40" width="10" height="32" rx="3" fill={accent} />
          <rect x="66" y="30" width="10" height="42" rx="3" fill={soft} />
          <rect x="84" y="22" width="10" height="50" rx="3" fill={accent} />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M40 66V46a20 20 0 0 1 40 0v20l6 8H34l6-8z" fill="#fff" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
          <path d="M52 82a8 8 0 0 0 16 0" stroke={ink} strokeWidth="2" strokeLinecap="round" />
          <circle cx="82" cy="30" r="6" fill={accent} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="14" y="22" width="92" height="56" rx="10" fill="#fff" stroke={ink} strokeWidth="2" />
          <rect x="14" y="34" width="92" height="12" fill={soft} />
          <rect x="24" y="58" width="26" height="6" rx="3" fill={accent} />
          <circle cx="96" cy="20" r="10" fill={accent} />
          <path d="M92 20l3 3 5-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export default function EmptyState({ illustration = 'payments', title, body, children }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <Illustration kind={illustration} />
      <h2 className="mt-4 text-base font-semibold text-ink-900">{title}</h2>
      {body && <p className="mt-1 max-w-md text-sm text-ink-500">{body}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
