import { cloneElement, useId } from 'react';

/** Label + control + hint/error. The child control gets id and aria attributes automatically. */
export default function Field({ label, hint, error, optional, children, className = '' }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const control = cloneElement(children, {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: `${children.props.className || 'input'} ${error ? 'input-error' : ''}`.trim(),
  });
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-400">({optional})</span>}
      </label>
      {control}
      {error ? (
        <p id={`${id}-err`} className="field-error" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="help">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
