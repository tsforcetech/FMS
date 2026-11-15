import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardCheck, History as HistoryIcon, Search } from 'lucide-react';
import { addDays, priorities } from '@facilityos/shared';
import type { Task } from '@admin/management/tasksStore';
import {
  myOverdue,
  myTasksBetween,
  myTasksByStatus,
} from '@admin/management/staffStore';
import { lookup } from '@admin/management/context';
import { useStaff } from '../App';
import { useT, type Key } from '../i18n';
import {
  Empty,
  ErrorBox,
  Loading,
  TaskCard,
  friendlyError,
  localDay,
  todayIn,
} from './common';

type Tab = 'today' | 'upcoming' | 'active' | 'overdue' | 'done' | 'rework';
const tabs: { id: Tab; label: Key }[] = [
  { id: 'today', label: 'today' },
  { id: 'upcoming', label: 'upcoming' },
  { id: 'active', label: 'inProgress' },
  { id: 'overdue', label: 'overdue' },
  { id: 'rework', label: 'rework' },
  { id: 'done', label: 'completed' },
];
export function MyTasks() {
  const staff = useStaff();
  const { t } = useT();
  const tz = staff.timeZone;
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'today';
  const [date, setDate] = useState(() => todayIn(tz));
  const [rows, setRows] = useState<Task[]>(),
    [max, setMax] = useState(30),
    [error, setError] = useState(''),
    [q, setQ] = useState(''),
    [priority, setPriority] = useState(''),
    [site, setSite] = useState(''),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setRows(undefined);
    const db = staff.context.services.db,
      c = staff.companyId,
      e = staff.employee.id;
    const load: Promise<Task[]> =
      tab === 'today'
        ? myTasksBetween(db, c, e, ...localDay(tz, date), max)
        : tab === 'upcoming'
          ? myTasksBetween(
              db,
              c,
              e,
              localDay(tz, addDays(todayIn(tz), 1))[0],
              localDay(tz, addDays(todayIn(tz), 30))[1],
              max,
            )
          : tab === 'active'
            ? myTasksByStatus(db, c, e, ['in_progress', 'paused'], false, max)
            : tab === 'overdue'
              ? myOverdue(db, c, e)
              : tab === 'rework'
                ? myTasksByStatus(db, c, e, ['rework_required'], false, max)
                : myTasksByStatus(
                    db,
                    c,
                    e,
                    ['completed', 'awaiting_approval'],
                    true,
                    max,
                  );
    load
      .then((r) => {
        if (!live) return;
        setRows(r);
        setError('');
      })
      .catch((err) => live && setError(friendlyError(err, t)));
    return () => {
      live = false;
    };
  }, [staff, tab, date, max, tz, version, t]);
  const shown = useMemo(
    () =>
      (rows || []).filter(
        (x) =>
          (!priority || x.priority === priority) &&
          (!site || x.siteId === site) &&
          (!q.trim() ||
            `${x.title} ${x.reference}`
              .toLowerCase()
              .includes(q.trim().toLowerCase())),
      ),
    [rows, priority, site, q],
  );
  const sites = [...new Set((rows || []).map((x) => x.siteId))];
  return (
    <div className="s-page">
      <h1 className="s-title">{t('myTasks')}</h1>
      <div className="s-tabs" role="tablist" aria-label={t('myTasks')}>
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            className="s-tab"
            onClick={() => {
              setMax(30);
              setParams({ tab: x.id });
            }}
          >
            {t(x.label)}
          </button>
        ))}
      </div>
      <div className="s-filters">
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
        {tab === 'today' && (
          <input
            className="input"
            type="date"
            aria-label="Date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        )}
        <select
          className="select"
          aria-label={t('priority')}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">{t('anyPriority')}</option>
          {priorities.map((p) => (
            <option key={p} value={p}>
              {p[0].toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
        {sites.length > 1 && (
          <select
            className="select"
            aria-label={t('site')}
            value={site}
            onChange={(e) => setSite(e.target.value)}
          >
            <option value="">{t('allSites')}</option>
            {sites.map((s) => (
              <SiteOption key={s} id={s} />
            ))}
          </select>
        )}
      </div>
      {error && (
        <ErrorBox error={error} onRetry={() => setVersion((v) => v + 1)} />
      )}
      {!rows && !error && <Loading />}
      {rows && !shown.length && (
        <Empty icon={<ClipboardCheck />} title={t('noTasks')} />
      )}
      <div className="s-list">
        {shown.map((x) => (
          <TaskCard key={x.id} task={x} context={staff.context} tz={tz} />
        ))}
      </div>
      {rows && rows.length >= max && tab !== 'overdue' && (
        <button
          className="btn btn-outline btn-lg btn-block"
          onClick={() => setMax(max + 30)}
        >
          {t('loadMore')}
        </button>
      )}
    </div>
  );
}
function SiteOption({ id }: { id: string }) {
  const staff = useStaff();
  return (
    <option value={id}>
      {/* option text must be plain text */}
      {useSiteName(staff.context, id)}
    </option>
  );
}
function useSiteName(
  context: ReturnType<typeof useStaff>['context'],
  id: string,
) {
  const [n, setN] = useState(id.slice(0, 6));
  useEffect(() => {
    lookup(context, 'sites', id).then((r) => r && setN(r.name));
  }, [context, id]);
  return n;
}

export function History() {
  const staff = useStaff();
  const { t } = useT();
  const [rows, setRows] = useState<Task[]>(),
    [max, setMax] = useState(30),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    myTasksByStatus(
      staff.context.services.db,
      staff.companyId,
      staff.employee.id,
      ['completed', 'rejected', 'cancelled', 'awaiting_approval'],
      true,
      max,
    )
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(friendlyError(e, t)));
    return () => {
      live = false;
    };
  }, [staff, max, t]);
  return (
    <div className="s-page">
      <h1 className="s-title">{t('history')}</h1>
      {error && <ErrorBox error={error} />}
      {!rows && !error && <Loading />}
      {rows && !rows.length && (
        <Empty icon={<HistoryIcon />} title={t('noTasks')} />
      )}
      <div className="s-list">
        {rows?.map((x) => (
          <TaskCard
            key={x.id}
            task={x}
            context={staff.context}
            tz={staff.timeZone}
          />
        ))}
      </div>
      {rows && rows.length >= max && (
        <button
          className="btn btn-outline btn-lg btn-block"
          onClick={() => setMax(max + 30)}
        >
          {t('loadMore')}
        </button>
      )}
    </div>
  );
}
