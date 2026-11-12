import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        className="input"
        aria-invalid={!!error}
        aria-describedby={error ? id + '-error' : undefined}
      />
      {error && (
        <span id={id + '-error'} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
export function Message({
  title,
  children,
  error = false,
}: {
  title: string;
  children?: ReactNode;
  error?: boolean;
}) {
  return (
    <section className="card card-pad" role={error ? 'alert' : 'status'}>
      <h2>{title}</h2>
      {children && <div className="message-body">{children}</div>}
    </section>
  );
}
