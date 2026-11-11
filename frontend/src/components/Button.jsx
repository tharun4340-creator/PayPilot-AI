import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  dark: 'btn-dark',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${VARIANTS[variant] || VARIANTS.primary} ${size === 'sm' ? 'btn-sm' : ''} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
