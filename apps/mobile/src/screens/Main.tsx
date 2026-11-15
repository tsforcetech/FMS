import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  CloudOff,
  Megaphone,
  PartyPopper,
  Play,
  RefreshCw,
  Search,
  Sun,
  UserCheck,
} from 'lucide-react';
import {
  addDays,
  isOverdue,
  problemCategories,
  toLocal,
} from '@facilityos/shared';
import { myWorkOrders } from '@admin/management/staffStore';
import { getAttendance, type Attendance } from '@admin/management/fieldStore';
import { attendanceId, helpUrl } from '@facilityos/shared';
import { Pill, useToast } from '@admin/ui/kit';
import { useStaff } from '@staff/App';
import { useT, type Key } from '@staff/i18n';
import { useShiftToday } from '@staff/screens/MyDay';
import {
  Empty,
  ErrorBox,
  Label,
  Loading,
  TaskCard,
  fmtDateTime,
  startOf,
  todayIn,
  workOrder,
} from '@staff/screens/common';
import { newId, useMobile } from '../core';

/* ================================================================ home */
export function Home() {
  const staff = useStaff();
  const m = useMobile();
  const { t } = useT();
  const tz = staff.timeZone;
  const today = todayIn(tz);
  const shift = useShiftToday();
  const [openWo, setOpenWo] = useState<number | null>(null),
    [att, setAtt] = useState<Attendance | null | undefined>();
  useEffect(() => {
    if (!m.state.online) return;
    myWorkOrders(staff.context.services.db, staff.companyId, staff, staff.uid)
      .then((r) =>
        setOpenWo(
          r.filter(
            (w) =>
              w.assigneeIds.includes(staff.employee.id) &&
              ['assigned', 'in_progress', 'on_hold'].includes(w.status),
          ).length,
        ),
      )
      .catch(() => setOpenWo(null));
    getAttendance(
      staff.context.services.db,
      staff.companyId,
      attendanceId(staff.employee.id, today),
    )
      .then(setAtt)
      .catch(() => setAtt(undefined));
  }, [m.state.online, staff, today]);
  const mineToday = m.tasks.filter(
    (x) => toLocal(startOf(x), tz).date === today,
  );
  const relevant = m.tasks.filter(
    (x) =>
      toLocal(startOf(x), tz).date === today ||
      ['in_progress', 'paused', 'rework_required'].includes(x.status) ||
      isOverdue(x.status, x.dueAt.toDate()),
  );
  const ordered = workOrder(relevant);
  const next = ordered.find((x) =>
    ['assigned', 'in_progress', 'paused', 'rework_required'].includes(x.status),
  );
  const hour = +toLocal(new Date(), tz).time.slice(0, 2);
  const counts: [Key, number, string, string][] = [
    ['assigned', mineToday.length, 'blue', '/tasks?tab=today'],
    [
      'pending',
      mineToday.filter((x) => ['pending', 'assigned'].includes(x.status))
        .length,
      'gray',
      '/tasks?tab=today',
    ],
    [
      'completed',
      mineToday.filter((x) =>
        ['completed', 'awaiting_approval'].includes(x.status),
      ).length,
      'green',
      '/tasks?tab=done',
    ],
    [
      'overdue',
      m.tasks.filter((x) => isOverdue(x.status, x.dueAt.toDate())).length,
      'red',
      '/tasks?tab=overdue',
    ],
    [
      'rework',
      m.tasks.filter((x) => x.status === 'rework_required').length,
      'amber',
      '/tasks?tab=rework',
    ],
    ['openWorkOrders', openWo ?? 0, 'violet', '/work-orders'],
  ];
  return (
    <div className="s-page">
      <section className="s-hero">
        <p className="s-hero-date">
          <Sun size={16} />{' '}
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: tz,
          })}
        </p>
        <h1>
          {hour < 12
            ? t('goodMorning')
            : hour < 17
              ? t('goodAfternoon')
              : t('goodEvening')}
          , {staff.employee.name.split(' ')[0]}
        </h1>
        <p className="s-hero-sub">
          {staff.companyName}
          {staff.employee.primarySiteId && (
            <>
              {' · '}
              <Label
                context={staff.context}
                kind="sites"
                id={staff.employee.primarySiteId}
              />
            </>
          )}
        </p>
        <div className="s-shift">
          <Clock3 size={18} />
          {shift?.leave ? (
            <strong>{t('onLeave')}</strong>
          ) : shift?.shift ? (
            <span>
              <strong>{t('shiftToday')}:</strong> {shift.shift.name} ·{' '}
              {shift.shift.start}–{shift.shift.end}
            </span>
          ) : (
            <span>{shift ? t('noShift') : '…'}</span>
          )}
        </div>
        <Link
          to="/attendance"
          className={'m-att ' + (att?.status === 'checked_in' ? 'in' : '')}
        >
          <UserCheck size={18} />
          {att?.status === 'checked_in'
            ? `${t('checkedInAt')} ${fmtDateTime(att.checkInAt.toDate(), tz)}`
            : att?.checkOutAt
              ? `${t('checkedOutAt')} ${fmtDateTime(att.checkOutAt.toDate(), tz)}`
              : t('checkIn')}
        </Link>
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
      <section className="s-stats" aria-label={t('todaysWork')}>
        {counts.map(([k, n, tone, to]) => (
          <Link
            key={k}
            to={to}
            className={'s-stat tone-' + tone + (n ? '' : ' zero')}
          >
            <strong>
              {k === 'openWorkOrders' && openWo === null ? '—' : n}
            </strong>
            <span>{t(k)}</span>
          </Link>
        ))}
      </section>
      <h2 className="s-section-title">
        <CalendarCheck2 size={18} /> {t('todaysWork')}
      </h2>
      {!m.state.lastSyncAt && m.state.online && <Loading />}
      {!m.state.lastSyncAt && !m.state.online && (
        <ErrorBox error={t('offlineMode')} />
      )}
      {!!m.state.lastSyncAt && !ordered.length && (
        <Empty icon={<CalendarCheck2 />} title={t('nothingToday')}>
          {t('nothingTodayHelp')}
        </Empty>
      )}
      {!!ordered.length && !next && (
        <Empty icon={<PartyPopper />} title={t('allDone')} />
      )}
      <div className="s-list">
        {ordered.map((x) => (
          <TaskCard key={x.id} task={x} context={staff.context} tz={tz} />
        ))}
      </div>
    </div>
  );
}

/* ================================================================ my tasks (from the device copy) */
type Tab = 'today' | 'upcoming' | 'active' | 'overdue' | 'rework' | 'done';
export function Tasks() {
  const staff = useStaff();
  const m = useMobile();
  const { t } = useT();
  const tz = staff.timeZone;
  const today = todayIn(tz);
  const [tab, setTab] = useState<Tab>(
    () =>
      (new URLSearchParams(location.hash.split('?')[1] || '').get(
        'tab',
      ) as Tab) || 'today',
  );
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const d = (x: (typeof m.tasks)[number]) => toLocal(startOf(x), tz).date;
    const f = {
      today: (x: (typeof m.tasks)[number]) => d(x) === today,
      upcoming: (x: (typeof m.tasks)[number]) =>
        d(x) > today && d(x) <= addDays(today, 8),
      active: (x: (typeof m.tasks)[number]) =>
        ['in_progress', 'paused'].includes(x.status),
      overdue: (x: (typeof m.tasks)[number]) =>
        isOverdue(x.status, x.dueAt.toDate()),
      rework: (x: (typeof m.tasks)[number]) => x.status === 'rework_required',
      done: (x: (typeof m.tasks)[number]) =>
        ['completed', 'awaiting_approval'].includes(x.status),
    }[tab];
    return m.tasks
      .filter(f)
      .filter(
        (x) =>
          !q.trim() ||
          `${x.title} ${x.reference}`
            .toLowerCase()
            .includes(q.trim().toLowerCase()),
      )
      .sort((a, b) =>
        tab === 'done'
          ? b.dueAt.toMillis() - a.dueAt.toMillis()
          : a.dueAt.toMillis() - b.dueAt.toMillis(),
      );
  }, [m, tab, q, tz, today]);
  const tabs: [Tab, Key][] = [
    ['today', 'today'],
    ['upcoming', 'upcoming'],
    ['active', 'inProgress'],
    ['overdue', 'overdue'],
    ['rework', 'rework'],
    ['done', 'completed'],
  ];
  return (
    <div className="s-page">
      <h1 className="s-title">{t('myTasks')}</h1>
      <div className="s-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            className="s-tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <label className="s-search">
        <Search size={18} />
        <span className="sr-only">{t('search')}</span>
        <input
          className="input"
          placeholder={t('search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {!shown.length && (
        <Empty icon={<CalendarCheck2 />} title={t('noTasks')} />
      )}
      <div className="s-list">
        {shown.map((x) => (
          <TaskCard key={x.id} task={x} context={staff.context} tz={tz} />
        ))}
      </div>
    </div>
  );
}

/* ================================================================ sync centre */
export function SyncCenter() {
  const m = useMobile();
  const staff = useStaff();
  const { t, lang } = useT();
  const label: Record<string, string> = {
    start: t('start'),
    pause: t('pause'),
    resume: t('resume'),
    restart: t('restart'),
    save_progress: t('saveProgress'),
    submit: t('submitForApproval'),
    evidence: t('evidence'),
    report_issue: t('reportProblem'),
  };
  const title = (id: string) =>
    m.tasks.find((x) => x.id === id)?.title || id.slice(0, 8);
  return (
    <div className="s-page">
      <div className="s-title-row">
        <h1 className="s-title">{t('syncCenter')}</h1>
        <button
          className="btn btn-primary"
          disabled={m.state.running || !m.state.online}
          onClick={() => void m.syncNow()}
        >
          <RefreshCw /> {m.state.running ? t('syncing') : t('syncNow')}
        </button>
      </div>
      {!m.state.online && (
        <div className="s-offline in-page" role="status">
          <CloudOff size={18} /> {t('offlineMode')}
        </div>
      )}
      <p className="small muted">
        {t('lastSynced')}:{' '}
        {m.state.lastSyncAt
          ? fmtDateTime(new Date(m.state.lastSyncAt), staff.timeZone)
          : '—'}
      </p>
      {!m.ops.length && <Empty icon={<CheckCircle2 />} title={t('synced')} />}
      <div className="s-list">
        {[...m.ops].reverse().map((o) => (
          <div key={o.id} className={'s-card simple m-op ' + o.status}>
            <div className="s-card-top">
              <strong>{label[o.type] || o.type}</strong>
              <Pill
                tone={
                  o.status === 'done'
                    ? 'green'
                    : o.status === 'pending' || o.status === 'syncing'
                      ? 'amber'
                      : 'red'
                }
                dot
              >
                {o.status === 'done'
                  ? t('synced')
                  : o.status === 'pending' || o.status === 'syncing'
                    ? t('syncPending')
                    : t('conflicts')}
              </Pill>
            </div>
            <p className="s-meta">
              {title(o.taskId)} ·{' '}
              {fmtDateTime(new Date(o.createdAt), staff.timeZone)}
              {o.attempts > 1 ? ` · ${o.attempts}×` : ''}
            </p>
            {o.lastError && o.status !== 'done' && (
              <p className="small">{o.lastError}</p>
            )}
            {['conflict', 'failed', 'blocked'].includes(o.status) && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => void m.queue.prune([o.id]).then(m.syncNow)}
              >
                {t('dismiss')}
              </button>
            )}
            {o.status === 'conflict' && (
              <a
                className="btn btn-ghost btn-sm"
                href={helpUrl(
                  'ts.sync-conflict',
                  import.meta.env.VITE_HELP_URL,
                  lang,
                )}
                target="_blank"
                rel="noopener"
              >
                {t('help')}
              </a>
            )}
          </div>
        ))}
      </div>
      {m.ops.some((o) => o.status === 'done') && (
        <button
          className="btn btn-outline btn-lg btn-block"
          onClick={() => void m.queue.prune().then(m.syncNow)}
        >
          {t('dismiss')} ✓
        </button>
      )}
    </div>
  );
}

/* ================================================================ report from a task (queued, works offline) */
export function ReportFromTask() {
  const { id = '' } = useParams();
  const staff = useStaff();
  const m = useMobile();
  const { t } = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const task = m.tasks.find((x) => x.id === id);
  const opId = useMemo(() => newId(), []);
  const [v, setV] = useState({
      category: '',
      severity: 'warning' as 'warning' | 'critical',
      description: '',
      questionId: '',
      workOrder: true,
    }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  if (!task) return <ErrorBox error={t('permissionError')} />;
  return (
    <div className="s-page">
      <h1 className="s-title">
        <Megaphone /> {t('issueTitle')}
      </h1>
      <div className="s-carry">
        <span>{t('relatedTask')}</span>
        <strong>{task.title}</strong>
        <span className="small muted">
          <Label context={staff.context} kind="sites" id={task.siteId} />
          {task.locationId && (
            <>
              {' · '}
              <Label
                context={staff.context}
                kind="locations"
                id={task.locationId}
              />
            </>
          )}
        </span>
      </div>
      {error && <ErrorBox error={error} />}
      <fieldset className="s-choice">
        <legend>{t('category')}</legend>
        <div className="s-chips">
          {problemCategories.map((p) => (
            <button
              type="button"
              key={p}
              className="chip-toggle"
              aria-pressed={v.category === p}
              onClick={() => setV({ ...v, category: p })}
            >
              {p}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="s-choice">
        <legend>{t('severity')}</legend>
        <div className="s-seg">
          <button
            type="button"
            aria-pressed={v.severity === 'warning'}
            onClick={() => setV({ ...v, severity: 'warning' })}
          >
            {t('warning')}
          </button>
          <button
            type="button"
            className="danger"
            aria-pressed={v.severity === 'critical'}
            onClick={() => setV({ ...v, severity: 'critical' })}
          >
            <AlertTriangle size={16} /> {t('critical')}
          </button>
        </div>
      </fieldset>
      <label htmlFor="m-desc">{t('description')}</label>
      <textarea
        id="m-desc"
        className="input"
        rows={4}
        maxLength={1000}
        value={v.description}
        onChange={(e) => setV({ ...v, description: e.target.value })}
      />
      <label htmlFor="m-q">{t('checklist')}</label>
      <select
        id="m-q"
        className="select"
        value={v.questionId}
        onChange={(e) => setV({ ...v, questionId: e.target.value })}
      >
        <option value="">—</option>
        {task.content.questions.map((q) => (
          <option key={q.id} value={q.id}>
            {q.label}
          </option>
        ))}
      </select>
      <label className="toggle">
        <input
          type="checkbox"
          checked={v.workOrder}
          onChange={(e) => setV({ ...v, workOrder: e.target.checked })}
        />{' '}
        {t('alsoWorkOrder')}
      </label>
      <button
        className="btn btn-primary btn-lg btn-block"
        disabled={busy}
        onClick={async () => {
          if (!v.category || !v.description.trim())
            return setError(`${t('category')} · ${t('description')}`);
          setBusy(true);
          // The operation ID is the issue ID: retries can never create a second report.
          await m.enqueue({
            id: `iss${opId}`,
            taskId: task.id,
            type: 'report_issue',
            baseRevision: -1,
            payload: { ...v, reportedBy: staff.employee.name },
          });
          toast(m.state.online ? t('reported') : t('queued'));
          navigate(`/task/${task.id}`);
        }}
      >
        {t('send')}
      </button>
      <p className="small muted">
        {t('referenceNo')}:{' '}
        <span className="code-chip">
          {`iss${opId}`.slice(0, 11).toUpperCase()}
        </span>
      </p>
    </div>
  );
}
