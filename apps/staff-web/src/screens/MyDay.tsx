import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck2, Clock3, Play, PartyPopper, Sun } from 'lucide-react';
import {
  isOverdue,
  parseWorkingDays,
  toLocal,
  weekday,
} from '@facilityos/shared';
import type { Task } from '@admin/management/tasksStore';
import {
  myOverdue,
  myShiftContext,
  myTasksBetween,
  myTasksByStatus,
} from '@admin/management/staffStore';
import { useStaff } from '../App';
import { useT } from '../i18n';
import {
  Empty,
  ErrorBox,
  Label,
  Loading,
  TaskCard,
  friendlyError,
  localDay,
  todayIn,
  workOrder,
} from './common';

type Shift = { name: string; start: string; end: string; days: string } | null;
export function useShiftToday() {
  const staff = useStaff();
  const [info, setInfo] = useState<{
    shift: Shift;
    leave: boolean;
    holiday: string;
  }>();
  useEffect(() => {
    let live = true;
    const date = todayIn(staff.timeZone);
    myShiftContext(
      staff.context.services.db,
      staff.companyId,
      staff.employee.id,
    )
      .then((ctx) => {
        const a = ctx.assignments.find(
          (x) =>
            (!x.startDate || x.startDate <= date) &&
            (!x.endDate || x.endDate >= date),
        );
        const sh = a && ctx.shifts.find((s) => s.id === a.shiftId);
        const days = sh ? parseWorkingDays(sh.workingDays) : [];
        const works = sh && (!days.length || days.includes(weekday(date)));
        const holiday = ctx.holidays.find(
          (h) =>
            h.holidayDate === date &&
            (!h.siteId ||
              staff.link.allSites ||
              staff.link.siteIds.includes(h.siteId)),
        );
        if (live)
          setInfo({
            shift:
              works && sh
                ? {
                    name: sh.name,
                    start: sh.startTime,
                    end: sh.endTime,
                    days: sh.workingDays,
                  }
                : null,
            leave: ctx.leave.some(
              (l) =>
                l.status !== 'planned' &&
                l.startDate <= date &&
                (l.endDate || l.startDate) >= date,
            ),
            holiday: holiday?.name || '',
          });
      })
      .catch(() => live && setInfo({ shift: null, leave: false, holiday: '' }));
    return () => {
      live = false;
    };
  }, [staff]);
  return info;
}

export function MyDay() {
  const staff = useStaff();
  const { t } = useT();
  const tz = staff.timeZone;
  const [data, setData] = useState<{
      today: Task[];
      overdue: Task[];
      rework: Task[];
      active: Task[];
    }>(),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  const shift = useShiftToday();
  useEffect(() => {
    let live = true;
    const db = staff.context.services.db,
      c = staff.companyId,
      e = staff.employee.id;
    const [from, to] = localDay(tz, todayIn(tz));
    Promise.all([
      myTasksBetween(db, c, e, from, to),
      myOverdue(db, c, e),
      myTasksByStatus(db, c, e, ['rework_required']),
      myTasksByStatus(db, c, e, ['in_progress', 'paused']),
    ])
      .then(([today, overdue, rework, active]) => {
        if (!live) return;
        setData({ today, overdue, rework, active });
        setError('');
      })
      .catch((err) => live && setError(friendlyError(err, t)));
    return () => {
      live = false;
    };
  }, [staff, tz, version, t]);
  const hour = +toLocal(new Date(), tz).time.slice(0, 2);
  const greet =
    hour < 12
      ? t('goodMorning')
      : hour < 17
        ? t('goodAfternoon')
        : t('goodEvening');
  const dateText = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: tz,
  });
  const all = data
    ? [
        ...new Map(
          [...data.overdue, ...data.active, ...data.rework, ...data.today].map(
            (x) => [x.id, x],
          ),
        ).values(),
      ]
    : [];
  const ordered = workOrder(all);
  const actionable = ordered.filter((x) =>
    [
      'assigned',
      'in_progress',
      'paused',
      'rework_required',
      'pending',
    ].includes(x.status),
  );
  const next = actionable[0];
  const counts = data && {
    assigned: data.today.length,
    pending: data.today.filter((x) =>
      ['pending', 'assigned'].includes(x.status),
    ).length,
    inProgress: all.filter((x) => ['in_progress', 'paused'].includes(x.status))
      .length,
    completed: data.today.filter((x) =>
      ['completed', 'awaiting_approval'].includes(x.status),
    ).length,
    overdue: all.filter((x) => isOverdue(x.status, x.dueAt.toDate())).length,
    rework: data.rework.length,
  };
  return (
    <div className="s-page">
      <section className="s-hero">
        <p className="s-hero-date">
          <Sun size={16} /> {dateText}
        </p>
        <h1>
          {greet}, {staff.employee.name.split(' ')[0]}
        </h1>
        <p className="s-hero-sub">
          {staff.employee.primarySiteId ? (
            <Label
              context={staff.context}
              kind="sites"
              id={staff.employee.primarySiteId}
            />
          ) : (
            staff.companyName
          )}
        </p>
        <div className="s-shift" aria-live="polite">
          <Clock3 size={18} />
          {!shift ? (
            <span>…</span>
          ) : shift.leave ? (
            <strong>{t('onLeave')}</strong>
          ) : shift.shift ? (
            <span>
              <strong>{t('shiftToday')}:</strong> {shift.shift.name} ·{' '}
              {shift.shift.start}–{shift.shift.end}
            </span>
          ) : (
            <span>{t('noShift')}</span>
          )}
          {shift?.holiday && (
            <span className="s-holiday">
              {t('holiday')}: {shift.holiday}
            </span>
          )}
        </div>
        {next && (
          <Link to={`/task/${next.id}`} className="btn btn-lg s-next">
            <Play size={20} />{' '}
            {['in_progress', 'paused'].includes(next.status)
              ? t('continueTask')
              : t('startNext')}
            <span className="s-next-title">{next.title}</span>
          </Link>
        )}
      </section>
      {error && (
        <ErrorBox error={error} onRetry={() => setVersion((v) => v + 1)} />
      )}
      {counts && (
        <section aria-label={t('todaysWork')} className="s-stats">
          {(
            [
              ['assigned', counts.assigned, 'blue', '/tasks?tab=today'],
              ['pending', counts.pending, 'gray', '/tasks?tab=today'],
              ['inProgress', counts.inProgress, 'violet', '/tasks?tab=active'],
              ['completed', counts.completed, 'green', '/tasks?tab=done'],
              ['overdue', counts.overdue, 'red', '/tasks?tab=overdue'],
              ['rework', counts.rework, 'amber', '/tasks?tab=rework'],
            ] as const
          ).map(([k, n, tone, to]) => (
            <Link
              key={k}
              to={to}
              className={'s-stat tone-' + tone + (n ? '' : ' zero')}
            >
              <strong>{n}</strong>
              <span>{t(k)}</span>
            </Link>
          ))}
        </section>
      )}
      {!!data?.rework.length && (
        <div className="s-banner rework" role="status">
          <strong>{t('workReturned')}</strong> — {data.rework.length} ×{' '}
          <Link to="/tasks?tab=rework">{t('open')}</Link>
        </div>
      )}
      <section>
        <h2 className="s-section-title">
          <CalendarCheck2 size={18} /> {t('todaysWork')}
        </h2>
        {!data && !error && <Loading />}
        {data && !ordered.length && (
          <Empty icon={<CalendarCheck2 />} title={t('nothingToday')}>
            {t('nothingTodayHelp')}
          </Empty>
        )}
        {data && !!ordered.length && !actionable.length && (
          <Empty icon={<PartyPopper />} title={t('allDone')} />
        )}
        <div className="s-list">
          {ordered.map((x) => (
            <TaskCard key={x.id} task={x} context={staff.context} tz={tz} />
          ))}
        </div>
      </section>
    </div>
  );
}
