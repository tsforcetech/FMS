import { describe, it, expect } from 'vitest';
import {
  addBusinessMinutes,
  describeRule,
  makeRule,
  matches,
  nextOccurrence,
  occurrenceKeyFor,
  occurrenceTaskId,
  pickPolicy,
  planOccurrences,
  resolveAssignee,
  shiftMinutes,
  slaDue,
  slaState,
  toLocal,
  zonedTimeToUtc,
  type Candidate,
  type Rule,
  type SchedulePlan,
  type SlaPolicy,
} from './schedule';
import {
  availableActions,
  canDo,
  caseDefinitions,
  linkedCaseId,
  notificationId,
} from './cases';

const plan = (
  rule: Partial<Rule>,
  over: Partial<SchedulePlan> = {},
): SchedulePlan => ({
  id: 'sch1',
  rule: makeRule(rule),
  ruleVersion: 1,
  startDate: '2026-01-01',
  endDate: '',
  localTime: '08:00',
  durationMinutes: 60,
  timeZone: 'Asia/Dubai',
  workingDays: [],
  holidayPolicy: 'generate',
  ...over,
});
const dates = (
  p: SchedulePlan,
  from: string,
  to: string,
  holidays?: Set<string>,
) => planOccurrences(p, from, to, holidays).map((o) => o.date);

describe('recurrence rules', () => {
  it('daily, every N days and alternate days', () => {
    expect(
      dates(plan({ type: 'daily', interval: 1 }), '2026-01-01', '2026-01-03'),
    ).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
    expect(
      dates(plan({ type: 'daily', interval: 2 }), '2026-01-01', '2026-01-07'),
    ).toEqual(['2026-01-01', '2026-01-03', '2026-01-05', '2026-01-07']);
    // Alternate-day parity stays anchored to the start date, not the query window.
    expect(
      dates(plan({ type: 'daily', interval: 2 }), '2026-01-02', '2026-01-06'),
    ).toEqual(['2026-01-03', '2026-01-05']);
    expect(
      dates(plan({ type: 'daily', interval: 3 }), '2026-01-01', '2026-01-10'),
    ).toEqual(['2026-01-01', '2026-01-04', '2026-01-07', '2026-01-10']);
  });
  it('weekdays, selected days and every N weeks', () => {
    // 2026-01-05 is a Monday.
    expect(
      dates(plan({ type: 'weekdays' }), '2026-01-03', '2026-01-09'),
    ).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
    ]);
    expect(
      dates(
        plan({ type: 'weekly', interval: 1, weekdays: [1, 5] }),
        '2026-01-05',
        '2026-01-18',
      ),
    ).toEqual(['2026-01-05', '2026-01-09', '2026-01-12', '2026-01-16']);
    expect(
      dates(
        plan(
          { type: 'weekly', interval: 2, weekdays: [1] },
          { startDate: '2026-01-05' },
        ),
        '2026-01-05',
        '2026-02-02',
      ),
    ).toEqual(['2026-01-05', '2026-01-19', '2026-02-02']);
  });
  it('monthly dates, month-end overflow, quarterly and nth weekday', () => {
    const p31 = plan(
      {
        type: 'monthly_dates',
        interval: 1,
        monthDays: [31],
        overflow: 'last_day',
      },
      { startDate: '2026-01-31' },
    );
    expect(dates(p31, '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    const skip = plan(
      { type: 'monthly_dates', interval: 1, monthDays: [31], overflow: 'skip' },
      { startDate: '2026-01-31' },
    );
    expect(dates(skip, '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-03-31',
    ]);
    expect(
      dates(
        plan({ type: 'monthly_dates', interval: 1, monthDays: [-1] }),
        '2026-02-01',
        '2026-02-28',
      ),
    ).toEqual(['2026-02-28']);
    expect(
      dates(
        plan({ type: 'monthly_dates', interval: 3, monthDays: [15] }),
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15']);
    // First Friday and last Monday.
    expect(
      dates(
        plan({ type: 'monthly_nth', interval: 1, nth: 1, nthWeekday: 5 }),
        '2026-01-01',
        '2026-03-31',
      ),
    ).toEqual(['2026-01-02', '2026-02-06', '2026-03-06']);
    expect(
      dates(
        plan({ type: 'monthly_nth', interval: 1, nth: -1, nthWeekday: 1 }),
        '2026-01-01',
        '2026-02-28',
      ),
    ).toEqual(['2026-01-26', '2026-02-23']);
  });
  it('handles leap years for yearly and month-end rules', () => {
    const feb29 = plan(
      { type: 'yearly', interval: 1, month: 2, day: 29, overflow: 'last_day' },
      { startDate: '2027-01-01' },
    );
    expect(dates(feb29, '2027-01-01', '2028-12-31')).toEqual([
      '2027-02-28',
      '2028-02-29',
    ]);
    const leapSkip = plan(
      { type: 'yearly', interval: 1, month: 2, day: 29, overflow: 'skip' },
      { startDate: '2027-01-01' },
    );
    expect(dates(leapSkip, '2027-01-01', '2028-12-31')).toEqual(['2028-02-29']);
    expect(
      dates(
        plan({ type: 'monthly_dates', interval: 1, monthDays: [-1] }),
        '2028-02-01',
        '2028-02-29',
      ),
    ).toEqual(['2028-02-29']);
  });
  it('respects one-time, end dates and describes rules for people', () => {
    expect(
      dates(
        plan({ type: 'once' }, { startDate: '2026-03-03' }),
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-03-03']);
    expect(
      dates(
        plan({ type: 'daily', interval: 1 }, { endDate: '2026-01-02' }),
        '2026-01-01',
        '2026-01-31',
      ),
    ).toEqual(['2026-01-01', '2026-01-02']);
    expect(
      describeRule(
        makeRule({ type: 'monthly_nth', nth: 1, nthWeekday: 5, interval: 1 }),
      ),
    ).toBe('First Friday of every month');
    expect(describeRule(makeRule({ type: 'daily', interval: 2 }))).toBe(
      'Alternate days',
    );
    expect(
      describeRule(
        makeRule({ type: 'monthly_dates', interval: 3, monthDays: [1] }),
      ),
    ).toBe('Quarterly on day 1');
    expect(
      matches(makeRule({ type: 'daily' }), '2026-01-10', '2026-01-09'),
    ).toBe(false);
  });
});

describe('time zones and daylight saving', () => {
  it('converts site-local times to UTC', () => {
    expect(
      zonedTimeToUtc('2026-03-01', '08:00', 'Asia/Dubai').toISOString(),
    ).toBe('2026-03-01T04:00:00.000Z');
    expect(
      zonedTimeToUtc('2026-07-01', '08:00', 'America/New_York').toISOString(),
    ).toBe('2026-07-01T12:00:00.000Z');
    expect(
      zonedTimeToUtc('2026-01-15', '08:00', 'America/New_York').toISOString(),
    ).toBe('2026-01-15T13:00:00.000Z');
  });
  it('moves times in a spring-forward gap forward and uses the first of a repeated hour', () => {
    // New York skips 02:00–03:00 on 2026-03-08 and repeats 01:00–02:00 on 2026-11-01.
    const gap = zonedTimeToUtc('2026-03-08', '02:30', 'America/New_York');
    expect(toLocal(gap, 'America/New_York')).toEqual({
      date: '2026-03-08',
      time: '03:30',
    });
    const overlap = zonedTimeToUtc('2026-11-01', '01:30', 'America/New_York');
    expect(overlap.toISOString()).toBe('2026-11-01T05:30:00.000Z');
    // A daily 08:00 schedule stays at 08:00 local across both transitions.
    const p = plan(
      { type: 'daily', interval: 1 },
      { timeZone: 'America/New_York' },
    );
    for (const o of planOccurrences(p, '2026-03-07', '2026-03-09').concat(
      planOccurrences(p, '2026-10-31', '2026-11-02'),
    ))
      expect(toLocal(o.plannedAt, 'America/New_York').time).toBe('08:00');
  });
});

describe('occurrence identity and holidays', () => {
  it('produces the same deterministic key for the same intended occurrence', () => {
    const p = plan({ type: 'daily', interval: 1 });
    const a = planOccurrences(p, '2026-01-01', '2026-01-05');
    const b = planOccurrences(p, '2026-01-03', '2026-01-05');
    expect(b.map((o) => o.key)).toEqual(a.slice(2).map((o) => o.key));
    expect(occurrenceKeyFor(p, '2026-01-03')).toBe('sch1_r1_202601030800');
    expect(occurrenceTaskId('sch1_r1_202601030800')).toBe(
      'occ_sch1_r1_202601030800',
    );
    // A rule edit (new version) produces new keys, so edited schedules never collide with old ones.
    expect(occurrenceKeyFor({ ...p, ruleVersion: 2 }, '2026-01-03')).not.toBe(
      occurrenceKeyFor(p, '2026-01-03'),
    );
  });
  it('skips, moves or keeps occurrences on holidays and non-working days', () => {
    const holidays = new Set(['2026-01-06']);
    const base = plan(
      { type: 'daily', interval: 1 },
      { workingDays: [1, 2, 3, 4, 5] },
    );
    expect(
      dates(
        { ...base, holidayPolicy: 'skip' },
        '2026-01-05',
        '2026-01-11',
        holidays,
      ),
    ).toEqual(['2026-01-05', '2026-01-07', '2026-01-08', '2026-01-09']);
    const moved = planOccurrences(
      { ...base, holidayPolicy: 'next_working_day' },
      '2026-01-09',
      '2026-01-10',
      holidays,
    );
    expect(moved.map((o) => [o.ruleDate, o.date, o.moved])).toEqual([
      ['2026-01-09', '2026-01-09', false],
      ['2026-01-10', '2026-01-12', true],
    ]);
    expect(
      dates(
        { ...base, holidayPolicy: 'generate' },
        '2026-01-06',
        '2026-01-06',
        holidays,
      ),
    ).toEqual(['2026-01-06']);
    expect(
      nextOccurrence(
        plan({ type: 'yearly', interval: 1, month: 6, day: 1 }),
        '2026-02-01',
      )?.date,
    ).toBe('2026-06-01');
  });
});

describe('assignment engine', () => {
  const c = (id: string, over: Partial<Candidate> = {}): Candidate => ({
    employeeId: id,
    active: true,
    onLeave: false,
    available: true,
    workloadMinutes: 0,
    ...over,
  });
  it('never assigns employees on leave, off shift or inactive, and queues when nobody is eligible', () => {
    const pool = [
      c('a', { onLeave: true }),
      c('b', { available: false }),
      c('c', { active: false }),
    ];
    expect(resolveAssignee(pool, 'least_workload')).toEqual({
      employeeId: null,
      reason: 'No eligible employee (leave, shift or inactive)',
    });
    expect(resolveAssignee([], 'round_robin').employeeId).toBe(null);
    expect(resolveAssignee([...pool, c('d')], 'fixed').employeeId).toBe('d');
  });
  it('rotates deterministically and balances by planned minutes', () => {
    const pool = [c('b'), c('a'), c('c')];
    expect(
      [0, 1, 2, 3].map(
        (n) => resolveAssignee(pool, 'round_robin', n).employeeId,
      ),
    ).toEqual(['a', 'b', 'c', 'a']);
    expect(
      resolveAssignee(
        [c('a', { workloadMinutes: 120 }), c('b', { workloadMinutes: 30 })],
        'least_workload',
      ).employeeId,
    ).toBe('b');
    expect(
      resolveAssignee([c('a'), c('b')], 'fixed', 0, ['b', 'a']).employeeId,
    ).toBe('b');
    expect(shiftMinutes('22:00', '06:00', 30)).toBe(450);
    expect(shiftMinutes('08:00', '17:00', 60)).toBe(480);
  });
});

describe('SLA calculations', () => {
  const cal = {
    timeZone: 'Asia/Dubai',
    workingDays: [1, 2, 3, 4, 5],
    opensAt: '08:00',
    closesAt: '17:00',
    holidays: new Set(['2026-11-17']),
  };
  it('adds business minutes across evenings, weekends and holidays', () => {
    // Friday 16:00 + 2h → Monday 09:00 (Dubai, UTC+4).
    expect(
      addBusinessMinutes(
        new Date('2026-11-13T12:00:00Z'),
        120,
        cal,
      ).toISOString(),
    ).toBe('2026-11-16T05:00:00.000Z');
    // Monday 16:30 + 1h, Tuesday is a holiday → Wednesday 08:30.
    expect(
      addBusinessMinutes(
        new Date('2026-11-16T12:30:00Z'),
        60,
        cal,
      ).toISOString(),
    ).toBe('2026-11-18T04:30:00.000Z');
  });
  it('picks the most specific policy and reports breaches from stored timestamps', () => {
    const base: SlaPolicy = {
      id: 'g',
      priority: 'critical',
      appliesTo: 'all',
      siteId: '',
      departmentId: '',
      responseMinutes: 30,
      resolutionMinutes: 240,
      hoursMode: 'calendar',
    };
    const site: SlaPolicy = {
      ...base,
      id: 's',
      siteId: 'site1',
      responseMinutes: 15,
    };
    expect(
      pickPolicy([base, site], {
        priority: 'critical',
        kind: 'workOrders',
        siteId: 'site1',
        departmentId: '',
      })?.id,
    ).toBe('s');
    expect(
      pickPolicy([base, site], {
        priority: 'critical',
        kind: 'workOrders',
        siteId: 'other',
        departmentId: '',
      })?.id,
    ).toBe('g');
    expect(
      pickPolicy([base], {
        priority: 'low',
        kind: 'workOrders',
        siteId: '',
        departmentId: '',
      }),
    ).toBe(null);
    const reported = new Date('2026-11-14T10:00:00Z');
    const due = slaDue(base, reported, cal);
    expect(due.responseDueAt.toISOString()).toBe('2026-11-14T10:30:00.000Z');
    expect(
      slaState(due.responseDueAt, new Date('2026-11-14T10:20:00Z')),
    ).toEqual({ breached: false, overdueMinutes: 0, met: true });
    expect(
      slaState(due.responseDueAt, new Date('2026-11-14T10:45:00Z'))
        .overdueMinutes,
    ).toBe(15);
    expect(
      slaState(due.resolutionDueAt, null, new Date('2026-11-14T15:00:00Z'))
        .breached,
    ).toBe(true);
  });
});

describe('case workflows', () => {
  it('enforces work order, complaint and escalation transitions', () => {
    expect(canDo('workOrders', 'start', 'assigned')).toBe(true);
    expect(canDo('workOrders', 'close', 'in_progress')).toBe(false);
    expect(canDo('workOrders', 'reopen', 'closed')).toBe(true);
    expect(caseDefinitions.workOrders.actions.cancel.reason).toBe(true);
    expect(availableActions('complaints', 'open').map((a) => a.id)).toEqual([
      'assign',
      'cancel',
    ]);
    expect(canDo('escalations', 'reassign', 'acknowledged')).toBe(true);
    expect(canDo('escalations', 'close', 'raised')).toBe(false);
  });
  it('creates deterministic linked IDs and notification IDs', () => {
    expect(linkedCaseId('workOrders', 'task_exception', 'ex1')).toBe(
      'wo_task_exception_ex1',
    );
    expect(linkedCaseId('workOrders', 'task_exception', 'ex1')).toBe(
      linkedCaseId('workOrders', 'task_exception', 'ex1'),
    );
    expect(notificationId('task_assigned', 't1', '3', 'u1')).toBe(
      'task_assigned_t1_3_u1',
    );
    expect(notificationId('task_assigned', 't1', 'x'.repeat(200), 'u1')).toBe(
      notificationId('task_assigned', 't1', 'x'.repeat(200), 'u1'),
    );
  });
});
