import { z } from 'zod';

/**
 * Phase 4 scheduling engine. Pure functions only (no Firebase), shared by the
 * browser fallback runner and the trusted server scheduler so both produce
 * identical occurrences and keys.
 */

/* ------------------------------------------------------------ rules */
export const recurrenceTypes = [
  'once',
  'daily',
  'weekdays',
  'weekly',
  'monthly_dates',
  'monthly_nth',
  'yearly',
] as const;
export type RecurrenceType = (typeof recurrenceTypes)[number];
export const ruleSchema = z
  .object({
    type: z.enum(recurrenceTypes),
    /** Every N days / weeks / months / years. */
    interval: z.number().int().min(1).max(365),
    /** 0 = Sunday … 6 = Saturday (weekly). */
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    /** 1–31, or -1 for the last day of the month (monthly_dates). */
    monthDays: z.array(z.number().int().min(-1).max(31)).max(31),
    /** 1–4, or -1 for the last (monthly_nth). */
    nth: z.number().int().min(-1).max(4),
    nthWeekday: z.number().int().min(0).max(6),
    /** Yearly month (1–12) and day (1–31). */
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    /** When a configured day does not exist (e.g. 31 Feb): skip or use the last day. */
    overflow: z.enum(['skip', 'last_day']),
  })
  .strict();
export type Rule = z.infer<typeof ruleSchema>;
export const presets: Record<string, { label: string; rule: Partial<Rule> }> = {
  once: { label: 'One time', rule: { type: 'once' } },
  daily: { label: 'Every day', rule: { type: 'daily', interval: 1 } },
  alternate: { label: 'Alternate days', rule: { type: 'daily', interval: 2 } },
  every_n_days: { label: 'Every N days', rule: { type: 'daily', interval: 3 } },
  weekdays: { label: 'Every weekday (Mon–Fri)', rule: { type: 'weekdays' } },
  selected_days: {
    label: 'Selected weekdays',
    rule: { type: 'weekly', interval: 1, weekdays: [1, 3, 5] },
  },
  weekly: { label: 'Weekly', rule: { type: 'weekly', interval: 1 } },
  every_n_weeks: {
    label: 'Every N weeks',
    rule: { type: 'weekly', interval: 2 },
  },
  monthly: {
    label: 'Monthly (date)',
    rule: { type: 'monthly_dates', interval: 1, monthDays: [1] },
  },
  monthly_nth: {
    label: 'Monthly (e.g. first Friday)',
    rule: { type: 'monthly_nth', interval: 1, nth: 1, nthWeekday: 5 },
  },
  quarterly: {
    label: 'Quarterly',
    rule: { type: 'monthly_dates', interval: 3, monthDays: [1] },
  },
  half_yearly: {
    label: 'Half-yearly',
    rule: { type: 'monthly_dates', interval: 6, monthDays: [1] },
  },
  yearly: { label: 'Yearly', rule: { type: 'yearly', interval: 1 } },
};
export function makeRule(partial: Partial<Rule> = {}): Rule {
  return {
    type: 'daily',
    interval: 1,
    weekdays: [1],
    monthDays: [1],
    nth: 1,
    nthWeekday: 1,
    month: 1,
    day: 1,
    overflow: 'last_day',
    ...partial,
  };
}
const dayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const ordinals: Record<number, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  [-1]: 'last',
};
const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const every = (n: number, unit: string) =>
  n === 1
    ? `Every ${unit}`
    : n === 2 && unit === 'day'
      ? 'Alternate days'
      : `Every ${n} ${unit}s`;
/** Human-readable description of a rule, e.g. "First Friday of every 3 months". */
export function describeRule(r: Rule) {
  switch (r.type) {
    case 'once':
      return 'One time';
    case 'daily':
      return every(r.interval, 'day');
    case 'weekdays':
      return 'Every weekday (Mon–Fri)';
    case 'weekly':
      return `${every(r.interval, 'week')} on ${
        [...r.weekdays]
          .sort()
          .map((d) => dayNames[d].slice(0, 3))
          .join(', ') || '—'
      }`;
    case 'monthly_dates': {
      const days = r.monthDays
        .map((d) => (d === -1 ? 'last day' : `day ${d}`))
        .join(', ');
      const unit =
        r.interval === 3
          ? 'Quarterly'
          : r.interval === 6
            ? 'Half-yearly'
            : every(r.interval, 'month');
      return `${unit} on ${days}`;
    }
    case 'monthly_nth':
      return `${ordinals[r.nth][0].toUpperCase() + ordinals[r.nth].slice(1)} ${dayNames[r.nthWeekday]} of ${r.interval === 1 ? 'every month' : `every ${r.interval} months`}`;
    case 'yearly':
      return `${r.interval === 1 ? 'Every year' : `Every ${r.interval} years`} on ${r.day} ${months[r.month - 1]}`;
  }
}

/* ------------------------------------------------------------ dates (UTC-safe local dates) */
export type LocalDate = string; // YYYY-MM-DD
const toUtcDay = (d: LocalDate) =>
  Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export function addDays(d: LocalDate, n: number): LocalDate {
  return new Date(toUtcDay(d) + n * 86400000).toISOString().slice(0, 10);
}
export function daysBetween(a: LocalDate, b: LocalDate) {
  return Math.round((toUtcDay(b) - toUtcDay(a)) / 86400000);
}
export function weekday(d: LocalDate) {
  return new Date(toUtcDay(d)).getUTCDay();
}
export function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
const monthsBetween = (a: LocalDate, b: LocalDate) =>
  (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
const mondayOf = (d: LocalDate) => addDays(d, -((weekday(d) + 6) % 7));
/** True when the rule (anchored at `start`) produces an occurrence on `date`. */
export function matches(rule: Rule, start: LocalDate, date: LocalDate) {
  if (date < start) return false;
  const y = +date.slice(0, 4),
    m = +date.slice(5, 7),
    day = +date.slice(8, 10),
    dow = weekday(date),
    last = lastDayOfMonth(y, m);
  switch (rule.type) {
    case 'once':
      return date === start;
    case 'daily':
      return daysBetween(start, date) % rule.interval === 0;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekly':
      return (
        rule.weekdays.includes(dow) &&
        (daysBetween(mondayOf(start), mondayOf(date)) / 7) % rule.interval === 0
      );
    case 'monthly_dates':
      if (monthsBetween(start, date) % rule.interval !== 0) return false;
      return rule.monthDays.some(
        (md) =>
          md === day ||
          (md === -1 && day === last) ||
          (rule.overflow === 'last_day' && md > last && day === last),
      );
    case 'monthly_nth':
      if (
        monthsBetween(start, date) % rule.interval !== 0 ||
        dow !== rule.nthWeekday
      )
        return false;
      return rule.nth === -1 ? day + 7 > last : Math.ceil(day / 7) === rule.nth;
    case 'yearly':
      if (m !== rule.month || (y - +start.slice(0, 4)) % rule.interval !== 0)
        return false;
      return (
        day === rule.day ||
        (rule.overflow === 'last_day' && rule.day > last && day === last)
      );
  }
}

/* ------------------------------------------------------------ time zones */
const formatters = new Map<string, Intl.DateTimeFormat>();
function parts(instant: number, tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(tz, f);
  }
  const p = Object.fromEntries(
    f.formatToParts(new Date(instant)).map((x) => [x.type, x.value]),
  );
  return {
    y: +p.year,
    mo: +p.month,
    d: +p.day,
    h: +p.hour,
    mi: +p.minute,
    s: +p.second,
  };
}
/** Offset in minutes (local − UTC) of a time zone at an instant. */
export function zoneOffset(instant: number, tz: string) {
  const p = parts(instant, tz);
  return Math.round(
    (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) -
      Math.floor(instant / 1000) * 1000) /
      60000,
  );
}
/** Local calendar date and time of an instant in a zone. */
export function toLocal(instant: Date, tz: string) {
  const p = parts(instant.getTime(), tz);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`,
    time: `${pad(p.h)}:${pad(p.mi)}`,
  };
}
/**
 * Converts a local wall-clock time to a UTC instant. DST policy:
 * a time skipped by a spring-forward gap moves forward by the gap length;
 * a repeated time in a fall-back overlap uses the first (earlier) occurrence.
 */
export function zonedTimeToUtc(
  date: LocalDate,
  time: string,
  tz: string,
): Date {
  const guess = Date.UTC(
    +date.slice(0, 4),
    +date.slice(5, 7) - 1,
    +date.slice(8, 10),
    +time.slice(0, 2),
    +time.slice(3, 5),
  );
  const offsets = [
    ...new Set([
      zoneOffset(guess - 86400000, tz),
      zoneOffset(guess, tz),
      zoneOffset(guess + 86400000, tz),
    ]),
  ];
  const candidates = offsets.map((o) => guess - o * 60000);
  const exact = candidates.filter((c) => {
    const l = toLocal(new Date(c), tz);
    return l.date === date && l.time === time;
  });
  if (exact.length) return new Date(Math.min(...exact));
  return new Date(Math.max(...candidates)); // inside a gap: shift forward
}

/* ------------------------------------------------------------ occurrences */
export const holidayPolicies = [
  'skip',
  'next_working_day',
  'generate',
] as const;
export type HolidayPolicy = (typeof holidayPolicies)[number];
export type SchedulePlan = {
  id: string;
  rule: Rule;
  ruleVersion: number;
  startDate: LocalDate;
  endDate: LocalDate; // '' = open-ended
  localTime: string; // HH:mm
  durationMinutes: number;
  timeZone: string;
  /** 0–6 weekdays the site works; empty = every day. */
  workingDays: number[];
  holidayPolicy: HolidayPolicy;
};
export type Occurrence = {
  key: string;
  /** The rule's intended date (stable identity, used in the key). */
  ruleDate: LocalDate;
  /** Actual local date after holiday/non-working-day handling. */
  date: LocalDate;
  plannedAt: Date;
  dueAt: Date;
  /** Ordinal used for deterministic round-robin assignment. */
  ordinal: number;
  moved: boolean;
};
/** Deterministic occurrence key: schedule + rule version + intended local date/time. */
export function occurrenceKeyFor(
  p: Pick<SchedulePlan, 'id' | 'ruleVersion' | 'localTime'>,
  ruleDate: LocalDate,
) {
  return `${p.id}_r${p.ruleVersion}_${ruleDate.replaceAll('-', '')}${p.localTime.replace(':', '')}`;
}
export function occurrenceTaskId(key: string) {
  return ('occ_' + key).slice(0, 128);
}
/** Plans occurrences whose rule date falls in [from, to] (inclusive local dates). */
export function planOccurrences(
  p: SchedulePlan,
  from: LocalDate,
  to: LocalDate,
  holidays: Set<LocalDate> = new Set(),
) {
  const out: Occurrence[] = [];
  const first = from > p.startDate ? from : p.startDate;
  const last = p.endDate && p.endDate < to ? p.endDate : to;
  if (daysBetween(first, last) > 800)
    throw new Error('Planning window too large');
  const isOff = (d: LocalDate) =>
    holidays.has(d) ||
    (p.workingDays.length > 0 && !p.workingDays.includes(weekday(d)));
  for (let d = first; d <= last; d = addDays(d, 1)) {
    if (!matches(p.rule, p.startDate, d)) continue;
    let date = d;
    if (isOff(d)) {
      if (p.holidayPolicy === 'skip') continue;
      if (p.holidayPolicy === 'next_working_day') {
        let n = 0;
        while (isOff(date) && n++ < 14) date = addDays(date, 1);
        if (isOff(date)) continue;
      }
    }
    const plannedAt = zonedTimeToUtc(date, p.localTime, p.timeZone);
    out.push({
      key: occurrenceKeyFor(p, d),
      ruleDate: d,
      date,
      plannedAt,
      dueAt: new Date(plannedAt.getTime() + p.durationMinutes * 60000),
      ordinal: daysBetween(p.startDate, d),
      moved: date !== d,
    });
  }
  return out;
}
/** Next occurrence on or after `from` (searches up to ~2 years). */
export function nextOccurrence(
  p: SchedulePlan,
  from: LocalDate,
  holidays?: Set<LocalDate>,
) {
  for (let start = from, i = 0; i < 8; i++, start = addDays(start, 100)) {
    const hit = planOccurrences(p, start, addDays(start, 99), holidays)[0];
    if (hit) return hit;
    if (p.endDate && addDays(start, 99) >= p.endDate) return null;
  }
  return null;
}

/* ------------------------------------------------------------ assignment */
export const assignmentStrategies = [
  'fixed',
  'round_robin',
  'least_workload',
] as const;
export type AssignmentStrategy = (typeof assignmentStrategies)[number];
export const assignmentPools = [
  'employee',
  'department',
  'designation',
  'team',
  'shift',
  'site',
] as const;
export type Candidate = {
  employeeId: string;
  active: boolean;
  onLeave: boolean;
  /** Has a shift (or no shift requirement) covering that weekday. */
  available: boolean;
  /** Assigned estimated minutes already planned that day. */
  workloadMinutes: number;
};
export function eligibleCandidates(candidates: Candidate[]) {
  return candidates
    .filter((c) => c.active && !c.onLeave && c.available)
    .sort((a, b) => a.employeeId.localeCompare(b.employeeId));
}
/**
 * Picks an assignee or returns null (unassigned queue). Never falls back to an
 * ineligible employee. Round-robin uses the occurrence ordinal so re-running
 * the same occurrence always picks the same person.
 */
export function resolveAssignee(
  candidates: Candidate[],
  strategy: AssignmentStrategy,
  ordinal = 0,
  fixedOrder: string[] = [],
): { employeeId: string | null; reason: string } {
  const eligible = eligibleCandidates(candidates);
  if (!eligible.length)
    return {
      employeeId: null,
      reason: candidates.length
        ? 'No eligible employee (leave, shift or inactive)'
        : 'No employees match the assignment rule',
    };
  if (strategy === 'fixed') {
    const ordered = fixedOrder.length
      ? fixedOrder
          .map((id) => eligible.find((c) => c.employeeId === id))
          .filter((c): c is Candidate => !!c)
      : eligible;
    return ordered[0]
      ? { employeeId: ordered[0].employeeId, reason: 'Fixed assignee' }
      : { employeeId: null, reason: 'Fixed assignee unavailable' };
  }
  if (strategy === 'round_robin')
    return {
      employeeId:
        eligible[
          ((ordinal % eligible.length) + eligible.length) % eligible.length
        ].employeeId,
      reason: 'Round-robin rotation',
    };
  const best = [...eligible].sort(
    (a, b) =>
      a.workloadMinutes - b.workloadMinutes ||
      a.employeeId.localeCompare(b.employeeId),
  )[0];
  return {
    employeeId: best.employeeId,
    reason: `Least workload (${best.workloadMinutes} min planned)`,
  };
}
/** Shift length in minutes, supporting overnight shifts. */
export function shiftMinutes(start: string, end: string, breakMinutes = 0) {
  const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  let span = toMin(end) - toMin(start);
  if (span <= 0) span += 1440;
  return Math.max(0, span - breakMinutes);
}

/* ------------------------------------------------------------ SLA */
export type BusinessCalendar = {
  timeZone: string;
  workingDays: number[]; // empty = every day
  opensAt: string; // '' = 00:00
  closesAt: string; // '' = 24:00
  holidays: Set<LocalDate>;
};
/** Adds working minutes inside business hours (site calendar), skipping holidays. */
export function addBusinessMinutes(
  start: Date,
  minutes: number,
  cal: BusinessCalendar,
) {
  let remaining = minutes;
  let cursor = start.getTime();
  let date = toLocal(start, cal.timeZone).date;
  for (let i = 0; i < 400; i++, date = addDays(date, 1)) {
    const working =
      !cal.holidays.has(date) &&
      (!cal.workingDays.length || cal.workingDays.includes(weekday(date)));
    if (!working) continue;
    const open = zonedTimeToUtc(
      date,
      cal.opensAt || '00:00',
      cal.timeZone,
    ).getTime();
    const close =
      !cal.closesAt || cal.closesAt <= (cal.opensAt || '00:00')
        ? zonedTimeToUtc(addDays(date, 1), '00:00', cal.timeZone).getTime()
        : zonedTimeToUtc(date, cal.closesAt, cal.timeZone).getTime();
    const from = Math.max(cursor, open);
    if (from >= close) continue;
    const available = (close - from) / 60000;
    if (remaining <= available) return new Date(from + remaining * 60000);
    remaining -= available;
    cursor = close;
  }
  throw new Error('Business calendar has no working time');
}
export type SlaPolicy = {
  id: string;
  priority: string;
  appliesTo: string; // 'all' | 'workOrders' | 'complaints' | 'escalations'
  siteId: string;
  departmentId: string;
  responseMinutes: number;
  resolutionMinutes: number;
  hoursMode: 'calendar' | 'business';
};
/** Most specific active policy: site+department > site > department > company-wide. */
export function pickPolicy(
  policies: SlaPolicy[],
  q: { priority: string; kind: string; siteId: string; departmentId: string },
) {
  const fits = policies.filter(
    (p) =>
      p.priority === q.priority &&
      (p.appliesTo === 'all' || p.appliesTo === q.kind) &&
      (!p.siteId || p.siteId === q.siteId) &&
      (!p.departmentId || p.departmentId === q.departmentId),
  );
  const score = (p: SlaPolicy) =>
    (p.siteId ? 2 : 0) +
    (p.departmentId ? 1 : 0) +
    (p.appliesTo === 'all' ? 0 : 0.5);
  return fits.sort((a, b) => score(b) - score(a))[0] || null;
}
export function slaDue(
  policy: SlaPolicy,
  reportedAt: Date,
  cal: BusinessCalendar,
) {
  const add = (m: number) =>
    policy.hoursMode === 'business'
      ? addBusinessMinutes(reportedAt, m, cal)
      : new Date(reportedAt.getTime() + m * 60000);
  return {
    responseDueAt: add(policy.responseMinutes),
    resolutionDueAt: add(policy.resolutionMinutes),
  };
}
/** Breach state from stored timestamps; an open item is breached once its due time has passed. */
export function slaState(
  due: Date | null,
  doneAt: Date | null,
  now = new Date(),
) {
  if (!due) return { breached: false, overdueMinutes: 0, met: false };
  const end = doneAt || now;
  const over = Math.round((end.getTime() - due.getTime()) / 60000);
  return {
    breached: over > 0,
    overdueMinutes: Math.max(0, over),
    met: !!doneAt && over <= 0,
  };
}

/* ------------------------------------------------------------ helpers */
const shortDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
/**
 * Parses free-text working days ("Mon-Fri", "Sun, Mon, Tue", "Sat–Thu") into
 * weekday numbers. Returns [] (every day) when the text is empty or unclear.
 */
export function parseWorkingDays(text: string | undefined | null): number[] {
  const t = (text || '').toLowerCase().replaceAll('–', '-').trim();
  if (!t || /every|daily|all|7 days/.test(t)) return [];
  const idx = (s: string) => shortDays.indexOf(s.trim().slice(0, 3));
  const out = new Set<number>();
  for (const part of t.split(/[,/;]|\s+and\s+/)) {
    const [a, b] = part.split('-');
    const from = idx(a || '');
    if (from < 0) continue;
    const to = b !== undefined ? idx(b) : from;
    if (to < 0) return [];
    for (let d = from, n = 0; n < 7; d = (d + 1) % 7, n++) {
      out.add(d);
      if (d === to) break;
    }
  }
  return [...out].sort((x, y) => x - y);
}
/** Moves a rule's day pattern by whole days (used by calendar drag and drop). */
export function shiftRule(rule: Rule, deltaDays: number): Rule {
  if (!deltaDays) return rule;
  const wrap = (n: number, m: number) => ((n % m) + m) % m;
  if (rule.type === 'weekly')
    return {
      ...rule,
      weekdays: [
        ...new Set(rule.weekdays.map((d) => wrap(d + deltaDays, 7))),
      ].sort((a, b) => a - b),
    };
  if (rule.type === 'monthly_dates')
    return {
      ...rule,
      monthDays: rule.monthDays.map((d) =>
        d > 0 && d + deltaDays >= 1 && d + deltaDays <= 31 ? d + deltaDays : d,
      ),
    };
  if (rule.type === 'monthly_nth')
    return { ...rule, nthWeekday: wrap(rule.nthWeekday + deltaDays, 7) };
  return rule;
}
