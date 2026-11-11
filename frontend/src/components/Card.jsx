export default function Card({ as: Tag = 'section', className = '', padded = true, children, ...rest }) {
  return (
    <Tag className={`card ${padded ? 'card-pad' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function CardTitle({ children, action, className = '' }) {
  return (
    <div className={`mb-4 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="text-base font-semibold text-ink-900">{children}</h2>
      {action}
    </div>
  );
}
