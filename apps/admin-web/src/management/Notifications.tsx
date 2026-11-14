import { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  CheckCheck,
  RefreshCw,
  Server,
  Zap,
  Mail,
  Smartphone,
  Activity,
} from 'lucide-react';
import {
  notificationLabels,
  notificationTypes,
  type NotificationType,
} from '@facilityos/shared';
import {
  listNotifications,
  loadPreferences,
  markAllRead,
  markRead,
  savePreferences,
  type AppNotification,
  type Preferences,
} from './notifyStore';
import {
  listRuns,
  listSchedules,
  runScheduler,
  type Schedule,
  type SchedulerRun,
} from './scheduling';
import { formatInstant, type Context } from './context';
import {
  Banner,
  Empty,
  IconCircle,
  Pill,
  Segmented,
  Skeleton,
  friendly,
  humanize,
  useToast,
} from '../ui/kit';

const recordPath: Record<string, (id: string) => string> = {
  tasks: (id) => `#/tasks?task=${id}`,
  workOrders: (id) => `#/work-orders?case=${id}`,
  complaints: (id) => `#/complaints?case=${id}`,
  escalations: (id) => `#/escalations?case=${id}`,
  recurringSchedules: (id) => `#/recurring-tasks?schedule=${id}`,
};

export function NotificationCenter({
  context,
  onChange,
}: {
  context: Context;
  onChange?: () => void;
}) {
  const db = context.services.db,
    c = context.company.companyId;
  const [filter, setFilter] = useState<'all' | 'unread'>('all'),
    [rows, setRows] = useState<AppNotification[]>(),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  const toast = useToast();
  useEffect(() => {
    let live = true;
    setRows(undefined);
    listNotifications(db, c, context.uid, filter === 'unread', 100)
      .then(
        (r) =>
          live &&
          setRows(
            filter === 'unread'
              ? r.sort(
                  (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis(),
                )
              : r,
          ),
      )
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c, context.uid, filter, version]);
  async function open(n: AppNotification) {
    if (!n.readAt) {
      try {
        await markRead(db, c, n.id);
        onChange?.();
        window.dispatchEvent(new Event('fos-notifications'));
      } catch {
        /* reading still works */
      }
    }
    location.hash = recordPath[n.recordKind]?.(n.recordId).slice(1) || '/';
  }
  return (
    <section className="card card-pad rise">
      <div className="toolbar">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread' },
          ]}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label="Refresh"
          onClick={() => setVersion((x) => x + 1)}
        >
          <RefreshCw />
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-outline"
          onClick={async () => {
            try {
              const n = await markAllRead(db, c, context.uid);
              toast(n ? `${n} marked as read.` : 'Nothing unread.');
              setVersion((x) => x + 1);
              onChange?.();
              window.dispatchEvent(new Event('fos-notifications'));
            } catch (e) {
              setError(friendly(e));
            }
          }}
        >
          <CheckCheck /> Mark all read
        </button>
      </div>
      {error && <Banner tone="red">{error}</Banner>}
      {!rows && !error && <Skeleton rows={4} />}
      {rows && !rows.length && (
        <Empty
          icon={BellOff}
          title={
            filter === 'unread'
              ? 'You are all caught up'
              : 'No notifications yet'
          }
        >
          Assignments, approvals, overdue work, SLA breaches and escalations
          addressed to you appear here.
        </Empty>
      )}
      {!!rows?.length && (
        <div className="queue">
          {rows.map((n) => (
            <button
              key={n.id}
              type="button"
              className={'queue-row notification' + (n.readAt ? '' : ' unread')}
              onClick={() => void open(n)}
            >
              <IconCircle
                icon={Bell}
                tone={
                  n.type === 'sla_breach' ||
                  n.type === 'task_overdue' ||
                  n.type === 'escalation_raised'
                    ? 'red'
                    : n.readAt
                      ? 'gray'
                      : 'blue'
                }
              />
              <div style={{ minWidth: 0 }}>
                <div className="t">{n.title}</div>
                <div className="s">{n.body}</div>
                <div className="small muted">
                  {n.createdAt ? formatInstant(n.createdAt.toDate()) : ''}
                </div>
              </div>
              {!n.readAt && (
                <Pill tone="blue" dot>
                  New
                </Pill>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function NotificationSettings({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const [p, setP] = useState<Preferences>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  useEffect(() => {
    loadPreferences(db, c, context.uid)
      .then(setP)
      .catch((e) => setError(friendly(e)));
  }, [db, c, context.uid]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!p) return <Skeleton rows={4} />;
  const on = (t: NotificationType) => p.inApp[t] !== false;
  return (
    <>
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>In-app notifications</h2>
          <span className="muted small">
            Choose what appears in your notification centre
          </span>
        </div>
        <div
          className="toggles"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 14,
          }}
        >
          {notificationTypes.map((t) => (
            <label key={t} className="toggle">
              <input
                type="checkbox"
                role="switch"
                checked={on(t)}
                onChange={(e) =>
                  setP({ ...p, inApp: { ...p.inApp, [t]: e.target.checked } })
                }
              />
              <span>{notificationLabels[t]}</span>
            </label>
          ))}
        </div>
        <div className="page-actions" style={{ marginTop: 18 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await savePreferences(db, c, context.uid, p);
                toast('Preferences saved.');
              } catch (e) {
                setError(friendly(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      </section>
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>Email and push</h2>
          <Pill tone="amber">Pending activation</Pill>
        </div>
        <div className="queue">
          <div className="queue-row">
            <IconCircle icon={Mail} tone="gray" />
            <div>
              <div className="t">Email delivery</div>
              <div className="s">
                Adapter prepared. Needs an approved email provider and a trusted
                sender (server-side); not connected, so no email is sent.
              </div>
            </div>
          </div>
          <div className="queue-row">
            <IconCircle icon={Smartphone} tone="gray" />
            <div>
              <div className="t">Push notifications</div>
              <div className="s">
                Planned with the mobile apps (Firebase Cloud Messaging). Not
                connected, so no push is sent.
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ================================================================ scheduler monitor */
export function SchedulerMonitor({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const [runs, setRuns] = useState<SchedulerRun[]>(),
    [schedules, setSchedules] = useState<Schedule[]>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  const toast = useToast();
  useEffect(() => {
    let live = true;
    Promise.all([listRuns(db, c, 25), listSchedules(db, c)])
      .then(([r, s]) => {
        if (!live) return;
        setRuns(r);
        setSchedules(s.filter((x) => x.status !== 'archived'));
      })
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c, version]);
  const lastServer = runs?.find((r) => r.mode === 'server');
  const serverHealthy =
    lastServer && Date.now() - lastServer.startedAt.toMillis() < 2 * 3600000;
  return (
    <>
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>
            <Server size={18} /> Automatic scheduler
          </h2>
          {serverHealthy ? (
            <Pill tone="green" dot>
              Operational
            </Pill>
          ) : lastServer ? (
            <Pill tone="red" dot>
              Not running recently
            </Pill>
          ) : (
            <Pill tone="amber" dot>
              Pending activation
            </Pill>
          )}
        </div>
        {serverHealthy ? (
          <p className="small">
            Last server run {formatInstant(lastServer!.startedAt.toDate())} —{' '}
            {humanize(lastServer!.status)}. It runs every 30 minutes without any
            browser open.
          </p>
        ) : (
          <Banner
            tone="amber"
            title={
              lastServer
                ? 'The server job has not run in the last 2 hours'
                : 'No server run recorded yet'
            }
          >
            Automatic generation runs as a scheduled GitHub Actions job every 30
            minutes, signed in as a dedicated scheduler account and limited by
            the same security rules as an administrator. It starts working once
            the repository secrets for that account are added. Until then, use
            “Run scheduler now” below; nothing is generated automatically.
          </Banner>
        )}
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const r = await runScheduler(db, c, context.uid, {
                  mode: 'manual',
                });
                toast(
                  `Run ${humanize(r.status)}: ${r.created} created, ${r.existing} already existed, ${r.unassigned} unassigned, ${r.notifications} notifications.`,
                );
                setVersion((x) => x + 1);
              } catch (e) {
                setError(friendly(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Zap /> {busy ? 'Running…' : 'Run scheduler now'}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Refresh"
            onClick={() => setVersion((x) => x + 1)}
          >
            <RefreshCw />
          </button>
        </div>
        <p className="small muted">
          A manual run is a fallback: it uses your session, generates the next 7
          days, recovers up to 30 missed days and never duplicates an occurrence
          that already exists.
        </p>
        {error && (
          <Banner tone="red" role="alert">
            {error}
          </Banner>
        )}
      </section>
      <div
        className="dash-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>
              <Activity size={18} /> Recent runs
            </h2>
          </div>
          {!runs ? (
            <Skeleton rows={3} />
          ) : !runs.length ? (
            <p className="small muted">No runs yet.</p>
          ) : (
            <div className="queue">
              {runs.map((r) => (
                <div key={r.id} className="queue-row">
                  <IconCircle
                    icon={r.mode === 'server' ? Server : Zap}
                    tone={
                      r.status === 'ok'
                        ? 'green'
                        : r.status === 'running'
                          ? 'blue'
                          : 'red'
                    }
                  />
                  <div style={{ minWidth: 0 }}>
                    <div className="t">
                      {r.startedAt ? formatInstant(r.startedAt.toDate()) : '—'}{' '}
                      · {r.mode === 'server' ? 'Server' : 'Manual'}
                    </div>
                    <div className="s">
                      {r.scheduleCount} schedule(s) · {r.created} created ·{' '}
                      {r.existing} existing · {r.unassigned} unassigned ·{' '}
                      {r.notifications} notifications
                    </div>
                    {!!r.errors?.length && (
                      <div className="small danger-text">
                        {r.errors.join(' · ')}
                      </div>
                    )}
                  </div>
                  <Pill
                    tone={
                      r.status === 'ok'
                        ? 'green'
                        : r.status === 'running'
                          ? 'blue'
                          : 'red'
                    }
                  >
                    {humanize(r.status)}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>Schedules</h2>
          </div>
          {!schedules ? (
            <Skeleton rows={3} />
          ) : !schedules.length ? (
            <p className="small muted">No schedules yet.</p>
          ) : (
            <div className="queue">
              {schedules.map((s) => (
                <a
                  key={s.id}
                  className="queue-row"
                  href={`#/${s.purpose === 'maintenance' ? 'pm-plans' : 'recurring-tasks'}?schedule=${s.id}`}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="t">{s.name}</div>
                    <div className="s">
                      Generated through {s.generatedThrough || '—'} · last run{' '}
                      {s.lastRunAt
                        ? formatInstant(s.lastRunAt.toDate())
                        : 'never'}
                      {s.retryCount
                        ? ` · ${s.retryCount} failed attempt(s)`
                        : ''}
                    </div>
                    {s.lastError && (
                      <div className="small danger-text">{s.lastError}</div>
                    )}
                  </div>
                  <Pill
                    tone={
                      s.lastRunStatus === 'error'
                        ? 'red'
                        : s.status === 'active'
                          ? 'green'
                          : 'gray'
                    }
                  >
                    {s.lastRunStatus === 'error' ? 'Error' : humanize(s.status)}
                  </Pill>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
