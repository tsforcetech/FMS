import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  Building2,
  Clock,
  UserPlus,
} from 'lucide-react';
import {
  addDays,
  isOverdue,
  openStatuses,
  reschedulable,
  shiftMinutes,
  parseWorkingDays,
  toLocal,
  weekday,
  zonedTimeToUtc,
  type LocalDate,
} from '@facilityos/shared';
import { getTask, transitionTask, type Task } from './tasksStore';
import {
  getSchedule,
  loadContext,
  moveSeries,
  rescheduleTask,
  type SchedulerContext,
} from './scheduling';
import { formatInstant, useLabel, type Context } from './context';
import { Picker } from './Picker';
import { NewTaskDrawer, TaskDetail, TaskStatusPill, Name } from './Tasks';
import {
  Banner,
  Drawer,
  Empty,
  IconCircle,
  Pill,
  Segmented,
  Skeleton,
  friendly,
  humanize,
  useToast,
  type Tone,
} from '../ui/kit';

export type CalendarView =
  'day' | 'week' | 'month' | 'agenda' | 'staff' | 'site';
const viewOptions: { value: CalendarView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'staff', label: 'Staff' },
  { value: 'site', label: 'Sites' },
];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const tone: Record<string, Tone> = {
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
type Filters = {
  siteId: string;
  departmentId: string;
  assigneeId: string;
  open: boolean;
  origin: '' | 'manual' | 'schedule' | 'maintenance';
};
export const startOf = (t: Task) => (t.plannedStart || t.dueAt).toDate();

/** Range of local dates shown for a view. */
function rangeFor(
  view: CalendarView,
  anchor: LocalDate,
): [LocalDate, LocalDate] {
  if (view === 'day') return [anchor, anchor];
  if (view === 'month') {
    const first = anchor.slice(0, 8) + '01';
    const start = addDays(first, -weekday(first));
    return [start, addDays(start, 41)];
  }
  if (view === 'agenda') return [anchor, addDays(anchor, 13)];
  const start = addDays(anchor, -weekday(anchor));
  return [start, addDays(start, 6)];
}
/** Loads tasks whose due time falls in the local range (one query, filtered in memory). */
export async function tasksInRange(
  context: Context,
  from: LocalDate,
  to: LocalDate,
) {
  const tz = context.company.timeZone;
  const r = await getDocs(
    query(
      collection(
        context.services.db,
        'companies',
        context.company.companyId,
        'tasks',
      ),
      where(
        'dueAt',
        '>=',
        Timestamp.fromDate(zonedTimeToUtc(addDays(from, -1), '00:00', tz)),
      ),
      where(
        'dueAt',
        '<',
        Timestamp.fromDate(zonedTimeToUtc(addDays(to, 8), '00:00', tz)),
      ),
      orderBy('dueAt'),
      limit(800),
    ),
  );
  return {
    rows: r.docs.map((d) => ({ id: d.id, ...d.data() }) as Task),
    truncated: r.size === 800,
  };
}

export function TaskCalendar({
  context,
  origin,
}: {
  context: Context;
  /** Fixed origin filter (maintenance calendar). */
  origin?: Filters['origin'];
}) {
  const tz = context.company.timeZone;
  const [params, setParams] = useSearchParams();
  const taskId = params.get('task') || '';
  const [view, setView] = useState<CalendarView>(
    () => (params.get('view') as CalendarView) || 'week',
  );
  const [anchor, setAnchor] = useState(() => toLocal(new Date(), tz).date);
  const [filters, setFilters] = useState<Filters>({
    siteId: '',
    departmentId: '',
    assigneeId: '',
    open: false,
    origin: origin || '',
  });
  const [rows, setRows] = useState<Task[]>(),
    [truncated, setTruncated] = useState(false),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0),
    [creating, setCreating] = useState<{ start: Date; siteId?: string } | null>(
      null,
    ),
    [move, setMove] = useState<{
      task: Task;
      start: Date;
      employeeId?: string;
    } | null>(null);
  const [from, to] = rangeFor(view, anchor);
  useEffect(() => {
    let live = true;
    setRows(undefined);
    tasksInRange(context, from, to)
      .then((r) => {
        if (!live) return;
        setRows(r.rows);
        setTruncated(r.truncated);
        setError('');
      })
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [context, from, to, version]);
  const shown = useMemo(
    () =>
      (rows || []).filter((t) => {
        const d = toLocal(startOf(t), tz).date;
        if (d < from || d > to) return false;
        if (filters.siteId && t.siteId !== filters.siteId) return false;
        if (filters.departmentId && t.departmentId !== filters.departmentId)
          return false;
        if (filters.assigneeId && !t.assigneeIds.includes(filters.assigneeId))
          return false;
        if (filters.open && !openStatuses.includes(t.status)) return false;
        if (filters.origin && (t.origin || 'manual') !== filters.origin)
          return false;
        return true;
      }),
    [rows, filters, from, to, tz],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of [...shown].sort((a, b) => +startOf(a) - +startOf(b))) {
      const d = toLocal(startOf(t), tz).date;
      m.set(d, [...(m.get(d) || []), t]);
    }
    return m;
  }, [shown, tz]);
  if (taskId)
    return (
      <TaskDetail
        key={taskId}
        context={context}
        taskId={taskId}
        onBack={() => {
          setParams({ view });
          setVersion((x) => x + 1);
        }}
      />
    );
  const open = (id: string) => setParams({ task: id, view });
  const step =
    view === 'day' ? 1 : view === 'month' ? 30 : view === 'agenda' ? 14 : 7;
  const shift = (n: number) => {
    if (view === 'month') {
      const [y, m] = anchor.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + n, 1));
      setAnchor(d.toISOString().slice(0, 10));
    } else setAnchor(addDays(anchor, n * step));
  };
  const title =
    view === 'month'
      ? new Date(anchor + 'T12:00:00Z').toLocaleString('en', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : from === to
        ? fmtDay(from, true)
        : `${fmtDay(from)} – ${fmtDay(to)}`;
  function onDrop(
    e: DragEvent,
    date: LocalDate,
    hour?: number,
    employeeId?: string,
  ) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/task');
    const t = shown.find((x) => x.id === id);
    if (!t) return;
    const time =
      hour !== undefined
        ? `${String(hour).padStart(2, '0')}:00`
        : toLocal(startOf(t), tz).time;
    setMove({ task: t, start: zonedTimeToUtc(date, time, tz), employeeId });
  }
  const dnd = {
    over: (e: DragEvent) => e.preventDefault(),
    drop: onDrop,
  };
  const today = toLocal(new Date(), tz).date;
  return (
    <section className="card card-pad rise calendar">
      <div className="toolbar">
        <div className="cal-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label="Previous"
            onClick={() => shift(-1)}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setAnchor(today)}
          >
            Today
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Next"
            onClick={() => shift(1)}
          >
            <ChevronRight />
          </button>
          <h2 className="cal-title">{title}</h2>
        </div>
        <span style={{ flex: 1 }} />
        <Segmented
          label="Calendar view"
          options={viewOptions}
          value={view}
          onChange={(v) => {
            setView(v);
            setParams({ view: v });
          }}
        />
      </div>
      <div className="toolbar">
        <div style={{ minWidth: 200 }}>
          <Picker
            context={context}
            kind="sites"
            label="Site"
            value={filters.siteId}
            placeholder="All sites"
            onChange={(x) => setFilters({ ...filters, siteId: x })}
          />
        </div>
        <div style={{ minWidth: 200 }}>
          <Picker
            context={context}
            kind="departments"
            label="Department"
            value={filters.departmentId}
            placeholder="All departments"
            onChange={(x) => setFilters({ ...filters, departmentId: x })}
          />
        </div>
        <div style={{ minWidth: 200 }}>
          <Picker
            context={context}
            kind="employees"
            label="Employee"
            value={filters.assigneeId}
            placeholder="All employees"
            onChange={(x) => setFilters({ ...filters, assigneeId: x })}
          />
        </div>
        {!origin && (
          <select
            className="select"
            aria-label="Source"
            value={filters.origin}
            onChange={(e) =>
              setFilters({
                ...filters,
                origin: e.target.value as Filters['origin'],
              })
            }
          >
            <option value="">All sources</option>
            <option value="manual">Manual tasks</option>
            <option value="schedule">Recurring tasks</option>
            <option value="maintenance">Preventive maintenance</option>
          </select>
        )}
        <label className="toggle small">
          <input
            type="checkbox"
            checked={filters.open}
            onChange={(e) => setFilters({ ...filters, open: e.target.checked })}
          />
          Open work only
        </label>
        <button
          type="button"
          className="icon-btn"
          aria-label="Refresh"
          onClick={() => setVersion((x) => x + 1)}
        >
          <RefreshCw />
        </button>
      </div>
      {error && <Banner tone="red">{error}</Banner>}
      {truncated && (
        <Banner tone="amber">
          Showing the first 800 tasks in this period. Narrow the view or
          filters.
        </Banner>
      )}
      {!rows && !error && <Skeleton rows={5} />}
      {rows && (
        <>
          <p className="small muted cal-hint">
            Times in {tz}. Drag a task to another day
            {view === 'day' ? ' or hour' : ''} to reschedule it; click an empty
            slot to create a task.
          </p>
          {view === 'month' && (
            <div className="cal-month" role="grid" aria-label="Month">
              {dayNames.map((d) => (
                <div key={d} className="cal-dow" role="columnheader">
                  {d}
                </div>
              ))}
              {Array.from({ length: 42 }, (_, i) => addDays(from, i)).map(
                (d) => (
                  <div
                    key={d}
                    role="gridcell"
                    className={
                      'cal-cell' +
                      (d.slice(0, 7) !== anchor.slice(0, 7) ? ' dim' : '') +
                      (d === today ? ' today' : '')
                    }
                    onDragOver={dnd.over}
                    onDrop={(e) => dnd.drop(e, d)}
                    onDoubleClick={() =>
                      setCreating({
                        start: zonedTimeToUtc(d, '09:00', tz),
                        siteId: filters.siteId,
                      })
                    }
                  >
                    <button
                      type="button"
                      className="cal-date"
                      aria-label={`Create task on ${d}`}
                      onClick={() =>
                        setCreating({
                          start: zonedTimeToUtc(d, '09:00', tz),
                          siteId: filters.siteId,
                        })
                      }
                    >
                      {+d.slice(8)}
                    </button>
                    {(byDay.get(d) || []).slice(0, 3).map((t) => (
                      <Chip key={t.id} t={t} tz={tz} onOpen={open} />
                    ))}
                    {(byDay.get(d) || []).length > 3 && (
                      <button
                        type="button"
                        className="cal-more"
                        onClick={() => {
                          setAnchor(d);
                          setView('day');
                        }}
                      >
                        +{(byDay.get(d) || []).length - 3} more
                      </button>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
          {view === 'week' && (
            <div className="cal-week">
              {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map(
                (d) => (
                  <div
                    key={d}
                    className={'cal-col' + (d === today ? ' today' : '')}
                    onDragOver={dnd.over}
                    onDrop={(e) => dnd.drop(e, d)}
                  >
                    <div className="cal-col-head">
                      <span>{dayNames[weekday(d)]}</span>
                      <strong>{+d.slice(8)}</strong>
                      <span className="count-chip">
                        {(byDay.get(d) || []).length}
                      </span>
                    </div>
                    {(byDay.get(d) || []).map((t) => (
                      <Chip key={t.id} t={t} tz={tz} onOpen={open} full />
                    ))}
                    <button
                      type="button"
                      className="cal-add"
                      onClick={() =>
                        setCreating({
                          start: zonedTimeToUtc(d, '09:00', tz),
                          siteId: filters.siteId,
                        })
                      }
                    >
                      + Add
                    </button>
                  </div>
                ),
              )}
            </div>
          )}
          {view === 'day' && (
            <div className="cal-day">
              {Array.from({ length: 24 }, (_, h) => h).map((h) => {
                const items = (byDay.get(from) || []).filter(
                  (t) => +toLocal(startOf(t), tz).time.slice(0, 2) === h,
                );
                return (
                  <div
                    key={h}
                    className="cal-hour"
                    onDragOver={dnd.over}
                    onDrop={(e) => dnd.drop(e, from, h)}
                  >
                    <button
                      type="button"
                      className="cal-hour-label"
                      aria-label={`Create task at ${h}:00`}
                      onClick={() =>
                        setCreating({
                          start: zonedTimeToUtc(
                            from,
                            `${String(h).padStart(2, '0')}:00`,
                            tz,
                          ),
                          siteId: filters.siteId,
                        })
                      }
                    >
                      {String(h).padStart(2, '0')}:00
                    </button>
                    <div className="cal-hour-items">
                      {items.map((t) => (
                        <Chip key={t.id} t={t} tz={tz} onOpen={open} full />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {view === 'agenda' &&
            (shown.length ? (
              <div className="cal-agenda">
                {[...byDay.entries()].map(([d, items]) => (
                  <div key={d}>
                    <h3 className="section-title">{fmtDay(d, true)}</h3>
                    <div className="queue">
                      {items.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="queue-row"
                          onClick={() => open(t.id)}
                        >
                          <IconCircle icon={Clock} tone={tone[t.status]} />
                          <div style={{ minWidth: 0 }}>
                            <div className="t">
                              {toLocal(startOf(t), tz).time} · {t.title}
                            </div>
                            <div className="s">
                              <span className="code-chip">{t.reference}</span>{' '}
                              <Name
                                context={context}
                                kind="sites"
                                id={t.siteId}
                              />{' '}
                              ·{' '}
                              {t.assigneeIds[0] ? (
                                <Name
                                  context={context}
                                  kind="employees"
                                  id={t.assigneeIds[0]}
                                />
                              ) : (
                                'Unassigned'
                              )}
                            </div>
                          </div>
                          <TaskStatusPill status={t.status} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                icon={CalendarDays}
                title="Nothing scheduled in this period"
              />
            ))}
          {(view === 'staff' || view === 'site') && (
            <Timeline
              context={context}
              by={view === 'staff' ? 'employee' : 'site'}
              from={from}
              tasks={shown}
              tz={tz}
              onOpen={open}
              onDrop={dnd.drop}
              today={today}
            />
          )}
        </>
      )}
      {creating && (
        <NewTaskDrawer
          context={context}
          initial={{ start: creating.start, siteId: creating.siteId }}
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            setCreating(null);
            open(id);
          }}
        />
      )}
      {move && (
        <MoveDialog
          context={context}
          move={move}
          onClose={(changed) => {
            setMove(null);
            if (changed) setVersion((x) => x + 1);
          }}
        />
      )}
    </section>
  );
}
function fmtDay(d: LocalDate, long = false) {
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: long ? 'long' : 'short',
    day: 'numeric',
    month: 'short',
    ...(long ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}
function Chip({
  t,
  tz,
  onOpen,
  full,
}: {
  t: Task;
  tz: string;
  onOpen: (id: string) => void;
  full?: boolean;
}) {
  const late = isOverdue(t.status, t.dueAt.toDate());
  const movable = reschedulable.includes(t.status);
  return (
    <button
      type="button"
      className={
        'cal-chip tone-' +
        tone[t.status] +
        (late ? ' late' : '') +
        (full ? ' full' : '')
      }
      draggable={movable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/task', t.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onOpen(t.id)}
      title={`${t.title} · ${humanize(t.status)}${late ? ' · overdue' : ''}${movable ? '' : ' · cannot be moved'}`}
    >
      <span className="cal-time">{toLocal(startOf(t), tz).time}</span>
      <span className="cal-name">{t.title}</span>
      {full && t.origin && t.origin !== 'manual' && (
        <span className="cal-tag">
          {t.origin === 'maintenance' ? 'PM' : '↻'}
        </span>
      )}
    </button>
  );
}
function Timeline({
  context,
  by,
  from,
  tasks,
  tz,
  onOpen,
  onDrop,
  today,
}: {
  context: Context;
  by: 'employee' | 'site';
  from: LocalDate;
  tasks: Task[];
  tz: string;
  onOpen: (id: string) => void;
  onDrop: (
    e: DragEvent,
    date: LocalDate,
    hour?: number,
    employeeId?: string,
  ) => void;
  today: LocalDate;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const rowsOf = (t: Task) =>
    by === 'site' ? [t.siteId] : t.assigneeIds.length ? t.assigneeIds : [''];
  const keys = [...new Set(tasks.flatMap(rowsOf))].sort((a, b) =>
    a === '' ? 1 : b === '' ? -1 : a.localeCompare(b),
  );
  if (!keys.length)
    return (
      <Empty
        icon={by === 'site' ? Building2 : Users}
        title="Nothing scheduled this week"
      />
    );
  return (
    <div className="table-wrap">
      <table className="data cal-timeline">
        <thead>
          <tr>
            <th>{by === 'site' ? 'Site' : 'Employee'}</th>
            {days.map((d) => (
              <th key={d} className={d === today ? 'today' : ''}>
                {dayNames[weekday(d)]} {+d.slice(8)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k || 'none'}>
              <th scope="row" className="cell-ref">
                {k ? (
                  <Name
                    context={context}
                    kind={by === 'site' ? 'sites' : 'employees'}
                    id={k}
                  />
                ) : (
                  <span className="muted">Unassigned queue</span>
                )}
              </th>
              {days.map((d) => (
                <td
                  key={d}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) =>
                    onDrop(
                      e,
                      d,
                      undefined,
                      by === 'employee' && k ? k : undefined,
                    )
                  }
                >
                  {tasks
                    .filter(
                      (t) =>
                        rowsOf(t).includes(k) &&
                        toLocal(startOf(t), tz).date === d,
                    )
                    .map((t) => (
                      <Chip key={t.id} t={t} tz={tz} onOpen={onOpen} />
                    ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Reschedule confirmation with series scope for recurring occurrences. */
function MoveDialog({
  context,
  move,
  onClose,
}: {
  context: Context;
  move: { task: Task; start: Date; employeeId?: string };
  onClose: (changed: boolean) => void;
}) {
  const t = move.task;
  const [scope, setScope] = useState<'one' | 'future' | 'all'>('one'),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  const db = context.services.db,
    c = context.company.companyId;
  const duration = t.dueAt.toMillis() - startOf(t).getTime();
  const reassign =
    !!move.employeeId && !t.assigneeIds.includes(move.employeeId);
  const who = useLabel(context, 'employees', move.employeeId || '').text;
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (scope === 'one' || !t.scheduleId) {
        await rescheduleTask(
          db,
          c,
          context.uid,
          t,
          move.start,
          new Date(move.start.getTime() + Math.max(duration, 0)),
          note.trim() || 'Moved on the calendar',
        );
        if (reassign) {
          const fresh = await getTask(db, c, t.id);
          if (fresh)
            await transitionTask(db, c, context.uid, fresh, 'assign', {
              assigneeIds: [move.employeeId!],
            });
        }
      } else {
        const s = await getSchedule(db, c, t.scheduleId);
        if (!s) throw new Error('The schedule no longer exists.');
        await moveSeries(db, c, context.uid, s, t, move.start, scope);
      }
      toast(
        scope === 'one'
          ? 'Task rescheduled.'
          : 'Schedule updated. Run the scheduler to regenerate occurrences.',
      );
      onClose(true);
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  }
  return (
    <Drawer
      narrow
      title="Reschedule"
      subtitle={`${t.title} → ${formatInstant(move.start, context.company.timeZone)}`}
      icon={<IconCircle icon={CalendarDays} tone="blue" />}
      onClose={() => !busy && onClose(false)}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => onClose(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Reschedule'}
          </button>
        </>
      }
    >
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      {t.scheduleId ? (
        <fieldset className="form-section" style={{ border: 0, padding: 0 }}>
          <legend className="field-label">
            This is a recurring occurrence. Apply the change to:
          </legend>
          {(
            [
              [
                'one',
                'This occurrence only',
                'Only this task moves; the schedule is unchanged.',
              ],
              [
                'future',
                'This and future occurrences',
                'Moves the series pattern and time from this occurrence on. Earlier occurrences keep their time.',
              ],
              [
                'all',
                'The entire schedule',
                'Re-plans all not-started occurrences from today. Completed and in-progress work is history and never moves.',
              ],
            ] as const
          ).map(([v, label, help]) => (
            <label key={v} className="toggle" style={{ marginBottom: 10 }}>
              <input
                type="radio"
                name="scope"
                checked={scope === v}
                onChange={() => setScope(v)}
              />
              <span>
                <strong>{label}</strong>
                <span className="small muted" style={{ display: 'block' }}>
                  {help}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {reassign && scope === 'one' && (
        <Banner tone="blue" title="Also reassign">
          The task will be reassigned to {who}.
        </Banner>
      )}
      {scope === 'one' && (
        <div className="field">
          <label htmlFor="move-note">Reason (recorded in the timeline)</label>
          <input
            id="move-note"
            className="input"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
    </Drawer>
  );
}

/* ================================================================ staff workload */
export function StaffWorkload({ context }: { context: Context }) {
  const tz = context.company.timeZone;
  const [params, setParams] = useSearchParams();
  const taskId = params.get('task') || '';
  const [anchor, setAnchor] = useState(() => toLocal(new Date(), tz).date);
  const [data, setData] = useState<{ tasks: Task[]; ctx: SchedulerContext }>(),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(''),
    [reassign, setReassign] = useState<Task | null>(null),
    [version, setVersion] = useState(0);
  const [from, to] = rangeFor('week', anchor);
  useEffect(() => {
    let live = true;
    setData(undefined);
    Promise.all([
      tasksInRange(context, from, to),
      loadContext(context.services.db, context.company.companyId),
    ])
      .then(
        ([t, ctx]) =>
          live &&
          setData({
            tasks: t.rows.filter((x) => {
              const d = toLocal(startOf(x), tz).date;
              return d >= from && d <= to;
            }),
            ctx,
          }),
      )
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [context, from, to, tz, version]);
  const rows = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    const ids = new Set<string>([
      ...data.ctx.employees.keys(),
      ...data.tasks.flatMap((t) => t.assigneeIds),
    ]);
    return [...ids]
      .map((id) => {
        const mine = data.tasks.filter((t) => t.assigneeIds.includes(id));
        const shiftMins = Array.from({ length: 7 }, (_, i) =>
          addDays(from, i),
        ).reduce((sum, d) => {
          const a = data.ctx.shiftAssignments.find(
            (r) =>
              r.employeeId === id &&
              (!r.startDate || String(r.startDate) <= d) &&
              (!r.endDate || String(r.endDate) >= d),
          );
          const sh = a && data.ctx.shifts.get(String(a.shiftId));
          if (!sh) return sum;
          const wd = parseWorkingDays(String(sh.workingDays || ''));
          if (wd.length && !wd.includes(weekday(d))) return sum;
          const onLeave = data.ctx.leave.some(
            (l) =>
              l.employeeId === id &&
              String(l.startDate) <= d &&
              String(l.endDate || l.startDate) >= d,
          );
          return onLeave
            ? sum
            : sum +
                shiftMinutes(
                  String(sh.startTime || '00:00'),
                  String(sh.endTime || '00:00'),
                  Number(sh.breakMinutes || 0),
                );
        }, 0);
        return {
          id,
          total: mine.length,
          open: mine.filter((t) => openStatuses.includes(t.status)).length,
          completed: mine.filter((t) => t.status === 'completed').length,
          overdue: mine.filter((t) =>
            isOverdue(t.status, t.dueAt.toDate(), now),
          ).length,
          minutes: mine
            .filter((t) => t.status !== 'cancelled')
            .reduce((s, t) => s + (t.content?.estimatedMinutes || 30), 0),
          shiftMins,
          onLeave: data.ctx.leave.some(
            (l) =>
              l.employeeId === id &&
              String(l.startDate) <= to &&
              String(l.endDate || l.startDate) >= from,
          ),
          tasks: mine,
        };
      })
      .sort((a, b) => b.minutes - a.minutes || a.id.localeCompare(b.id));
  }, [data, from, to]);
  if (taskId)
    return (
      <TaskDetail
        key={taskId}
        context={context}
        taskId={taskId}
        onBack={() => {
          setParams({});
          setVersion((x) => x + 1);
        }}
      />
    );
  const unassigned =
    data?.tasks.filter(
      (t) => !t.assigneeIds.length && openStatuses.includes(t.status),
    ) || [];
  const sel = rows.find((r) => r.id === selected);
  return (
    <>
      <section className="card card-pad rise">
        <div className="toolbar">
          <div className="cal-nav">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous week"
              onClick={() => setAnchor(addDays(anchor, -7))}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setAnchor(toLocal(new Date(), tz).date)}
            >
              This week
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next week"
              onClick={() => setAnchor(addDays(anchor, 7))}
            >
              <ChevronRight />
            </button>
            <h2 className="cal-title">
              {fmtDay(from)} – {fmtDay(to)}
            </h2>
          </div>
        </div>
        {error && <Banner tone="red">{error}</Banner>}
        {!data && !error && <Skeleton rows={4} />}
        {data && (
          <>
            {!!unassigned.length && (
              <Banner
                tone="amber"
                title={`${unassigned.length} open task(s) in the unassigned queue`}
              >
                Generated occurrences with no eligible employee wait here.
                Assign them from the list below.
              </Banner>
            )}
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Tasks</th>
                    <th>Open</th>
                    <th>Overdue</th>
                    <th>Completed</th>
                    <th>Planned work</th>
                    <th>Shift hours</th>
                    <th>Load</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const load = r.shiftMins
                      ? Math.round((r.minutes / r.shiftMins) * 100)
                      : null;
                    return (
                      <tr
                        key={r.id}
                        className={
                          'clickable' + (selected === r.id ? ' selected' : '')
                        }
                        onClick={() =>
                          setSelected(selected === r.id ? '' : r.id)
                        }
                      >
                        <td className="cell-ref">
                          <button type="button" className="text-link">
                            <Name
                              context={context}
                              kind="employees"
                              id={r.id}
                            />
                          </button>
                          {r.onLeave && <Pill tone="amber">Leave</Pill>}
                        </td>
                        <td>{r.total}</td>
                        <td>{r.open}</td>
                        <td>
                          {r.overdue ? <Pill tone="red">{r.overdue}</Pill> : 0}
                        </td>
                        <td>{r.completed}</td>
                        <td>{(r.minutes / 60).toFixed(1)} h</td>
                        <td>
                          {r.shiftMins ? (
                            (r.shiftMins / 60).toFixed(1) + ' h'
                          ) : (
                            <span className="muted">No shift</span>
                          )}
                        </td>
                        <td>
                          {load === null ? (
                            '—'
                          ) : (
                            <Pill
                              tone={
                                load > 100
                                  ? 'red'
                                  : load > 80
                                    ? 'amber'
                                    : 'green'
                              }
                            >
                              {load}%
                            </Pill>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="small muted">
              Planned work = sum of template estimated minutes for the week.
              Shift hours come from active shift assignments minus breaks and
              approved leave.
            </p>
          </>
        )}
      </section>
      {data && (sel || unassigned.length > 0) && (
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>
              {sel ? (
                <>
                  Tasks for{' '}
                  <Name context={context} kind="employees" id={sel.id} />
                </>
              ) : (
                'Unassigned queue'
              )}
            </h2>
          </div>
          <div className="queue">
            {(sel ? sel.tasks : unassigned).map((t) => (
              <div key={t.id} className="queue-row">
                <div style={{ minWidth: 0 }}>
                  <button
                    type="button"
                    className="text-link t"
                    onClick={() => setParams({ task: t.id })}
                  >
                    {t.title}
                  </button>
                  <div className="s">
                    {formatInstant(startOf(t), tz)} ·{' '}
                    <Name context={context} kind="sites" id={t.siteId} />
                  </div>
                </div>
                <TaskStatusPill status={t.status} />
                {['pending', 'assigned', 'paused'].includes(t.status) && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setReassign(t)}
                  >
                    <UserPlus /> {t.assigneeIds.length ? 'Reassign' : 'Assign'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {reassign && (
        <ReassignDrawer
          context={context}
          task={reassign}
          onClose={(changed) => {
            setReassign(null);
            if (changed) setVersion((x) => x + 1);
          }}
        />
      )}
    </>
  );
}
function ReassignDrawer({
  context,
  task,
  onClose,
}: {
  context: Context;
  task: Task;
  onClose: (changed: boolean) => void;
}) {
  const [employee, setEmployee] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  return (
    <Drawer
      narrow
      title={task.assigneeIds.length ? 'Reassign task' : 'Assign task'}
      subtitle={task.title}
      icon={<IconCircle icon={UserPlus} tone="blue" />}
      onClose={() => !busy && onClose(false)}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => onClose(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !employee}
            onClick={async () => {
              setBusy(true);
              try {
                await transitionTask(
                  context.services.db,
                  context.company.companyId,
                  context.uid,
                  task,
                  'assign',
                  { assigneeIds: [employee] },
                );
                toast('Task assigned.');
                onClose(true);
              } catch (e) {
                setError(friendly(e));
                setBusy(false);
              }
            }}
          >
            Assign
          </button>
        </>
      }
    >
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <div className="field">
        <span className="field-label">Employee</span>
        <Picker
          context={context}
          kind="employees"
          label="Employee"
          value={employee}
          onChange={setEmployee}
        />
      </div>
      <p className="small muted">
        The change is recorded in the task timeline and the employee is notified
        in-app if they have a linked user account.
      </p>
    </Drawer>
  );
}

/* ================================================================ site / department / team */
export function GroupedWorkload({ context }: { context: Context }) {
  const tz = context.company.timeZone;
  const [by, setBy] = useState<'site' | 'department' | 'team'>('site');
  const [anchor, setAnchor] = useState(() => toLocal(new Date(), tz).date);
  const [rows, setRows] = useState<Task[]>(),
    [error, setError] = useState('');
  const [from, to] = rangeFor('week', anchor);
  useEffect(() => {
    let live = true;
    setRows(undefined);
    tasksInRange(context, from, to)
      .then(
        (r) =>
          live &&
          setRows(
            r.rows.filter((x) => {
              const d = toLocal(startOf(x), tz).date;
              return d >= from && d <= to;
            }),
          ),
      )
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [context, from, to, tz]);
  const key = (t: Task) =>
    by === 'site' ? t.siteId : by === 'department' ? t.departmentId : t.teamId;
  const groups = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of rows || []) m.set(key(t), [...(m.get(key(t)) || []), t]);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, by]);
  const now = new Date();
  return (
    <section className="card card-pad rise">
      <div className="toolbar">
        <div className="cal-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label="Previous week"
            onClick={() => setAnchor(addDays(anchor, -7))}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Next week"
            onClick={() => setAnchor(addDays(anchor, 7))}
          >
            <ChevronRight />
          </button>
          <h2 className="cal-title">
            {fmtDay(from)} – {fmtDay(to)}
          </h2>
        </div>
        <span style={{ flex: 1 }} />
        <Segmented
          label="Group by"
          value={by}
          onChange={setBy}
          options={[
            { value: 'site', label: 'Site' },
            { value: 'department', label: 'Department' },
            { value: 'team', label: 'Team' },
          ]}
        />
      </div>
      {error && <Banner tone="red">{error}</Banner>}
      {!rows && !error && <Skeleton rows={4} />}
      {rows && !groups.length && (
        <Empty icon={Building2} title="No tasks this week" />
      )}
      {!!groups.length && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{humanize(by)}</th>
                <th>Total</th>
                <th>Pending / assigned</th>
                <th>In progress</th>
                <th>Awaiting approval</th>
                <th>Completed</th>
                <th>Overdue</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([k, list]) => {
                const done = list.filter(
                  (t) => t.status === 'completed',
                ).length;
                const counted = list.filter(
                  (t) => t.status !== 'cancelled',
                ).length;
                return (
                  <tr key={k || 'none'}>
                    <td className="cell-ref">
                      {k ? (
                        <Name
                          context={context}
                          kind={
                            by === 'site'
                              ? 'sites'
                              : by === 'department'
                                ? 'departments'
                                : 'teams'
                          }
                          id={k}
                        />
                      ) : (
                        <span className="muted">Not set</span>
                      )}
                    </td>
                    <td>{list.length}</td>
                    <td>
                      {
                        list.filter((t) =>
                          ['pending', 'assigned'].includes(t.status),
                        ).length
                      }
                    </td>
                    <td>
                      {
                        list.filter((t) =>
                          ['in_progress', 'paused', 'rework_required'].includes(
                            t.status,
                          ),
                        ).length
                      }
                    </td>
                    <td>
                      {
                        list.filter((t) => t.status === 'awaiting_approval')
                          .length
                      }
                    </td>
                    <td>{done}</td>
                    <td>
                      {
                        list.filter((t) =>
                          isOverdue(t.status, t.dueAt.toDate(), now),
                        ).length
                      }
                    </td>
                    <td>
                      <div className="progress" aria-label="Completion">
                        <div
                          className="progress-bar"
                          style={{
                            width: `${counted ? Math.round((done / counted) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <span className="small muted">
                        {counted ? Math.round((done / counted) * 100) : 0}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
