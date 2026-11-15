import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { addDays, toLocal, weekday } from '@facilityos/shared';
import type { Task } from '@admin/management/tasksStore';
import { myTasksBetween } from '@admin/management/staffStore';
import { useStaff } from '../App';
import { useT } from '../i18n';
import {
  Empty,
  ErrorBox,
  Loading,
  TaskCard,
  friendlyError,
  localDay,
  startOf,
  statusTone,
  todayIn,
} from './common';

type View = 'today' | 'week' | 'month' | 'agenda';
const dow = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function range(view: View, anchor: string): [string, string] {
  if (view === 'today') return [anchor, anchor];
  if (view === 'agenda') return [anchor, addDays(anchor, 13)];
  if (view === 'week') {
    const s = addDays(anchor, -weekday(anchor));
    return [s, addDays(s, 6)];
  }
  const first = anchor.slice(0, 8) + '01';
  const s = addDays(first, -weekday(first));
  return [s, addDays(s, 41)];
}
/** Staff calendar: own tasks only, read-only (rescheduling stays with supervisors). */
export function StaffCalendar() {
  const staff = useStaff();
  const { t } = useT();
  const tz = staff.timeZone;
  const today = todayIn(tz);
  const [view, setView] = useState<View>('week'),
    [anchor, setAnchor] = useState(today),
    [selected, setSelected] = useState(today),
    [rows, setRows] = useState<Task[]>(),
    [error, setError] = useState('');
  const [from, to] = range(view, anchor);
  useEffect(() => {
    let live = true;
    setRows(undefined);
    myTasksBetween(
      staff.context.services.db,
      staff.companyId,
      staff.employee.id,
      localDay(tz, from)[0],
      localDay(tz, to)[1],
      300,
    )
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(friendlyError(e, t)));
    return () => {
      live = false;
    };
  }, [staff, from, to, tz, t]);
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const x of rows || []) {
      const d = toLocal(startOf(x), tz).date;
      m.set(d, [...(m.get(d) || []), x]);
    }
    return m;
  }, [rows, tz]);
  const days = Array.from(
    { length: Math.max(1, (Date.parse(to) - Date.parse(from)) / 86400000 + 1) },
    (_, i) => addDays(from, i),
  );
  const move = (n: number) => {
    if (view === 'month') {
      const [y, m] = anchor.split('-').map(Number);
      setAnchor(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10));
    } else
      setAnchor(
        addDays(
          anchor,
          n * (view === 'today' ? 1 : view === 'agenda' ? 14 : 7),
        ),
      );
  };
  const list =
    view === 'today'
      ? byDay.get(anchor) || []
      : view === 'agenda'
        ? []
        : byDay.get(selected) || [];
  return (
    <div className="s-page">
      <h1 className="s-title">{t('calendar')}</h1>
      <div className="s-tabs" role="tablist">
        {(['today', 'week', 'month', 'agenda'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            className="s-tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
          >
            {t(v)}
          </button>
        ))}
      </div>
      <div className="s-cal-nav">
        <button
          className="icon-btn"
          aria-label={t('back')}
          onClick={() => move(-1)}
        >
          <ChevronLeft />
        </button>
        <strong>
          {view === 'month'
            ? new Date(anchor + 'T12:00:00Z').toLocaleString('en', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })
            : from === to
              ? new Date(from + 'T12:00:00Z').toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                })
              : `${from.slice(8)}/${from.slice(5, 7)} – ${to.slice(8)}/${to.slice(5, 7)}`}
        </strong>
        <button
          className="icon-btn"
          aria-label={t('next')}
          onClick={() => move(1)}
        >
          <ChevronRight />
        </button>
      </div>
      {error && <ErrorBox error={error} />}
      {!rows && !error && <Loading />}
      {rows && (view === 'week' || view === 'month') && (
        <div className={'s-cal ' + view} role="grid">
          {view === 'month' &&
            dow.map((d, i) => (
              <span key={i} className="s-cal-dow">
                {d}
              </span>
            ))}
          {days.map((d) => {
            const items = byDay.get(d) || [];
            return (
              <button
                key={d}
                role="gridcell"
                aria-selected={selected === d}
                className={
                  's-cal-day' +
                  (d === today ? ' today' : '') +
                  (view === 'month' && d.slice(0, 7) !== anchor.slice(0, 7)
                    ? ' dim'
                    : '')
                }
                onClick={() => setSelected(d)}
              >
                <span className="n">
                  {view === 'week'
                    ? `${dow[weekday(d)]} ${+d.slice(8)}`
                    : +d.slice(8)}
                </span>
                <span className="dots">
                  {items.slice(0, 4).map((x) => (
                    <i key={x.id} className={'tone-' + statusTone[x.status]} />
                  ))}
                </span>
                {items.length > 0 && <span className="c">{items.length}</span>}
              </button>
            );
          })}
        </div>
      )}
      {rows && view !== 'agenda' && (
        <div className="s-list">
          {!list.length && (
            <Empty icon={<CalendarDays />} title={t('noTasks')} />
          )}
          {list.map((x) => (
            <TaskCard key={x.id} task={x} context={staff.context} tz={tz} />
          ))}
        </div>
      )}
      {rows && view === 'agenda' && (
        <div className="s-list">
          {!rows.length && (
            <Empty icon={<CalendarDays />} title={t('noTasks')} />
          )}
          {[...byDay.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([d, items]) => (
              <section key={d}>
                <h2 className="s-section-title">
                  {new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                </h2>
                {items.map((x) => (
                  <TaskCard
                    key={x.id}
                    task={x}
                    context={staff.context}
                    tz={tz}
                  />
                ))}
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
