import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import {
  addDays,
  caseDefinitions,
  caseKinds,
  daysBetween,
  makeRule,
  matches,
  occurrenceTaskId,
  openStatuses,
  parseWorkingDays,
  planOccurrences,
  reschedulable,
  resolveAssignee,
  ruleSchema,
  shiftRule,
  taskReference,
  toLocal,
  weekday,
  zonedTimeToUtc,
  type Candidate,
  type HolidayPolicy,
  type LocalDate,
  type Priority,
  type Rule,
  type SchedulePlan,
  type TaskStatus,
  type VersionContent,
} from '@facilityos/shared';
import { UserError } from './store';
import { event, transitionTask, type Task } from './tasksStore';
import { adminUids, linkedUids, notify } from './notifyStore';

/* ================================================================ types */
export type AssignmentStrategyOption =
  'fixed' | 'round_robin' | 'least_workload' | 'unassigned';
export type Assignment = {
  strategy: AssignmentStrategyOption;
  pool: 'employee' | 'department' | 'designation' | 'team' | 'shift' | 'site';
  refId: string;
  employeeIds: string[];
  /** Only employees assigned to the schedule's site are eligible. */
  siteOnly: boolean;
};
export type ScheduleStatus =
  'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type Schedule = {
  id: string;
  code: string;
  name: string;
  purpose: 'routine' | 'maintenance';
  templateId: string;
  versionId: string;
  siteId: string;
  locationId: string;
  facilityId: string;
  assetId: string;
  departmentId: string;
  assignment: Assignment;
  rule: Rule;
  ruleVersion: number;
  startDate: string;
  endDate: string;
  localTime: string;
  durationMinutes: number;
  timeZone: string;
  workingDays: number[];
  holidayPolicy: HolidayPolicy;
  priority: Priority;
  status: ScheduleStatus;
  generatedThrough: string;
  lastRunAt: Timestamp | null;
  lastRunStatus: '' | 'ok' | 'error';
  lastError: string;
  retryCount: number;
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  revision: number;
};
export type ScheduleInput = Omit<
  Schedule,
  | 'id'
  | 'ruleVersion'
  | 'generatedThrough'
  | 'lastRunAt'
  | 'lastRunStatus'
  | 'lastError'
  | 'retryCount'
  | 'createdAt'
  | 'updatedAt'
  | 'revision'
>;
export type SchedulerRun = {
  id: string;
  mode: 'manual' | 'server';
  actorUid: string;
  startedAt: Timestamp;
  finishedAt: Timestamp | null;
  status: 'running' | 'ok' | 'partial' | 'error';
  scheduleCount: number;
  created: number;
  existing: number;
  unassigned: number;
  notifications: number;
  errors: string[];
  windowFrom: string;
  windowTo: string;
};

const col = (db: Firestore, c: string, name: string) =>
  collection(db, 'companies', c, name);
const ref = (db: Firestore, c: string, name: string, id: string) =>
  doc(db, 'companies', c, name, id);

export function planOf(s: Pick<Schedule, keyof SchedulePlan>): SchedulePlan {
  return {
    id: s.id,
    rule: s.rule,
    ruleVersion: s.ruleVersion,
    startDate: s.startDate,
    endDate: s.endDate,
    localTime: s.localTime,
    durationMinutes: s.durationMinutes,
    timeZone: s.timeZone,
    workingDays: s.workingDays,
    holidayPolicy: s.holidayPolicy,
  };
}
export function emptySchedule(
  purpose: Schedule['purpose'],
  timeZone: string,
  today: string,
): ScheduleInput {
  return {
    code: '',
    name: '',
    purpose,
    templateId: '',
    versionId: '',
    siteId: '',
    locationId: '',
    facilityId: '',
    assetId: '',
    departmentId: '',
    assignment: {
      strategy: 'unassigned',
      pool: 'employee',
      refId: '',
      employeeIds: [],
      siteOnly: false,
    },
    rule: makeRule({
      type: purpose === 'maintenance' ? 'monthly_dates' : 'daily',
    }),
    startDate: today,
    endDate: '',
    localTime: '08:00',
    durationMinutes: 60,
    timeZone,
    workingDays: [],
    holidayPolicy: 'next_working_day',
    priority: 'medium',
    status: 'active',
    notes: '',
  };
}
const inputKeys = [
  'code',
  'name',
  'purpose',
  'templateId',
  'versionId',
  'siteId',
  'locationId',
  'facilityId',
  'assetId',
  'departmentId',
  'assignment',
  'rule',
  'startDate',
  'endDate',
  'localTime',
  'durationMinutes',
  'timeZone',
  'workingDays',
  'holidayPolicy',
  'priority',
  'status',
  'notes',
] as const satisfies readonly (keyof ScheduleInput)[];
/** Fields whose change alters which occurrences exist (new rule version). */
const timingFields = [
  'rule',
  'startDate',
  'endDate',
  'localTime',
  'durationMinutes',
  'timeZone',
  'workingDays',
  'holidayPolicy',
  'versionId',
] as const;

export function validateSchedule(v: ScheduleInput) {
  if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(v.code))
    return 'Enter a code using capital letters, numbers, - or _ (max 40).';
  if (!v.name.trim()) return 'Enter a schedule name.';
  if (!v.templateId || !v.versionId) return 'Choose a published template.';
  if (!v.siteId) return 'Choose a site.';
  if (!ruleSchema.safeParse(v.rule).success) return 'Check the repeat rule.';
  if (v.rule.type === 'weekly' && !v.rule.weekdays.length)
    return 'Choose at least one weekday.';
  if (v.rule.type === 'monthly_dates' && !v.rule.monthDays.length)
    return 'Choose at least one day of the month.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.startDate)) return 'Choose a start date.';
  if (v.endDate && v.endDate < v.startDate)
    return 'The end date must be on or after the start date.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.localTime))
    return 'Choose a start time.';
  if (v.durationMinutes < 5 || v.durationMinutes > 10080)
    return 'Duration must be between 5 minutes and 7 days.';
  try {
    zonedTimeToUtc(v.startDate, v.localTime, v.timeZone);
  } catch {
    return 'Choose a valid time zone.';
  }
  if (v.assignment.strategy === 'fixed' && !v.assignment.employeeIds.length)
    return 'Choose the fixed employee(s).';
  if (
    ['round_robin', 'least_workload'].includes(v.assignment.strategy) &&
    v.assignment.pool !== 'employee' &&
    v.assignment.pool !== 'site' &&
    !v.assignment.refId
  )
    return 'Choose who is in the assignment pool.';
  if (
    ['round_robin', 'least_workload'].includes(v.assignment.strategy) &&
    v.assignment.pool === 'employee' &&
    v.assignment.employeeIds.length < 1
  )
    return 'Choose the employees in the rotation.';
  return '';
}

/* ================================================================ CRUD */
export async function listSchedules(
  db: Firestore,
  c: string,
  purpose?: Schedule['purpose'],
) {
  const r = await getDocs(
    query(
      col(db, c, 'recurringSchedules'),
      ...(purpose ? [where('purpose', '==', purpose)] : []),
      orderBy('name'),
      limit(200),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as Schedule);
}
export async function getSchedule(db: Firestore, c: string, id: string) {
  const s = await getDoc(ref(db, c, 'recurringSchedules', id));
  return s.exists() ? ({ id: s.id, ...s.data() } as Schedule) : null;
}

/**
 * Creates or edits a schedule. Changing timing creates a new rule version:
 * not-started future occurrences of the old version are cancelled with a
 * reason and the new version generates from today, so nothing is duplicated.
 */
export async function saveSchedule(
  db: Firestore,
  c: string,
  uid: string,
  input: ScheduleInput,
  existing?: Schedule,
  opts: { now?: Date; effectiveFrom?: LocalDate } = {},
) {
  const now = opts.now || new Date();
  const problem = validateSchedule(input);
  if (problem) throw new UserError(problem);
  const picked = Object.fromEntries(
    inputKeys.map((k) => [k, input[k]]),
  ) as ScheduleInput;
  const clean = {
    ...picked,
    name: input.name.trim().slice(0, 120),
    notes: input.notes.slice(0, 2000),
    assignment: {
      ...input.assignment,
      employeeIds: input.assignment.employeeIds.slice(0, 10),
    },
  };
  if (!existing) {
    const id = doc(col(db, c, 'recurringSchedules')).id;
    await runTransaction(db, async (tx) => {
      const v = await tx.get(ref(db, c, 'templateVersions', input.versionId));
      if (
        !v.exists() ||
        v.data().state !== 'published' ||
        v.data().templateId !== input.templateId
      )
        throw new UserError('Choose a published template version.');
      tx.set(ref(db, c, 'recurringSchedules', id), {
        ...clean,
        status: input.status === 'draft' ? 'draft' : 'active',
        companyId: c,
        schemaVersion: 1,
        ruleVersion: 1,
        generatedThrough: '',
        lastRunAt: null,
        lastRunStatus: '',
        lastError: '',
        retryCount: 0,
        createdAt: serverTimestamp(),
        createdBy: uid,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
        revision: 1,
      });
    });
    return id;
  }
  if (existing.status === 'archived')
    throw new UserError('Archived schedules cannot be edited.');
  const timingChanged = timingFields.some(
    (k) => JSON.stringify(existing[k]) !== JSON.stringify(clean[k]),
  );
  const today = toLocal(now, existing.timeZone).date;
  // A timing change applies from the first day not yet generated (or from the
  // dragged occurrence), so the old and new versions never overlap.
  const effectiveFrom =
    opts.effectiveFrom ||
    (existing.generatedThrough >= today ? addDays(today, 1) : today);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'recurringSchedules', existing.id));
    if (!s.exists() || s.data().revision !== existing.revision)
      throw new UserError(
        'This schedule was changed by someone else. Reload and try again.',
      );
    tx.update(ref(db, c, 'recurringSchedules', existing.id), {
      ...clean,
      code: existing.code,
      templateId: existing.templateId,
      siteId: existing.siteId,
      // A finished series with new timing has occurrences to generate again.
      status:
        timingChanged && clean.status === 'completed' ? 'active' : clean.status,
      ruleVersion: timingChanged
        ? existing.ruleVersion + 1
        : existing.ruleVersion,
      generatedThrough:
        timingChanged && existing.generatedThrough
          ? addDays(effectiveFrom, -1) < existing.generatedThrough
            ? addDays(effectiveFrom, -1)
            : existing.generatedThrough
          : existing.generatedThrough,
      revision: existing.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  });
  if (timingChanged)
    await cancelOpenOccurrences(
      db,
      c,
      uid,
      existing.id,
      zonedTimeToUtc(effectiveFrom, '00:00', existing.timeZone),
      'Schedule changed; replaced by the new rule version.',
      existing.ruleVersion + 1,
    );
  return existing.id;
}
export async function setScheduleStatus(
  db: Firestore,
  c: string,
  uid: string,
  s: Schedule,
  status: ScheduleStatus,
) {
  if (s.status === 'archived')
    throw new UserError('Archived schedules cannot be changed.');
  await runTransaction(db, async (tx) => {
    const fresh = await tx.get(ref(db, c, 'recurringSchedules', s.id));
    if (!fresh.exists() || fresh.data().revision !== s.revision)
      throw new UserError(
        'This schedule was changed by someone else. Reload and try again.',
      );
    tx.update(ref(db, c, 'recurringSchedules', s.id), {
      status,
      revision: s.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  });
}
/** Generated tasks of a schedule (most recent first by due time). */
export async function scheduleTasks(
  db: Firestore,
  c: string,
  scheduleId: string,
  max = 50,
) {
  const r = await getDocs(
    query(
      col(db, c, 'tasks'),
      where('scheduleId', '==', scheduleId),
      orderBy('dueAt', 'desc'),
      limit(max),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as Task);
}
/**
 * Cancels not-started occurrences planned from `from` onward that belong to an
 * older rule version (or all versions when keepVersion is omitted).
 */
export async function cancelOpenOccurrences(
  db: Firestore,
  c: string,
  uid: string,
  scheduleId: string,
  from: Date,
  reason: string,
  keepVersion?: number,
) {
  const r = await getDocs(
    query(
      col(db, c, 'tasks'),
      where('scheduleId', '==', scheduleId),
      where('dueAt', '>=', Timestamp.fromDate(from)),
      orderBy('dueAt'),
      limit(200),
    ),
  );
  let cancelled = 0;
  for (const d of r.docs) {
    const t = { id: d.id, ...d.data() } as Task;
    if (!['pending', 'assigned'].includes(t.status)) continue;
    if (keepVersion && t.occurrenceKey.includes(`_r${keepVersion}_`)) continue;
    try {
      await transitionTask(db, c, uid, t, 'cancel', { note: reason });
      cancelled++;
    } catch (e) {
      if (!(e instanceof UserError)) throw e;
    }
  }
  return cancelled;
}

/* ================================================================ reschedule */
export async function rescheduleTask(
  db: Firestore,
  c: string,
  uid: string,
  task: Task,
  plannedStart: Date,
  dueAt: Date,
  note: string,
) {
  if (isNaN(plannedStart.getTime()) || isNaN(dueAt.getTime()))
    throw new UserError('Choose a valid date and time.');
  if (plannedStart.getTime() > dueAt.getTime())
    throw new UserError('The due time must be after the planned start.');
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref(db, c, 'tasks', task.id));
    if (!s.exists()) throw new UserError('This task no longer exists.');
    const t = { id: s.id, ...s.data() } as Task;
    if (t.revision !== task.revision)
      throw new UserError(
        'This task was updated by someone else. Reload and try again.',
      );
    if (!reschedulable.includes(t.status))
      throw new UserError(
        `A ${t.status.replaceAll('_', ' ')} task cannot be rescheduled.`,
      );
    const revision = t.revision + 1;
    tx.update(ref(db, c, 'tasks', t.id), {
      plannedStart: Timestamp.fromDate(plannedStart),
      dueAt: Timestamp.fromDate(dueAt),
      revision,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    tx.set(
      ref(db, c, 'taskEvents', `${t.id}_${revision}`),
      event(
        c,
        t.id,
        revision,
        'reschedule',
        t.status,
        t.status,
        uid,
        note ||
          `Moved to ${plannedStart.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
        t.assigneeIds,
        t.attempt,
      ),
    );
  });
}
/**
 * Moves a recurring series from a dragged occurrence: shifts the day pattern
 * and time of day. "future" keeps earlier occurrences; "all" re-plans from
 * the schedule start. Completed and in-progress work is never moved.
 */
export async function moveSeries(
  db: Firestore,
  c: string,
  uid: string,
  s: Schedule,
  task: Task,
  newStart: Date,
  scope: 'future' | 'all',
  now = new Date(),
) {
  const before = toLocal(
    (task.plannedStart || task.dueAt).toDate(),
    s.timeZone,
  );
  const after = toLocal(newStart, s.timeZone);
  const delta = daysBetween(before.date, after.date);
  const input: ScheduleInput = {
    ...s,
    rule: shiftRule(s.rule, delta),
    localTime: after.time,
    startDate: s.rule.type === 'once' ? after.date : s.startDate,
  };
  const today = toLocal(now, s.timeZone).date;
  const anchor = before.date < after.date ? before.date : after.date;
  return saveSchedule(db, c, uid, input, s, {
    now,
    effectiveFrom: scope === 'all' ? today : anchor < today ? today : anchor,
  });
}

/* ================================================================ runner */
type Row = Record<string, unknown> & { id: string };
async function rows(
  db: Firestore,
  c: string,
  name: string,
  ...constraints: Parameters<typeof query>[1][]
) {
  const r = await getDocs(
    query(col(db, c, name), ...(constraints as []), limit(1000)),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as Row);
}
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const covers = (r: Row, date: string) =>
  (!str(r.startDate) || str(r.startDate) <= date) &&
  (!str(r.endDate) || str(r.endDate) >= date);

/** Shared reference data loaded once per company run (no per-occurrence reads). */
export type SchedulerContext = {
  employees: Map<string, Row>;
  teamMembers: Row[];
  siteAssignments: Row[];
  shiftAssignments: Row[];
  shifts: Map<string, Row>;
  leave: Row[];
  holidays: Row[];
  sites: Map<string, Row>;
};
export async function loadContext(
  db: Firestore,
  c: string,
): Promise<SchedulerContext> {
  const [
    employees,
    teamMembers,
    siteAssignments,
    shiftAssignments,
    shifts,
    leave,
    holidays,
    sites,
  ] = await Promise.all([
    rows(db, c, 'employees', where('status', 'in', ['active', 'probation'])),
    rows(db, c, 'teamMembers', where('status', '==', 'active')),
    rows(db, c, 'siteAssignments', where('status', '==', 'active')),
    rows(db, c, 'shiftAssignments', where('status', '==', 'active')),
    rows(db, c, 'shifts', where('status', '==', 'active')),
    rows(db, c, 'leaveRecords', where('status', 'in', ['approved', 'taken'])),
    rows(db, c, 'holidays', where('status', '==', 'active')),
    rows(db, c, 'sites'),
  ]);
  return {
    employees: new Map(employees.map((e) => [e.id, e])),
    teamMembers,
    siteAssignments,
    shiftAssignments,
    shifts: new Map(shifts.map((s) => [s.id, s])),
    leave,
    holidays,
    sites: new Map(sites.map((s) => [s.id, s])),
  };
}
export function holidaySet(ctx: SchedulerContext, siteId: string) {
  return new Set(
    ctx.holidays
      .filter((h) => !str(h.siteId) || str(h.siteId) === siteId)
      .map((h) => str(h.holidayDate))
      .filter(Boolean),
  );
}
/** Employee IDs in the schedule's pool (before leave/shift/workload checks). */
export function poolMembers(
  ctx: SchedulerContext,
  s: Pick<Schedule, 'assignment' | 'siteId'>,
  date: string,
) {
  const a = s.assignment;
  const ids = new Set<string>();
  const siteOf = (siteId: string) =>
    new Set([
      ...[...ctx.employees.values()]
        .filter((e) => str(e.primarySiteId) === siteId)
        .map((e) => e.id),
      ...ctx.siteAssignments
        .filter((r) => str(r.siteId) === siteId && covers(r, date))
        .map((r) => str(r.employeeId)),
    ]);
  if (a.pool === 'employee')
    for (const id of a.employeeIds.length ? a.employeeIds : [a.refId])
      if (id) ids.add(id);
  if (a.pool === 'department' || a.pool === 'designation')
    for (const e of ctx.employees.values())
      if (str(e[a.pool + 'Id']) === a.refId) ids.add(e.id);
  if (a.pool === 'team')
    for (const r of ctx.teamMembers)
      if (str(r.teamId) === a.refId && covers(r, date))
        ids.add(str(r.employeeId));
  if (a.pool === 'shift')
    for (const r of ctx.shiftAssignments)
      if (str(r.shiftId) === a.refId && covers(r, date))
        ids.add(str(r.employeeId));
  if (a.pool === 'site')
    for (const id of siteOf(a.refId || s.siteId)) ids.add(id);
  if (a.siteOnly) {
    const here = siteOf(s.siteId);
    for (const id of [...ids]) if (!here.has(id)) ids.delete(id);
  }
  return [...ids];
}
/** Builds assignment candidates for one date (leave, shift and workload aware). */
export function candidatesFor(
  ctx: SchedulerContext,
  s: Pick<Schedule, 'assignment' | 'siteId'>,
  date: string,
  workload: Map<string, number>,
): Candidate[] {
  const day = weekday(date);
  return poolMembers(ctx, s, date).map((id) => {
    const e = ctx.employees.get(id);
    const shifts = ctx.shiftAssignments.filter(
      (r) =>
        str(r.employeeId) === id &&
        covers(r, date) &&
        (s.assignment.pool !== 'shift' ||
          str(r.shiftId) === s.assignment.refId),
    );
    const worksToday = shifts.some((r) => {
      const sh = ctx.shifts.get(str(r.shiftId));
      if (!sh) return false;
      const days = parseWorkingDays(str(sh.workingDays));
      return !days.length || days.includes(day);
    });
    return {
      employeeId: id,
      active: !!e,
      onLeave: ctx.leave.some(
        (l) => str(l.employeeId) === id && covers(l, date),
      ),
      available: shifts.length
        ? worksToday
        : s.assignment.pool !== 'shift' && !!e,
      workloadMinutes: workload.get(id) || 0,
    };
  });
}
function countMatches(rule: Rule, start: LocalDate, until: LocalDate) {
  let n = 0;
  const end = daysBetween(start, until) > 3700 ? addDays(start, 3700) : until;
  for (let d = start; d < end; d = addDays(d, 1))
    if (matches(rule, start, d)) n++;
  return n;
}

export type RunOptions = {
  mode: 'manual' | 'server';
  now?: Date;
  /** Days ahead to generate (default 7). */
  horizonDays?: number;
  /** Days behind to recover missed occurrences (default 30). */
  recoverDays?: number;
  onlyScheduleId?: string;
  log?: (line: string) => void;
};
export type RunResult = Omit<
  SchedulerRun,
  'id' | 'actorUid' | 'startedAt' | 'finishedAt'
> & { runId: string };

/**
 * The scheduler. Runs identically in the browser ("Run now") and in the
 * trusted server job. Every occurrence is written at a deterministic ID inside
 * a transaction, so concurrent or repeated runs never duplicate tasks.
 */
export async function runScheduler(
  db: Firestore,
  c: string,
  uid: string,
  opts: RunOptions,
): Promise<RunResult> {
  const now = opts.now || new Date();
  const log = opts.log || (() => {});
  const horizon = opts.horizonDays ?? 7;
  const recover = opts.recoverDays ?? 30;
  const company = await getDoc(doc(db, 'companies', c));
  const companyTz = str(company.data()?.timeZone) || 'UTC';
  const runId = `${now
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(
      0,
      14,
    )}_${opts.mode}_${uid.slice(0, 8)}_${Math.random().toString(36).slice(2, 8)}`;
  const runRef = ref(db, c, 'schedulerRuns', runId);
  const result: RunResult = {
    runId,
    mode: opts.mode,
    status: 'ok',
    scheduleCount: 0,
    created: 0,
    existing: 0,
    unassigned: 0,
    notifications: 0,
    errors: [],
    windowFrom: '',
    windowTo: '',
  };
  const today = toLocal(now, companyTz).date;
  result.windowFrom = addDays(today, -recover);
  result.windowTo = addDays(today, horizon);
  await setDoc(runRef, {
    companyId: c,
    schemaVersion: 1,
    mode: opts.mode,
    actorUid: uid,
    startedAt: serverTimestamp(),
    finishedAt: null,
    status: 'running',
    scheduleCount: 0,
    created: 0,
    existing: 0,
    unassigned: 0,
    notifications: 0,
    errors: [],
    windowFrom: result.windowFrom,
    windowTo: result.windowTo,
  });
  const fail = (msg: string) => {
    if (result.errors.length < 20) result.errors.push(msg.slice(0, 300));
    log('ERROR ' + msg);
  };
  try {
    const schedules = (
      await getDocs(
        query(
          col(db, c, 'recurringSchedules'),
          where('status', '==', 'active'),
          limit(200),
        ),
      )
    ).docs
      .map((d) => ({ id: d.id, ...d.data() }) as Schedule)
      .filter((s) => !opts.onlyScheduleId || s.id === opts.onlyScheduleId);
    result.scheduleCount = schedules.length;
    const ctx = schedules.length ? await loadContext(db, c) : null;
    const admins = await adminUids(db, c);
    const workloadByDay = new Map<string, Map<string, number>>();
    const workloadFor = async (date: string, tz: string) => {
      const key = `${tz}|${date}`;
      let w = workloadByDay.get(key);
      if (w) return w;
      w = new Map();
      const from = zonedTimeToUtc(date, '00:00', tz);
      const to = zonedTimeToUtc(addDays(date, 1), '00:00', tz);
      const r = await getDocs(
        query(
          col(db, c, 'tasks'),
          where('dueAt', '>=', Timestamp.fromDate(from)),
          where('dueAt', '<', Timestamp.fromDate(to)),
          limit(1000),
        ),
      );
      for (const d of r.docs) {
        const t = d.data() as Task;
        if (!openStatuses.includes(t.status)) continue;
        for (const e of t.assigneeIds)
          w.set(e, (w.get(e) || 0) + (t.content?.estimatedMinutes || 30));
      }
      workloadByDay.set(key, w);
      return w;
    };
    for (const s of schedules) {
      try {
        const done = await runSchedule(s);
        await updateDoc(ref(db, c, 'recurringSchedules', s.id), {
          generatedThrough: done.through,
          lastRunAt: serverTimestamp(),
          lastRunStatus: 'ok',
          lastError: '',
          retryCount: 0,
          status: done.finished ? 'completed' : 'active',
        });
      } catch (e) {
        const msg = `${s.code}: ${(e as Error).message}`;
        fail(msg);
        try {
          await updateDoc(ref(db, c, 'recurringSchedules', s.id), {
            lastRunAt: serverTimestamp(),
            lastRunStatus: 'error',
            lastError: msg.slice(0, 500),
            retryCount: (s.retryCount || 0) + 1,
          });
        } catch (inner) {
          fail(
            `${s.code}: could not record error (${(inner as Error).message})`,
          );
        }
      }
    }
    async function runSchedule(s: Schedule) {
      const site = ctx!.sites.get(s.siteId);
      const tz = s.timeZone || str(site?.timeZone) || companyTz;
      const plan = planOf({ ...s, timeZone: tz });
      const localToday = toLocal(now, tz).date;
      let from = addDays(localToday, -recover);
      if (s.generatedThrough && addDays(s.generatedThrough, 1) > from)
        from = addDays(s.generatedThrough, 1);
      if (s.startDate > from) from = s.startDate;
      let to = addDays(localToday, horizon);
      const finished = !!s.endDate && s.endDate <= to;
      if (s.endDate && s.endDate < to) to = s.endDate;
      if (from > to)
        return { through: s.generatedThrough || addDays(from, -1), finished };
      const version = await getDoc(ref(db, c, 'templateVersions', s.versionId));
      if (!version.exists() || version.data().state !== 'published')
        throw new Error(
          'The template version is no longer published. Edit the schedule and choose a published version.',
        );
      const content = version.data().content as VersionContent;
      const occurrences = planOccurrences(
        plan,
        from,
        to,
        holidaySet(ctx!, s.siteId),
      );
      let seq = countMatches(s.rule, s.startDate, from);
      let cursor = from;
      log(`${s.code}: ${occurrences.length} occurrence(s) ${from} → ${to}`);
      for (const occ of occurrences) {
        // Deterministic rotation index: number of rule dates before this one.
        for (; cursor < occ.ruleDate; cursor = addDays(cursor, 1))
          if (matches(s.rule, s.startDate, cursor)) seq++;
        const id = occurrenceTaskId(occ.key);
        const taskRef = ref(db, c, 'tasks', id);
        let assignee: string | null = null;
        let reason = 'Unassigned by schedule';
        if (s.assignment.strategy !== 'unassigned') {
          const workload = await workloadFor(occ.date, tz);
          const pick = resolveAssignee(
            candidatesFor(ctx!, s, occ.date, workload),
            s.assignment.strategy,
            seq,
            s.assignment.employeeIds,
          );
          assignee = pick.employeeId;
          reason = pick.reason;
        }
        const created = await runTransaction(db, async (tx) => {
          const existing = await tx.get(taskRef);
          if (existing.exists()) return false;
          const status: TaskStatus = assignee ? 'assigned' : 'pending';
          const assigneeIds = assignee ? [assignee] : [];
          tx.set(taskRef, {
            companyId: c,
            schemaVersion: 1,
            reference: taskReference(),
            title: s.name.slice(0, 160),
            templateId: s.templateId,
            versionId: s.versionId,
            version: version.data().version,
            content,
            approvalRequired: content.approvalRequired,
            priority: s.priority,
            siteId: s.siteId,
            locationId: s.locationId,
            facilityId: s.facilityId,
            assetId: s.assetId,
            departmentId: s.departmentId,
            assigneeIds,
            teamId: s.assignment.pool === 'team' ? s.assignment.refId : '',
            notes: s.notes.slice(0, 2000),
            plannedStart: Timestamp.fromDate(occ.plannedAt),
            dueAt: Timestamp.fromDate(occ.dueAt),
            status,
            attempt: 1,
            draftAnswers: {},
            occurrenceKey: occ.key,
            scheduleId: s.id,
            origin: s.purpose === 'maintenance' ? 'maintenance' : 'schedule',
            cancelReason: '',
            exceptionCount: 0,
            evidencePending: false,
            completedAt: null,
            createdAt: serverTimestamp(),
            createdBy: uid,
            updatedAt: serverTimestamp(),
            updatedBy: uid,
            revision: 1,
          });
          tx.set(
            ref(db, c, 'taskEvents', `${id}_1`),
            event(
              c,
              id,
              1,
              'create',
              '',
              status,
              uid,
              `Generated by the ${opts.mode === 'server' ? 'server' : 'manual'} scheduler for ${occ.date}${occ.moved ? ` (moved from ${occ.ruleDate})` : ''}. Assignment: ${reason}.`,
              assigneeIds,
              1,
            ),
          );
          return true;
        });
        if (!created) {
          result.existing++;
          continue;
        }
        result.created++;
        if (!assignee) result.unassigned++;
        else {
          const w = await workloadFor(occ.date, tz);
          w.set(
            assignee,
            (w.get(assignee) || 0) + (content.estimatedMinutes || 30),
          );
          result.notifications += await notify(
            db,
            c,
            uid,
            await linkedUids(db, c, [assignee]),
            {
              type: 'task_assigned',
              recordKind: 'tasks',
              recordId: id,
              eventKey: 'r1',
              body: `${s.name} — ${occ.date} ${s.localTime}`,
            },
          );
        }
        if (s.purpose === 'maintenance' && occ.date <= addDays(localToday, 1))
          result.notifications += await notify(db, c, uid, admins, {
            type: 'maintenance_due',
            recordKind: 'tasks',
            recordId: id,
            eventKey: 'due',
            body: `${s.name} is due ${occ.date} ${s.localTime}`,
          });
      }
      return { through: to, finished };
    }
    if (!opts.onlyScheduleId)
      result.notifications += await dueNotifications(db, c, uid, now, admins);
  } catch (e) {
    fail((e as Error).message);
    result.status = 'error';
  }
  if (result.status !== 'error' && result.errors.length)
    result.status = 'partial';
  await updateDoc(runRef, {
    status: result.status,
    finishedAt: serverTimestamp(),
    scheduleCount: result.scheduleCount,
    created: result.created,
    existing: result.existing,
    unassigned: result.unassigned,
    notifications: result.notifications,
    errors: result.errors,
  });
  log(
    `Run ${runId}: ${result.status}, created ${result.created}, existing ${result.existing}, unassigned ${result.unassigned}, notifications ${result.notifications}`,
  );
  return result;
}

/** Due-soon, overdue and SLA-breach notifications from stored timestamps. */
async function dueNotifications(
  db: Firestore,
  c: string,
  uid: string,
  now: Date,
  admins: string[],
) {
  let sent = 0;
  const window = async (fromMs: number, toMs: number) =>
    (
      await getDocs(
        query(
          col(db, c, 'tasks'),
          where('dueAt', '>=', Timestamp.fromMillis(fromMs)),
          where('dueAt', '<', Timestamp.fromMillis(toMs)),
          limit(300),
        ),
      )
    ).docs
      .map((d) => ({ id: d.id, ...d.data() }) as Task)
      .filter(
        (t) =>
          openStatuses.includes(t.status) && t.status !== 'awaiting_approval',
      );
  const t0 = now.getTime();
  for (const t of await window(t0, t0 + 2 * 3600000))
    sent += await notify(db, c, uid, await linkedUids(db, c, t.assigneeIds), {
      type: 'task_due_soon',
      recordKind: 'tasks',
      recordId: t.id,
      eventKey: String(t.dueAt.toMillis()),
      body: `${t.reference} ${t.title} is due soon`,
    });
  for (const t of await window(t0 - 24 * 3600000, t0)) {
    const people = await linkedUids(db, c, t.assigneeIds);
    sent += await notify(db, c, uid, people.length ? people : admins, {
      type: 'task_overdue',
      recordKind: 'tasks',
      recordId: t.id,
      eventKey: String(t.dueAt.toMillis()),
      body: `${t.reference} ${t.title} is overdue`,
    });
  }
  for (const kind of caseKinds) {
    const r = await getDocs(
      query(
        col(db, c, kind),
        where('status', 'in', caseDefinitions[kind].open),
        where('resolutionDueAt', '<', Timestamp.fromDate(now)),
        orderBy('resolutionDueAt'),
        limit(100),
      ),
    );
    for (const d of r.docs)
      sent += await notify(db, c, uid, admins, {
        type: 'sla_breach',
        recordKind: kind,
        recordId: d.id,
        eventKey: 'resolution',
        body: `${d.data().number} ${d.data().title} has passed its resolution target`,
      });
  }
  return sent;
}

export async function listRuns(db: Firestore, c: string, max = 20) {
  const r = await getDocs(
    query(
      col(db, c, 'schedulerRuns'),
      orderBy('startedAt', 'desc'),
      limit(max),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as SchedulerRun);
}
