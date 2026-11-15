import { ExportMenu } from '../ui/ExportMenu';
import { schedulesDataset } from './exportSets';
import { exportBlocked } from './planGate';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarClock,
  CalendarRange,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat,
  Archive,
  Zap,
  Hammer,
} from 'lucide-react';
import {
  describeRule,
  holidayPolicies,
  makeRule,
  planOccurrences,
  presets,
  priorities,
  timeZones,
  toLocal,
  addDays,
  type Rule,
} from '@facilityos/shared';
import {
  emptySchedule,
  getSchedule,
  listSchedules,
  planOf,
  runScheduler,
  saveSchedule,
  scheduleTasks,
  setScheduleStatus,
  validateSchedule,
  type Schedule,
  type ScheduleInput,
} from './scheduling';
import { latestPublished, type Task } from './tasksStore';
import { formatInstant, type Context } from './context';
import { Picker } from './Picker';
import { Name, PriorityPill, TaskStatusPill, TaskDetail } from './Tasks';
import {
  Banner,
  ConfirmDialog,
  Drawer,
  Empty,
  IconCircle,
  Pill,
  Skeleton,
  friendly,
  humanize,
  useToast,
  type Tone,
} from '../ui/kit';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const statusTone: Record<string, Tone> = {
  draft: 'gray',
  active: 'green',
  paused: 'amber',
  completed: 'blue',
  archived: 'gray',
};
export const strategyLabels: Record<string, string> = {
  unassigned: 'Leave unassigned (queue)',
  fixed: 'Fixed employee(s)',
  round_robin: 'Round-robin rotation',
  least_workload: 'Least workload',
};
const poolLabels: Record<string, string> = {
  employee: 'Selected employees',
  department: 'Department',
  designation: 'Designation',
  team: 'Team',
  shift: 'Shift',
  site: 'Site staff',
};
const poolKind = {
  department: 'departments',
  designation: 'designations',
  team: 'teams',
  shift: 'shifts',
  site: 'sites',
} as const;
const holidayLabels: Record<string, string> = {
  skip: 'Skip the occurrence',
  next_working_day: 'Move to the next working day',
  generate: 'Generate anyway',
};
function todayIn(tz: string) {
  return toLocal(new Date(), tz).date;
}
function Field({
  label,
  htmlFor,
  required,
  wide,
  children,
  help,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  wide?: boolean;
  children: ReactNode;
  help?: string;
}) {
  const head = (
    <>
      {label}
      {required && (
        <span className="req" aria-hidden="true">
          *
        </span>
      )}
    </>
  );
  return (
    <div className={'field' + (wide ? ' wide' : '')}>
      {htmlFor ? (
        <label htmlFor={htmlFor}>{head}</label>
      ) : (
        <span className="field-label">{head}</span>
      )}
      {children}
      {help && <span className="small muted">{help}</span>}
    </div>
  );
}
export function presetOf(r: Rule) {
  return (
    Object.entries(presets).find(([, p]) =>
      Object.entries(p.rule).every(
        ([k, v]) =>
          JSON.stringify(r[k as keyof Rule]) === JSON.stringify(v) ||
          (k === 'weekdays' && r.type === 'weekly') ||
          (k === 'monthDays' && r.type === 'monthly_dates'),
      ),
    )?.[0] || 'custom'
  );
}

/* ================================================================ rule builder */
export function RuleBuilder({
  rule,
  onChange,
}: {
  rule: Rule;
  onChange: (r: Rule) => void;
}) {
  const preset = presetOf(rule);
  const unit =
    rule.type === 'daily'
      ? 'day(s)'
      : rule.type === 'weekly'
        ? 'week(s)'
        : rule.type === 'yearly'
          ? 'year(s)'
          : 'month(s)';
  return (
    <div className="form-grid">
      <Field label="Repeat" htmlFor="rule-preset" required>
        <select
          id="rule-preset"
          className="select"
          value={preset}
          onChange={(e) =>
            onChange(makeRule(presets[e.target.value]?.rule || rule))
          }
        >
          {Object.entries(presets).map(([k, p]) => (
            <option key={k} value={k}>
              {p.label}
            </option>
          ))}
          {preset === 'custom' && <option value="custom">Custom</option>}
        </select>
      </Field>
      {['daily', 'weekly', 'monthly_dates', 'monthly_nth', 'yearly'].includes(
        rule.type,
      ) && (
        <Field label={`Every (${unit})`} htmlFor="rule-interval">
          <input
            id="rule-interval"
            className="input"
            type="number"
            min={1}
            max={365}
            value={rule.interval}
            onChange={(e) =>
              onChange({
                ...rule,
                interval: Math.max(1, Math.min(365, +e.target.value || 1)),
              })
            }
          />
        </Field>
      )}
      {rule.type === 'weekly' && (
        <Field label="On" wide>
          <div className="chips" role="group" aria-label="Weekdays">
            {days.map((d, i) => (
              <button
                key={d}
                type="button"
                className="chip-toggle"
                aria-pressed={rule.weekdays.includes(i)}
                onClick={() =>
                  onChange({
                    ...rule,
                    weekdays: rule.weekdays.includes(i)
                      ? rule.weekdays.filter((x) => x !== i)
                      : [...rule.weekdays, i].sort(),
                  })
                }
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
      )}
      {rule.type === 'monthly_dates' && (
        <>
          <Field
            label="Days of the month"
            htmlFor="rule-days"
            help="Comma-separated, e.g. 1, 15 or L for the last day"
          >
            <input
              id="rule-days"
              className="input"
              value={rule.monthDays
                .map((d) => (d === -1 ? 'L' : String(d)))
                .join(', ')}
              onChange={(e) =>
                onChange({
                  ...rule,
                  monthDays: [
                    ...new Set(
                      e.target.value
                        .split(',')
                        .map((x) =>
                          x.trim().toUpperCase() === 'L' ? -1 : +x.trim(),
                        )
                        .filter(
                          (x) =>
                            x === -1 ||
                            (Number.isInteger(x) && x >= 1 && x <= 31),
                        ),
                    ),
                  ].slice(0, 31),
                })
              }
            />
          </Field>
          <Field label="If the day does not exist" htmlFor="rule-overflow">
            <select
              id="rule-overflow"
              className="select"
              value={rule.overflow}
              onChange={(e) =>
                onChange({
                  ...rule,
                  overflow: e.target.value as Rule['overflow'],
                })
              }
            >
              <option value="last_day">Use the last day of the month</option>
              <option value="skip">Skip that month</option>
            </select>
          </Field>
        </>
      )}
      {rule.type === 'monthly_nth' && (
        <>
          <Field label="Week" htmlFor="rule-nth">
            <select
              id="rule-nth"
              className="select"
              value={rule.nth}
              onChange={(e) => onChange({ ...rule, nth: +e.target.value })}
            >
              {[1, 2, 3, 4, -1].map((n) => (
                <option key={n} value={n}>
                  {n === -1
                    ? 'Last'
                    : ['First', 'Second', 'Third', 'Fourth'][n - 1]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Weekday" htmlFor="rule-nthday">
            <select
              id="rule-nthday"
              className="select"
              value={rule.nthWeekday}
              onChange={(e) =>
                onChange({ ...rule, nthWeekday: +e.target.value })
              }
            >
              {days.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
      {rule.type === 'yearly' && (
        <>
          <Field label="Month" htmlFor="rule-month">
            <select
              id="rule-month"
              className="select"
              value={rule.month}
              onChange={(e) => onChange({ ...rule, month: +e.target.value })}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {new Date(2026, i, 1).toLocaleString('en', { month: 'long' })}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Day" htmlFor="rule-day">
            <input
              id="rule-day"
              className="input"
              type="number"
              min={1}
              max={31}
              value={rule.day}
              onChange={(e) =>
                onChange({
                  ...rule,
                  day: Math.max(1, Math.min(31, +e.target.value || 1)),
                })
              }
            />
          </Field>
        </>
      )}
    </div>
  );
}

/* ================================================================ editor */
export function ScheduleEditor({
  context,
  purpose,
  existing,
  initial,
  onClose,
  onSaved,
}: {
  context: Context;
  purpose: Schedule['purpose'];
  existing?: Schedule;
  initial?: Partial<ScheduleInput>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const tz = context.company.timeZone;
  const [v, setV] = useState<ScheduleInput>(() =>
    existing
      ? { ...existing }
      : { ...emptySchedule(purpose, tz, todayIn(tz)), ...initial },
  );
  const [versionLabel, setVersionLabel] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [touched, setTouched] = useState(false);
  const toast = useToast();
  const db = context.services.db,
    c = context.company.companyId;
  useEffect(() => {
    let live = true;
    if (!v.templateId) return;
    latestPublished(db, c, v.templateId).then((ver) => {
      if (!live) return;
      setVersionLabel(
        ver
          ? `Version ${ver.version}: ${ver.content.title} · about ${ver.content.estimatedMinutes} min`
          : '',
      );
      setV((x) =>
        ver
          ? {
              ...x,
              versionId: x.versionId && existing ? x.versionId : ver.id,
              name: x.name || ver.content.title,
              priority: existing ? x.priority : ver.content.priority,
              durationMinutes: existing
                ? x.durationMinutes
                : Math.max(15, ver.content.estimatedMinutes),
            }
          : { ...x, versionId: '' },
      );
    });
    return () => {
      live = false;
    };
  }, [db, c, v.templateId, existing]);
  const problem = validateSchedule(v);
  const preview = useMemo(() => {
    if (problem && !/code|name/.test(problem)) return [];
    try {
      const from =
        v.startDate > todayIn(v.timeZone) ? v.startDate : todayIn(v.timeZone);
      return planOccurrences(
        planOf({ ...v, id: 'preview', ruleVersion: 1 }),
        from,
        addDays(from, 400),
      ).slice(0, 6);
    } catch {
      return [];
    }
  }, [v, problem]);
  async function save() {
    setTouched(true);
    if (problem) return setError(problem);
    setBusy(true);
    setError('');
    try {
      const id = await saveSchedule(db, c, context.uid, v, existing);
      toast(existing ? 'Schedule updated.' : 'Schedule created.');
      onSaved(id);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  const set = (patch: Partial<ScheduleInput>) =>
    setV((x) => ({ ...x, ...patch }));
  const a = v.assignment;
  const setA = (patch: Partial<ScheduleInput['assignment']>) =>
    set({ assignment: { ...a, ...patch } });
  const maintenance = purpose === 'maintenance';
  return (
    <Drawer
      title={
        existing
          ? `Edit ${existing.name}`
          : maintenance
            ? 'New preventive maintenance plan'
            : 'New recurring task'
      }
      subtitle="Occurrences are generated by the scheduler from a published template. Timing changes create a new rule version; work already started is never changed."
      icon={<IconCircle icon={maintenance ? Hammer : Repeat} tone="violet" />}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <span className="note">
            {preview[0]
              ? `Next: ${formatInstant(preview[0].plannedAt, v.timeZone)}`
              : 'No upcoming occurrence'}
          </span>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : existing ? 'Save changes' : 'Create schedule'}
          </button>
        </>
      }
    >
      {error && touched && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <section className="form-section">
        <h3>
          <span className="num">1</span>What
        </h3>
        <div className="form-grid">
          <Field label="Task template" required wide>
            <Picker
              context={context}
              kind="taskTemplates"
              label="Task template"
              value={v.templateId}
              disabled={!!existing}
              onChange={(x) => set({ templateId: x, versionId: '' })}
            />
          </Field>
          {v.templateId && (
            <div className="field wide">
              {versionLabel ? (
                <Banner tone="green">{versionLabel}</Banner>
              ) : (
                <Banner tone="amber">
                  This template has no published version. Publish it first.
                </Banner>
              )}
            </div>
          )}
          <Field label="Schedule name" htmlFor="sch-name" required>
            <input
              id="sch-name"
              className="input"
              maxLength={120}
              value={v.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field
            label="Code"
            htmlFor="sch-code"
            required
            help="Capital letters, numbers, - or _"
          >
            <input
              id="sch-code"
              className="input mono"
              maxLength={40}
              value={v.code}
              disabled={!!existing}
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Priority" htmlFor="sch-priority">
            <select
              id="sch-priority"
              className="select"
              value={v.priority}
              onChange={(e) =>
                set({ priority: e.target.value as ScheduleInput['priority'] })
              }
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsible department">
            <Picker
              context={context}
              kind="departments"
              label="Department"
              value={v.departmentId}
              onChange={(x) => set({ departmentId: x })}
            />
          </Field>
        </div>
      </section>
      <section className="form-section">
        <h3>
          <span className="num">2</span>Where
        </h3>
        <div className="form-grid">
          <Field label="Site" required>
            <Picker
              context={context}
              kind="sites"
              label="Site"
              value={v.siteId}
              disabled={!!existing}
              onChange={(x) =>
                set({ siteId: x, locationId: '', facilityId: '', assetId: '' })
              }
            />
          </Field>
          <Field label="Location">
            <Picker
              context={context}
              kind="locations"
              label="Location"
              value={v.locationId}
              disabled={!v.siteId}
              filter={{ key: 'siteId', value: v.siteId }}
              onChange={(x) => set({ locationId: x })}
            />
          </Field>
          <Field label="Facility">
            <Picker
              context={context}
              kind="facilities"
              label="Facility"
              value={v.facilityId}
              disabled={!v.siteId}
              filter={{ key: 'siteId', value: v.siteId }}
              onChange={(x) => set({ facilityId: x })}
            />
          </Field>
          <Field label={maintenance ? 'Asset (recommended)' : 'Asset'}>
            <Picker
              context={context}
              kind="assets"
              label="Asset"
              value={v.assetId}
              disabled={!v.siteId}
              filter={{ key: 'siteId', value: v.siteId }}
              onChange={(x) => set({ assetId: x })}
            />
          </Field>
        </div>
      </section>
      <section className="form-section">
        <h3>
          <span className="num">3</span>When
        </h3>
        <RuleBuilder rule={v.rule} onChange={(rule) => set({ rule })} />
        <div className="form-grid">
          <Field label="Start date" htmlFor="sch-start" required>
            <input
              id="sch-start"
              type="date"
              className="input"
              value={v.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          </Field>
          <Field
            label="End date"
            htmlFor="sch-end"
            help="Leave empty to repeat indefinitely"
          >
            <input
              id="sch-end"
              type="date"
              className="input"
              value={v.endDate}
              onChange={(e) => set({ endDate: e.target.value })}
            />
          </Field>
          <Field label="Start time" htmlFor="sch-time" required>
            <input
              id="sch-time"
              type="time"
              className="input"
              value={v.localTime}
              onChange={(e) => set({ localTime: e.target.value })}
            />
          </Field>
          <Field
            label="Duration (minutes)"
            htmlFor="sch-duration"
            help="Due time = start + duration"
          >
            <input
              id="sch-duration"
              type="number"
              min={5}
              max={10080}
              className="input"
              value={v.durationMinutes}
              onChange={(e) => set({ durationMinutes: +e.target.value || 0 })}
            />
          </Field>
          <Field label="Time zone" htmlFor="sch-tz">
            <select
              id="sch-tz"
              className="select"
              value={v.timeZone}
              onChange={(e) => set({ timeZone: e.target.value })}
            >
              {[...new Set([v.timeZone, ...timeZones])].map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </Field>
          <Field label="On holidays and non-working days" htmlFor="sch-holiday">
            <select
              id="sch-holiday"
              className="select"
              value={v.holidayPolicy}
              onChange={(e) =>
                set({
                  holidayPolicy: e.target
                    .value as ScheduleInput['holidayPolicy'],
                })
              }
            >
              {holidayPolicies.map((h) => (
                <option key={h} value={h}>
                  {holidayLabels[h]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Working days"
            wide
            help="None selected = every day is a working day"
          >
            <div className="chips" role="group" aria-label="Working days">
              {days.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  className="chip-toggle"
                  aria-pressed={v.workingDays.includes(i)}
                  onClick={() =>
                    set({
                      workingDays: v.workingDays.includes(i)
                        ? v.workingDays.filter((x) => x !== i)
                        : [...v.workingDays, i].sort(),
                    })
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div
          className="inset"
          aria-live="polite"
          style={{ padding: 14, marginTop: 14 }}
        >
          <strong className="small">
            {describeRule(v.rule)} at {v.localTime} ({v.timeZone})
          </strong>
          {preview.length ? (
            <ul
              className="small"
              style={{ margin: '6px 0 0', paddingLeft: 18 }}
            >
              {preview.map((o) => (
                <li key={o.key}>
                  {formatInstant(o.plannedAt, v.timeZone)}
                  {o.moved ? ` (moved from ${o.ruleDate})` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">No occurrences in the next 400 days.</p>
          )}
        </div>
      </section>
      <section className="form-section">
        <h3>
          <span className="num">4</span>Who
        </h3>
        <div className="form-grid">
          <Field label="Assignment" htmlFor="sch-strategy">
            <select
              id="sch-strategy"
              className="select"
              value={a.strategy}
              onChange={(e) =>
                setA({ strategy: e.target.value as typeof a.strategy })
              }
            >
              {Object.entries(strategyLabels).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          {a.strategy !== 'unassigned' && a.strategy !== 'fixed' && (
            <Field label="Pool" htmlFor="sch-pool">
              <select
                id="sch-pool"
                className="select"
                value={a.pool}
                onChange={(e) =>
                  setA({ pool: e.target.value as typeof a.pool, refId: '' })
                }
              >
                {Object.entries(poolLabels).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {a.strategy !== 'unassigned' &&
            a.strategy !== 'fixed' &&
            a.pool !== 'employee' && (
              <Field label={poolLabels[a.pool]} required={a.pool !== 'site'}>
                <Picker
                  context={context}
                  kind={poolKind[a.pool]}
                  label={poolLabels[a.pool]}
                  value={a.refId}
                  placeholder={a.pool === 'site' ? 'Schedule site' : undefined}
                  onChange={(x) => setA({ refId: x })}
                />
              </Field>
            )}
          {a.strategy !== 'unassigned' &&
            (a.strategy === 'fixed' || a.pool === 'employee') && (
              <Field
                label="Employees"
                wide
                help={
                  a.strategy === 'fixed'
                    ? 'First available in this order is assigned'
                    : 'Rotation members'
                }
              >
                <EmployeeList
                  context={context}
                  ids={a.employeeIds}
                  onChange={(employeeIds) =>
                    setA({ employeeIds, pool: 'employee' })
                  }
                />
              </Field>
            )}
          {a.strategy !== 'unassigned' && (
            <label className="toggle wide">
              <input
                type="checkbox"
                checked={a.siteOnly}
                onChange={(e) => setA({ siteOnly: e.target.checked })}
              />
              Only employees assigned to this site
            </label>
          )}
        </div>
        <p className="small muted">
          Employees on approved leave, outside their shift days or inactive are
          never assigned. If nobody is eligible the occurrence goes to the
          unassigned queue.
        </p>
      </section>
      <section className="form-section">
        <h3>
          <span className="num">5</span>Notes
        </h3>
        <textarea
          className="input"
          rows={3}
          aria-label="Notes"
          maxLength={2000}
          value={v.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </section>
    </Drawer>
  );
}
function EmployeeList({
  context,
  ids,
  onChange,
}: {
  context: Context;
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const [pick, setPick] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="chips">
        {ids.map((id) => (
          <span key={id} className="pill tone-blue">
            <Name context={context} kind="employees" id={id} />
            <button
              type="button"
              className="chip-x"
              aria-label="Remove"
              onClick={() => onChange(ids.filter((x) => x !== id))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {ids.length < 10 && (
        <Picker
          context={context}
          kind="employees"
          label="Add employee"
          value={pick}
          onChange={(x) => {
            if (x && !ids.includes(x)) onChange([...ids, x]);
            setPick('');
          }}
        />
      )}
    </div>
  );
}

/* ================================================================ list */
export function ScheduleArea({
  context,
  purpose,
}: {
  context: Context;
  purpose: Schedule['purpose'];
}) {
  const [params, setParams] = useSearchParams();
  const id = params.get('schedule') || '',
    task = params.get('task') || '';
  if (task)
    return (
      <TaskDetail
        key={task}
        context={context}
        taskId={task}
        onBack={() => setParams(id ? { schedule: id } : {})}
      />
    );
  if (id)
    return (
      <ScheduleDetail
        key={id}
        context={context}
        id={id}
        onBack={() => setParams({})}
        onOpenTask={(t) => setParams({ schedule: id, task: t })}
      />
    );
  return (
    <ScheduleList
      context={context}
      purpose={purpose}
      onOpen={(x) => setParams({ schedule: x })}
    />
  );
}
function ScheduleList({
  context,
  purpose,
  onOpen,
}: {
  context: Context;
  purpose: Schedule['purpose'];
  onOpen: (id: string) => void;
}) {
  const [rows, setRows] = useState<Schedule[]>(),
    [status, setStatus] = useState(''),
    [creating, setCreating] = useState(false),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    listSchedules(context.services.db, context.company.companyId, purpose)
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [context, purpose, version]);
  const shown = (rows || []).filter((s) =>
    status ? s.status === status : s.status !== 'archived',
  );
  const maintenance = purpose === 'maintenance';
  return (
    <section className="card card-pad rise">
      <div className="toolbar">
        <select
          className="select"
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All except archived</option>
          {['active', 'paused', 'draft', 'completed', 'archived'].map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-btn"
          aria-label="Refresh"
          onClick={() => setVersion((x) => x + 1)}
        >
          <RefreshCw />
        </button>
        <span style={{ flex: 1 }} />
        <ExportMenu
          db={context.services.db}
          companyId={context.company.companyId}
          companyName={context.company.name}
          timeZone={context.company.timeZone}
          uid={context.uid}
          canSeeSensitive
          disabledReason={exportBlocked(context)}
          dataset={() => schedulesDataset(context, rows || [], maintenance)}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreating(true)}
        >
          <Plus /> {maintenance ? 'New PM plan' : 'New recurring task'}
        </button>
      </div>
      {error && <Banner tone="red">{error}</Banner>}
      {!rows && !error && <Skeleton rows={3} />}
      {rows && !shown.length && (
        <Empty
          icon={maintenance ? Hammer : Repeat}
          title={
            maintenance
              ? 'No preventive maintenance plans'
              : 'No recurring tasks'
          }
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCreating(true)}
            >
              <Plus /> Create one
            </button>
          }
        >
          {maintenance
            ? 'Plan inspections and servicing for assets on a fixed cycle.'
            : 'Repeat a published template daily, weekly, monthly or yearly.'}
        </Empty>
      )}
      {!!shown.length && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Schedule</th>
                <th>Repeats</th>
                <th>Site</th>
                <th>Assignment</th>
                <th>Last run</th>
                <th>Status</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {shown.map((s, i) => (
                <tr
                  key={s.id}
                  className="clickable"
                  style={{ ['--i' as string]: i }}
                  onClick={() => onOpen(s.id)}
                >
                  <td>
                    <div className="cell-main">
                      <span
                        className="icon-circle tone-violet"
                        style={{ width: 38, height: 38 }}
                      >
                        {maintenance ? (
                          <Hammer size={17} />
                        ) : (
                          <Repeat size={17} />
                        )}
                      </span>
                      <div>
                        <button
                          type="button"
                          className="text-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(s.id);
                          }}
                        >
                          {s.name}
                        </button>
                        <div className="s">
                          <span className="code-chip">{s.code}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="small">
                    {describeRule(s.rule)} · {s.localTime}
                  </td>
                  <td className="cell-ref">
                    <Name context={context} kind="sites" id={s.siteId} />
                    {s.assetId && (
                      <div className="small muted">
                        <Name context={context} kind="assets" id={s.assetId} />
                      </div>
                    )}
                  </td>
                  <td className="small">
                    {strategyLabels[s.assignment.strategy]}
                  </td>
                  <td className="small">
                    {s.lastRunAt ? (
                      formatInstant(s.lastRunAt.toDate())
                    ) : (
                      <span className="muted">Not yet run</span>
                    )}
                    {s.lastRunStatus === 'error' && (
                      <Pill tone="red">Error</Pill>
                    )}
                  </td>
                  <td>
                    <Pill tone={statusTone[s.status]} dot>
                      {humanize(s.status)}
                    </Pill>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn sm"
                      aria-label={'Open ' + s.name}
                    >
                      <ArrowUpRight />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <ScheduleEditor
          context={context}
          purpose={purpose}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            onOpen(id);
          }}
        />
      )}
    </section>
  );
}

/* ================================================================ detail */
function ScheduleDetail({
  context,
  id,
  onBack,
  onOpenTask,
}: {
  context: Context;
  id: string;
  onBack: () => void;
  onOpenTask: (id: string) => void;
}) {
  const [s, setS] = useState<Schedule | null>(),
    [tasks, setTasks] = useState<Task[]>(),
    [editing, setEditing] = useState(false),
    [confirm, setConfirm] = useState<'' | 'paused' | 'active' | 'archived'>(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  const toast = useToast();
  const db = context.services.db,
    c = context.company.companyId;
  useEffect(() => {
    let live = true;
    Promise.all([getSchedule(db, c, id), scheduleTasks(db, c, id, 60)])
      .then(([x, t]) => {
        if (!live) return;
        setS(x);
        setTasks(t);
      })
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c, id, version]);
  const upcoming = useMemo(() => {
    if (!s) return [];
    try {
      const today = todayIn(s.timeZone);
      return planOccurrences(
        planOf(s),
        today > s.startDate ? today : s.startDate,
        addDays(today, 120),
      ).slice(0, 5);
    } catch {
      return [];
    }
  }, [s]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (s === undefined) return <Skeleton rows={4} />;
  if (s === null)
    return (
      <Empty
        icon={Repeat}
        title="Schedule not found"
        action={
          <button className="btn btn-outline" onClick={onBack}>
            Back
          </button>
        }
      />
    );
  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      if (done) toast(done);
      setVersion((x) => x + 1);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
      setConfirm('');
    }
  }
  const editable = s.status !== 'archived';
  return (
    <>
      <section className="card card-pad rise">
        <button
          type="button"
          className="link-btn"
          onClick={onBack}
          style={{ marginBottom: 14 }}
        >
          ← All schedules
        </button>
        <div className="detail-head">
          <IconCircle
            icon={s.purpose === 'maintenance' ? Hammer : Repeat}
            tone="violet"
            size="lg"
          />
          <div className="grow">
            <h1>{s.name}</h1>
            <div className="meta">
              <span className="code-chip">{s.code}</span>
              <Pill tone={statusTone[s.status]} dot>
                {humanize(s.status)}
              </Pill>
              <PriorityPill p={s.priority} />
              <Pill tone="gray">Rule v{s.ruleVersion}</Pill>
            </div>
          </div>
        </div>
        <div className="page-actions task-actions">
          {editable && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setEditing(true)}
            >
              <Pencil /> Edit
            </button>
          )}
          {s.status === 'active' && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      runScheduler(db, c, context.uid, {
                        mode: 'manual',
                        onlyScheduleId: s.id,
                      }).then((r) => {
                        if (r.errors.length) throw new Error(r.errors[0]);
                        toast(
                          `${r.created} new occurrence(s), ${r.existing} already existed.`,
                        );
                      }),
                    '',
                  )
                }
              >
                <Zap /> Generate now
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => setConfirm('paused')}
              >
                <Pause /> Pause
              </button>
            </>
          )}
          {(s.status === 'paused' || s.status === 'draft') && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setConfirm('active')}
            >
              <Play /> Activate
            </button>
          )}
          {editable && s.status !== 'active' && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setConfirm('archived')}
            >
              <Archive /> Archive
            </button>
          )}
        </div>
        {s.lastRunStatus === 'error' && (
          <Banner
            tone="red"
            title={`Last run failed (${s.retryCount} attempt(s))`}
          >
            {s.lastError} The next scheduler run retries automatically.
          </Banner>
        )}
        <dl className="facts" style={{ marginTop: 18 }}>
          <Fact label="Repeats">{describeRule(s.rule)}</Fact>
          <Fact label="Time">
            {s.localTime} · {s.durationMinutes} min · {s.timeZone}
          </Fact>
          <Fact label="Period">
            {s.startDate} → {s.endDate || 'no end'}
          </Fact>
          <Fact label="Holidays">{holidayLabels[s.holidayPolicy]}</Fact>
          <Fact label="Site">
            <Name context={context} kind="sites" id={s.siteId} />
          </Fact>
          {s.assetId && (
            <Fact label="Asset">
              <Name context={context} kind="assets" id={s.assetId} />
            </Fact>
          )}
          <Fact label="Template">
            <Name context={context} kind="taskTemplates" id={s.templateId} />
          </Fact>
          <Fact label="Assignment">
            {strategyLabels[s.assignment.strategy]}
            {s.assignment.strategy !== 'unassigned' &&
            s.assignment.strategy !== 'fixed'
              ? ` · ${poolLabels[s.assignment.pool]}`
              : ''}
          </Fact>
          <Fact label="Generated through">
            {s.generatedThrough || 'Not generated yet'}
          </Fact>
          <Fact label="Last run">
            {s.lastRunAt ? formatInstant(s.lastRunAt.toDate()) : '—'}
          </Fact>
        </dl>
      </section>
      <div
        className="dash-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>
              <CalendarRange size={18} /> Upcoming (planned)
            </h2>
          </div>
          {upcoming.length ? (
            <div className="queue">
              {upcoming.map((o) => (
                <div key={o.key} className="queue-row">
                  <IconCircle icon={CalendarClock} tone="blue" />
                  <div>
                    <div className="t">
                      {formatInstant(o.plannedAt, s.timeZone)}
                    </div>
                    <div className="s">
                      Due {formatInstant(o.dueAt, s.timeZone)}
                      {o.moved ? ` · moved from ${o.ruleDate}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No upcoming occurrences.</p>
          )}
        </section>
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>Generated tasks</h2>
            <span className="muted small">
              {tasks?.length ?? 0} most recent
            </span>
          </div>
          {!tasks ? (
            <Skeleton rows={3} />
          ) : !tasks.length ? (
            <p className="muted small">
              Nothing generated yet. Occurrences are created by the scheduler
              (server job, or “Generate now”).
            </p>
          ) : (
            <div className="queue">
              {tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="queue-row"
                  onClick={() => onOpenTask(t.id)}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="t">
                      {t.plannedStart
                        ? formatInstant(t.plannedStart.toDate())
                        : formatInstant(t.dueAt.toDate())}
                    </div>
                    <div className="s">
                      <span className="code-chip">{t.reference}</span>{' '}
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
          )}
        </section>
      </div>
      {editing && (
        <ScheduleEditor
          context={context}
          purpose={s.purpose}
          existing={s}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setVersion((x) => x + 1);
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm === 'paused'
              ? 'Pause this schedule?'
              : confirm === 'active'
                ? 'Activate this schedule?'
                : 'Archive this schedule?'
          }
          confirmLabel={
            confirm === 'paused'
              ? 'Pause'
              : confirm === 'active'
                ? 'Activate'
                : 'Archive'
          }
          tone={confirm === 'archived' ? 'red' : 'blue'}
          busy={busy}
          onCancel={() => setConfirm('')}
          onConfirm={() =>
            void act(
              () => setScheduleStatus(db, c, context.uid, s, confirm),
              'Schedule updated.',
            )
          }
        >
          {confirm === 'paused'
            ? 'No new occurrences are generated while paused. Existing tasks are not changed.'
            : confirm === 'active'
              ? 'The scheduler will generate occurrences from the next run, catching up missed days (up to 30 days back).'
              : 'Archived schedules stop permanently and cannot be edited. Generated tasks remain in history.'}
        </ConfirmDialog>
      )}
    </>
  );
}
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
