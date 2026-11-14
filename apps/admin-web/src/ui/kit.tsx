import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ZodError } from 'zod';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Inbox,
  type LucideIcon,
} from 'lucide-react';

/* ------------------------------------------------------------ text helpers */
const special: Record<string, string> = {
  in_service: 'In service',
  in_storage: 'In storage',
  under_maintenance: 'Under maintenance',
  out_of_service: 'Out of service',
  service_coverage: 'Service coverage',
  exclusive_occupancy: 'Exclusive occupancy',
  shared_occupancy: 'Shared occupancy',
  adjustment_in: 'Adjustment in',
  adjustment_out: 'Adjustment out',
};
export function humanize(v: string) {
  if (!v) return '';
  if (special[v]) return special[v];
  const s = v.replaceAll('_', ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'gray';
const tones: Record<string, Tone> = {
  active: 'green',
  in_service: 'green',
  approved: 'green',
  taken: 'green',
  Excellent: 'green',
  Good: 'green',
  draft: 'blue',
  planned: 'blue',
  probation: 'blue',
  in_storage: 'blue',
  under_maintenance: 'amber',
  suspended: 'amber',
  expired: 'amber',
  ended: 'amber',
  Fair: 'amber',
  terminated: 'red',
  out_of_service: 'red',
  resigned: 'gray',
  cancelled: 'gray',
  Poor: 'red',
  Critical: 'red',
  archived: 'gray',
  disposed: 'gray',
};
export function toneFor(v: string): Tone {
  return tones[v] || 'gray';
}

/* ------------------------------------------------------------ errors */
/** Converts any failure into calm, user-facing text. Never shows raw backend errors. */
export function friendly(e: unknown): string {
  if (e instanceof ZodError)
    return e.issues[0]?.message || 'Check the highlighted fields.';
  const code = (e as { code?: string })?.code || '';
  if ((e as { userFacing?: boolean })?.userFacing) return (e as Error).message;
  if (code.includes('permission-denied'))
    return 'This change was not allowed. A linked record may have changed, or your access was updated. Refresh and try again.';
  if (code.includes('failed-precondition'))
    return 'This view is still being prepared by the database. Please try again in a few minutes.';
  if (code.includes('unavailable') || code.includes('network'))
    return 'You appear to be offline. Check your connection and try again.';
  if (code.includes('aborted'))
    return 'Someone else changed this at the same time. Please try again.';
  if (code.includes('not-found')) return 'This record no longer exists.';
  return 'Something went wrong. Please try again, or contact your administrator if it continues.';
}

/* ------------------------------------------------------------ small parts */
export function Pill({
  tone = 'gray',
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`pill tone-${tone}`}>
      {dot && <span className="pip" aria-hidden />}
      {children}
    </span>
  );
}
export function StatusPill({ value }: { value: string }) {
  return (
    <Pill tone={toneFor(value)} dot>
      {humanize(value)}
    </Pill>
  );
}
export function IconCircle({
  icon: Icon,
  tone = 'blue',
  size,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: 'lg';
}) {
  return (
    <span className={`icon-circle tone-${tone} ${size || ''}`} aria-hidden>
      <Icon />
    </span>
  );
}
const palette = [
  '#2f6bea',
  '#7655d8',
  '#0f9447',
  '#c27803',
  '#e0383e',
  '#0e7490',
  '#be185d',
];
export function Avatar({ name, size }: { name: string; size?: 'sm' }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?';
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      className={`avatar ${size || ''}`}
      style={{ background: palette[h % palette.length] }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
export function Banner({
  tone = 'blue',
  title,
  children,
  role,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  role?: 'alert' | 'status';
}) {
  const Icon =
    tone === 'red' || tone === 'amber'
      ? AlertTriangle
      : tone === 'green'
        ? CheckCircle2
        : Info;
  return (
    <div className={`banner tone-${tone}`} role={role}>
      <Icon />
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}
export function Empty({
  icon = Inbox,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <IconCircle icon={icon} tone="blue" size="lg" />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}
export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          type="button"
          role="tab"
          key={t.value}
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ overlays */
function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [active, onEscape]);
}
function useFocusTrap(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      [
        ...el.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((x) => x.offsetParent !== null);
    (el.querySelector<HTMLElement>('[autofocus]') || focusable()[0])?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const f = focusable();
      if (!f.length) return;
      const first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener('keydown', h);
    return () => {
      el.removeEventListener('keydown', h);
      previous?.focus?.();
    };
  }, [ref]);
}
export function Drawer({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  narrow,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  narrow?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEscape(true, onClose);
  useFocusTrap(ref);
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  return createPortal(
    <>
      <div className="overlay" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        className={'drawer ' + (narrow ? 'narrow' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <div className="drawer-head">
          {icon}
          <div className="grow">
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="icon-btn sm"
            aria-label="Close"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  );
}
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  tone = 'red',
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'red' | 'blue';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEscape(!busy, onCancel);
  useFocusTrap(ref);
  return createPortal(
    <>
      <div className="overlay" style={{ zIndex: 94 }} aria-hidden />
      <div
        ref={ref}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <IconCircle
          icon={tone === 'red' ? AlertTriangle : Info}
          tone={tone}
          size="lg"
        />
        <h2 id={id}>{title}</h2>
        <div>{typeof children === 'string' ? <p>{children}</p> : children}</div>
        <div className="dialog-actions">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={'btn ' + (tone === 'red' ? 'btn-danger' : 'btn-primary')}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------ toasts */
type Toast = { id: number; text: string; tone: 'green' | 'red' | 'blue' };
const ToastContext = createContext<
  (text: string, tone?: Toast['tone']) => void
>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'green') => {
    const id = Date.now() + Math.random();
    setItems((v) => [...v.slice(-2), { id, text, tone }]);
    setTimeout(() => setItems((v) => v.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast" role="status">
            <IconCircle
              icon={
                t.tone === 'red'
                  ? AlertTriangle
                  : t.tone === 'blue'
                    ? Info
                    : CheckCircle2
              }
              tone={t.tone}
            />
            <span>{t.text}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setItems((v) => v.filter((x) => x.id !== t.id))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export function useToast() {
  return useContext(ToastContext);
}
