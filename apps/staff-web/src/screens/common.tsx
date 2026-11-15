import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Clock,
  MapPin,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  addDays,
  isOverdue,
  toLocal,
  zonedTimeToUtc,
  type TaskStatus,
} from '@facilityos/shared';
import type { Task } from '@admin/management/tasksStore';
import { useLabel, type Context } from '@admin/management/context';
import type { Kind } from '@facilityos/shared';
import { Pill, type Tone } from '@admin/ui/kit';
import { useT, type Key } from '../i18n';

export const statusKey: Record<TaskStatus, Key> = {
  pending: 'pending',
  assigned: 'assigned',
  in_progress: 'inProgress',
  paused: 'pause',
  awaiting_approval: 'awaitingApproval',
  rework_required: 'rework',
  rejected: 'reject',
  completed: 'completed',
  cancelled: 'cancel',
};
export const statusTone: Record<TaskStatus, Tone> = {
  pending: 'gray',
  assigned: 'blue',
  in_progress: 'violet',
  paused: 'amber',
  awaiting_approval: 'amber',
  rework_required: 'red',
  rejected: 'red',
  completed: 'green',
  cancelled: 'gray',
};
export function StatusPill({ s }: { s: TaskStatus }) {
  const { t } = useT();
  return (
    <Pill tone={statusTone[s]} dot>
      {s === 'paused'
        ? 'Paused'
        : s === 'rejected'
          ? 'Rejected'
          : s === 'cancelled'
            ? 'Cancelled'
            : t(statusKey[s])}
    </Pill>
  );
}
const prio: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
export const startOf = (t: Task) => (t.plannedStart || t.dueAt).toDate();
/** My Day order: overdue critical, in progress, rework, high priority, then by due time. */
export function workOrder(tasks: Task[], now = new Date()) {
  const rank = (t: Task) => {
    const late = isOverdue(t.status, t.dueAt.toDate(), now);
    if (late && (t.priority === 'critical' || t.priority === 'high')) return 0;
    if (t.status === 'in_progress' || t.status === 'paused') return 1;
    if (t.status === 'rework_required') return 2;
    if (late) return 3;
    if (t.priority === 'critical' || t.priority === 'high') return 4;
    return 5;
  };
  return [...tasks].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      prio[a.priority] - prio[b.priority] ||
      a.dueAt.toMillis() - b.dueAt.toMillis(),
  );
}
export function fmtTime(d: Date, tz: string) {
  return toLocal(d, tz).time;
}
export function fmtDateTime(d: Date, tz: string) {
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  });
}
export function Label({
  context,
  kind,
  id,
  fallback = '',
}: {
  context: Context;
  kind: Kind;
  id: string;
  fallback?: string;
}) {
  const l = useLabel(context, id ? kind : undefined, id);
  return <>{id ? l.text : fallback}</>;
}
export function TaskCard({
  task,
  context,
  tz,
  action,
}: {
  task: Task;
  context: Context;
  tz: string;
  action?: ReactNode;
}) {
  const { t } = useT();
  const late = isOverdue(task.status, task.dueAt.toDate());
  return (
    <article
      className={
        's-card task' +
        (late ? ' late' : '') +
        (task.status === 'rework_required' ? ' rework' : '')
      }
    >
      <Link
        to={`/task/${task.id}`}
        className="s-card-main"
        aria-label={task.title}
      >
        <div className="s-card-top">
          <span className="s-time">
            <Clock size={15} /> {fmtTime(startOf(task), tz)}
          </span>
          <StatusPill s={task.status} />
          {late && (
            <Pill tone="red">
              <AlertTriangle size={12} /> {t('overdue')}
            </Pill>
          )}
          {task.priority !== 'medium' && task.priority !== 'low' && (
            <Pill tone={task.priority === 'critical' ? 'red' : 'amber'}>
              {task.priority === 'critical' ? 'Critical' : 'High'}
            </Pill>
          )}
        </div>
        <h3>{task.title}</h3>
        <p className="s-where">
          <MapPin size={14} />{' '}
          <Label context={context} kind="sites" id={task.siteId} />
          {task.locationId && (
            <>
              {' · '}
              <Label context={context} kind="locations" id={task.locationId} />
            </>
          )}
        </p>
        <p className="s-meta">
          {t('due')} {fmtDateTime(task.dueAt.toDate(), tz)} ·{' '}
          {t('duration', { n: task.content?.estimatedMinutes || 30 })}
          {task.status === 'rework_required' && (
            <span className="s-rework-tag">
              <RotateCcw size={13} /> {t('workReturned')}
            </span>
          )}
        </p>
        <ChevronRight className="s-chev" />
      </Link>
      {action && <div className="s-card-action">{action}</div>}
    </article>
  );
}
export function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="s-empty">
      <div className="s-empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Loading() {
  return (
    <div className="s-loading" aria-busy="true">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function ErrorBox({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  const { t } = useT();
  return (
    <div className="s-error-box" role="alert">
      <AlertTriangle size={18} />
      <span>{error}</span>
      {onRetry && (
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onRetry}
        >
          {t('retry')}
        </button>
      )}
    </div>
  );
}
/** Friendly message for Firestore errors, including permission problems. */
export function friendlyError(e: unknown, t: (k: Key) => string) {
  const code = (e as { code?: string }).code || '';
  if (code.includes('permission')) return t('permissionError');
  if (code.includes('unavailable') || !navigator.onLine) return t('offline');
  return (e as { userFacing?: boolean; message?: string }).userFacing ||
    (e as Error)?.name === 'UserError'
    ? (e as Error).message
    : (e as Error)?.message || 'Something went wrong.';
}
/** UTC bounds of a local calendar day in the company time zone. */
export function localDay(tz: string, date: string): [Date, Date] {
  return [
    zonedTimeToUtc(date, '00:00', tz),
    zonedTimeToUtc(addDays(date, 1), '00:00', tz),
  ];
}
export function todayIn(tz: string) {
  return toLocal(new Date(), tz).date;
}
