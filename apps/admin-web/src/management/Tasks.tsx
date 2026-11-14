import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Ban,
  ListChecks,
  History as HistoryIcon,
  CalendarClock,
  Users,
} from 'lucide-react';
import {
  actionLabels,
  canPerform,
  evaluateSubmission,
  exceptionTypes,
  isOverdue,
  openStatuses,
  priorities,
  taskStatuses,
  type TaskStatus,
} from '@facilityos/shared';
import {
  approvals,
  createTask,
  eligibleEmployees,
  getTask,
  latestPublished,
  listExceptions,
  listTasks,
  recentEvents,
  reportException,
  reviewTask,
  saveProgress,
  submissions,
  submitTask,
  taskCounts,
  taskEvents,
  transitionTask,
  updateException,
  type Approval,
  type Submission,
  type Task,
  type TaskEvent,
  type TaskException,
  type TaskFilter,
  type TemplateVersion,
} from './tasksStore';
import { recordById } from './store';
import { formatInstant, useLabel, type Context } from './context';
import { Picker } from './Picker';
import { ChecklistForm } from './Checklist';
import { VersionSummary } from './TemplateBuilder';
import {
  Banner,
  ConfirmDialog,
  Drawer,
  Empty,
  IconCircle,
  Pill,
  Segmented,
  Skeleton,
  Tabs,
  friendly,
  humanize,
  useToast,
  type Tone,
} from '../ui/kit';

/* ================================================================ helpers */
const statusTone: Record<TaskStatus, Tone> = {
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
const priorityTone: Record<string, Tone> = {
  low: 'gray',
  medium: 'blue',
  high: 'amber',
  critical: 'red',
};
export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return (
    <Pill tone={statusTone[status]} dot>
      {humanize(status)}
    </Pill>
  );
}
export function PriorityPill({ p }: { p: string }) {
  return <Pill tone={priorityTone[p] || 'gray'}>{humanize(p)}</Pill>;
}
export function Due({ task }: { task: Task }) {
  const late = isOverdue(task.status, task.dueAt?.toDate() || null);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}
    >
      {task.dueAt ? formatInstant(task.dueAt.toDate()) : '—'}
      {late && <Pill tone="red">Overdue</Pill>}
    </span>
  );
}
export function Name({
  context,
  kind,
  id,
}: {
  context: Context;
  kind: Parameters<typeof useLabel>[1];
  id: string;
}) {
  return <>{useLabel(context, kind, id).text}</>;
}
function Actor({ context, uid }: { context: Context; uid: string }) {
  return <>{uid === context.uid ? 'You' : 'User ' + uid.slice(0, 6)}</>;
}
export function localInput(d: Date) {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/* ================================================================ dashboard */
export function TaskDashboard({
  context,
  onOpen,
}: {
  context: Context;
  onOpen: (id: string) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>(),
    [overdue, setOverdue] = useState<Task[]>(),
    [awaiting, setAwaiting] = useState<Task[]>(),
    [issues, setIssues] = useState<TaskException[]>(),
    [events, setEvents] = useState<TaskEvent[]>(),
    [error, setError] = useState('');
  const db = context.services.db,
    c = context.company.companyId;
  useEffect(() => {
    let live = true;
    Promise.all([
      taskCounts(db, c),
      getDocs(
        query(
          collection(db, 'companies', c, 'tasks'),
          where('status', 'in', openStatuses),
          where('dueAt', '<', Timestamp.now()),
          orderBy('dueAt'),
          limit(5),
        ),
      ).then((r) => r.docs.map((d) => ({ id: d.id, ...d.data() }) as Task)),
      listTasks(db, c, { status: 'awaiting_approval' }).then((r) =>
        r.rows.slice(0, 5),
      ),
      listExceptions(db, c, { status: 'open' }).then((r) => r.rows.slice(0, 5)),
      recentEvents(db, c).then((r) => r.rows.slice(0, 6)),
    ])
      .then(([k, o, a, x, e]) => {
        if (!live) return;
        setCounts(k);
        setOverdue(o);
        setAwaiting(a);
        setIssues(x);
        setEvents(e);
      })
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c]);
  const tiles: [string, string, Tone][] = [
    ['total', 'Total tasks', 'blue'],
    ['pending', 'Pending', 'gray'],
    ['assigned', 'Assigned', 'blue'],
    ['in_progress', 'In progress', 'violet'],
    ['awaiting_approval', 'Awaiting approval', 'amber'],
    ['rework_required', 'Rework required', 'red'],
    ['overdue', 'Overdue', 'red'],
    ['completed', 'Completed', 'green'],
  ];
  if (error) return <Banner tone="red">{error}</Banner>;
  return (
    <>
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>Task overview</h2>
          <span className="muted small">
            Live counts for {context.company.name}
          </span>
        </div>
        {!counts ? (
          <Skeleton rows={2} />
        ) : (
          <div className="stat-grid">
            {tiles.map(([k, label, tone]) => (
              <div key={k} className={'stat stat-' + tone}>
                <strong>{counts[k] ?? 0}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <div
        className="dash-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        <MiniList
          title="Overdue work"
          icon={Clock}
          tone="red"
          empty="Nothing overdue."
          rows={overdue}
          context={context}
          onOpen={onOpen}
        />
        <MiniList
          title="Waiting for approval"
          icon={CheckCircle2}
          tone="amber"
          empty="No submissions waiting."
          rows={awaiting}
          context={context}
          onOpen={onOpen}
        />
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>Open issues</h2>
          </div>
          {!issues ? (
            <Skeleton rows={2} />
          ) : !issues.length ? (
            <p className="muted">No open issues.</p>
          ) : (
            <div className="queue">
              {issues.map((x) => (
                <button
                  type="button"
                  key={x.id}
                  className="queue-row compact"
                  onClick={() => onOpen(x.taskId)}
                >
                  <IconCircle
                    icon={AlertTriangle}
                    tone={x.severity === 'critical' ? 'red' : 'amber'}
                  />
                  <div style={{ minWidth: 0, textAlign: 'left' }}>
                    <div className="t">{x.type}</div>
                    <div className="s">{x.description}</div>
                  </div>
                  <Pill tone={x.severity === 'critical' ? 'red' : 'amber'}>
                    {humanize(x.severity)}
                  </Pill>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>Recent activity</h2>
          </div>
          {!events ? (
            <Skeleton rows={2} />
          ) : !events.length ? (
            <p className="muted">No activity yet.</p>
          ) : (
            <EventList context={context} events={events} onOpen={onOpen} />
          )}
        </section>
      </div>
      <Banner tone="blue" title="Scheduling">
        Tasks are created manually in Phase 3. Automatic daily, weekly and
        monthly generation arrives with the Phase 4 scheduler.
      </Banner>
    </>
  );
}
function MiniList({
  title,
  icon,
  tone,
  empty,
  rows,
  context,
  onOpen,
}: {
  title: string;
  icon: typeof Clock;
  tone: Tone;
  empty: string;
  rows?: Task[];
  context: Context;
  onOpen: (id: string) => void;
}) {
  return (
    <section className="card card-pad rise">
      <div className="card-head">
        <h2>{title}</h2>
      </div>
      {!rows ? (
        <Skeleton rows={2} />
      ) : !rows.length ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="queue">
          {rows.map((t) => (
            <button
              type="button"
              key={t.id}
              className="queue-row compact"
              onClick={() => onOpen(t.id)}
            >
              <IconCircle icon={icon} tone={tone} />
              <div style={{ minWidth: 0, textAlign: 'left' }}>
                <div className="t">{t.title}</div>
                <div className="s">
                  <Name context={context} kind="sites" id={t.siteId} /> ·{' '}
                  <Due task={t} />
                </div>
              </div>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function EventList({
  context,
  events,
  onOpen,
  showTask = true,
}: {
  context: Context;
  events: TaskEvent[];
  onOpen?: (id: string) => void;
  showTask?: boolean;
}) {
  return (
    <ol className="timeline">
      {events.map((e) => (
        <li key={e.id}>
          <span className="node" aria-hidden />
          <div className="what">
            <span>{actionLabels[e.action]}</span>
            <TaskStatusPill status={e.toStatus} />
            {e.attempt > 1 && (
              <span className="muted small">attempt {e.attempt}</span>
            )}
            {showTask && onOpen && (
              <button
                type="button"
                className="link-btn"
                onClick={() => onOpen(e.taskId)}
              >
                Open task
              </button>
            )}
          </div>
          {e.note && (
            <div className="small" style={{ marginTop: 2 }}>
              “{e.note}”
            </div>
          )}
          {e.action === 'assign' || e.action === 'create' ? (
            <div className="small muted">
              {e.assigneeIds.length ? (
                <>
                  Assigned to{' '}
                  {e.assigneeIds.map((id, i) => (
                    <span key={id}>
                      {i ? ', ' : ''}
                      <Name context={context} kind="employees" id={id} />
                    </span>
                  ))}
                </>
              ) : (
                'Not assigned'
              )}
            </div>
          ) : null}
          <div className="when">
            <Actor context={context} uid={e.actorUid} /> ·{' '}
            {e.at ? formatInstant(e.at.toDate()) : ''}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ================================================================ register */
type FilterBy = 'none' | 'site' | 'department' | 'priority' | 'assignee';
export function TaskRegister({
  context,
  onOpen,
  fixedStatus,
  title,
  allowCreate = true,
}: {
  context: Context;
  onOpen: (id: string) => void;
  fixedStatus?: TaskStatus;
  title?: string;
  allowCreate?: boolean;
}) {
  const [status, setStatus] = useState<string>(fixedStatus || ''),
    [by, setBy] = useState<FilterBy>('none'),
    [value, setValue] = useState(''),
    [rows, setRows] = useState<Task[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false),
    [version, setVersion] = useState(0),
    [creating, setCreating] = useState(false);
  const filter: TaskFilter = {
    status,
    ...(by === 'site' && value ? { siteId: value } : {}),
    ...(by === 'department' && value ? { departmentId: value } : {}),
    ...(by === 'priority' && value ? { priority: value } : {}),
    ...(by === 'assignee' && value ? { assigneeId: value } : {}),
  };
  const key = JSON.stringify(filter);
  useEffect(() => {
    let live = true;
    setBusy(true);
    listTasks(context.services.db, context.company.companyId, JSON.parse(key))
      .then((r) => {
        if (!live) return;
        setRows(r.rows);
        setCursor(r.cursor);
        setMore(r.hasMore);
        setError('');
      })
      .catch((e) => {
        if (!live) return;
        setPending(
          String((e as { code?: string }).code).includes('permission'),
        );
        setError(friendly(e));
      })
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [context, key, version]);
  return (
    <section className="card card-pad rise">
      {title && (
        <div className="card-head">
          <h2>{title}</h2>
        </div>
      )}
      <div className="toolbar">
        {!fixedStatus && (
          <select
            className="select"
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {taskStatuses.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        )}
        <select
          className="select"
          aria-label="Filter by"
          value={by}
          onChange={(e) => {
            setBy(e.target.value as FilterBy);
            setValue('');
          }}
        >
          <option value="none">No other filter</option>
          <option value="site">Site</option>
          <option value="department">Department</option>
          <option value="priority">Priority</option>
          <option value="assignee">Assigned employee</option>
        </select>
        {by === 'priority' && (
          <select
            className="select"
            aria-label="Priority"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">Any priority</option>
            {priorities.map((p) => (
              <option key={p} value={p}>
                {humanize(p)}
              </option>
            ))}
          </select>
        )}
        {(by === 'site' || by === 'department' || by === 'assignee') && (
          <div style={{ minWidth: 240 }}>
            <Picker
              context={context}
              kind={
                by === 'site'
                  ? 'sites'
                  : by === 'department'
                    ? 'departments'
                    : 'employees'
              }
              label={by === 'assignee' ? 'Employee' : humanize(by)}
              value={value}
              onChange={setValue}
            />
          </div>
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label="Refresh"
          onClick={() => setVersion((v) => v + 1)}
        >
          <RefreshCw />
        </button>
        {allowCreate && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginLeft: 'auto' }}
            disabled={pending}
            onClick={() => setCreating(true)}
          >
            <Plus /> New task
          </button>
        )}
      </div>
      {pending ? (
        <Empty icon={AlertTriangle} title="Module pending activation">
          The task security rules have not been deployed to this environment
          yet.
        </Empty>
      ) : error ? (
        <Banner tone="red">{error}</Banner>
      ) : null}
      {!pending && rows.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Task</th>
                <th>Site</th>
                <th>Due</th>
                <th>Priority</th>
                <th>Assigned</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <tr
                  key={t.id}
                  className="clickable"
                  style={{ ['--i' as string]: i }}
                  onClick={() => onOpen(t.id)}
                >
                  <td>
                    <div className="cell-main">
                      <span
                        className="icon-circle tone-violet"
                        style={{ width: 38, height: 38 }}
                      >
                        <ClipboardCheck size={17} />
                      </span>
                      <div>
                        <button
                          type="button"
                          className="text-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(t.id);
                          }}
                        >
                          {t.title}
                        </button>
                        <div className="s">
                          <span className="code-chip">{t.reference}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="cell-ref">
                    <Name context={context} kind="sites" id={t.siteId} />
                  </td>
                  <td>
                    <Due task={t} />
                  </td>
                  <td>
                    <PriorityPill p={t.priority} />
                  </td>
                  <td className="cell-ref">
                    {t.assigneeIds.length ? (
                      <Name
                        context={context}
                        kind="employees"
                        id={t.assigneeIds[0]}
                      />
                    ) : (
                      <span className="muted">Unassigned</span>
                    )}
                    {t.assigneeIds.length > 1 && (
                      <span className="muted small">
                        {' '}
                        +{t.assigneeIds.length - 1}
                      </span>
                    )}
                  </td>
                  <td>
                    <TaskStatusPill status={t.status} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn sm"
                      aria-label={'Open ' + t.title}
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
      {busy && <Skeleton rows={3} />}
      {!busy && !error && !rows.length && (
        <Empty
          icon={ClipboardCheck}
          title={
            fixedStatus === 'awaiting_approval'
              ? 'Nothing waiting for approval'
              : 'No tasks found'
          }
          action={
            allowCreate && !status && by === 'none' ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreating(true)}
              >
                <Plus /> Create the first task
              </button>
            ) : undefined
          }
        >
          {allowCreate
            ? 'Create a task from a published template.'
            : 'Submitted work that needs review appears here.'}
        </Empty>
      )}
      {more && (
        <div className="list-foot">
          <span>Showing {rows.length}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={async () => {
              const r = await listTasks(
                context.services.db,
                context.company.companyId,
                filter,
                cursor,
              );
              setRows((v) => [...v, ...r.rows]);
              setCursor(r.cursor);
              setMore(r.hasMore);
            }}
          >
            Load more
          </button>
        </div>
      )}
      {creating && (
        <NewTaskDrawer
          context={context}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setVersion((v) => v + 1);
            onOpen(id);
          }}
        />
      )}
    </section>
  );
}

/* ================================================================ new task */
export function NewTaskDrawer({
  context,
  onClose,
  onCreated,
  initial,
}: {
  context: Context;
  onClose: () => void;
  onCreated: (id: string) => void;
  /** Prefill from a calendar slot or an asset. */
  initial?: { start?: Date; siteId?: string; assetId?: string };
}) {
  const [now] = useState(() => initial?.start || new Date());
  const [templateId, setTemplateId] = useState(''),
    [version, setVersion] = useState<TemplateVersion | null>(),
    [v, setV] = useState({
      title: '',
      siteId: initial?.siteId || '',
      locationId: '',
      facilityId: '',
      assetId: initial?.assetId || '',
      departmentId: '',
      teamId: '',
      priority: 'medium' as Task['priority'],
      plannedStart: localInput(now),
      dueAt: localInput(new Date(now.getTime() + 4 * 3600_000)),
      notes: '',
    }),
    [assignees, setAssignees] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  const db = context.services.db,
    c = context.company.companyId;
  useEffect(() => {
    let live = true;
    if (!templateId) return;
    setVersion(undefined);
    Promise.all([
      latestPublished(db, c, templateId),
      recordById(db, c, 'taskTemplates', templateId),
    ]).then(([ver, tpl]) => {
      if (!live) return;
      setVersion(ver);
      if (ver) {
        setV((x) => ({
          ...x,
          title: x.title || ver.content.title,
          priority: ver.content.priority,
          departmentId: x.departmentId || tpl?.values.departmentId || '',
          dueAt: localInput(
            new Date(
              now.getTime() +
                Math.max(ver.content.estimatedMinutes, 60) * 60000 +
                3600_000,
            ),
          ),
        }));
        if (
          ver.content.assignment.mode !== 'manual' &&
          ver.content.assignment.refId
        )
          eligibleEmployees(db, c, ver.content.assignment).then(
            (ids) => live && setAssignees(ids.slice(0, 10)),
          );
      }
    });
    return () => {
      live = false;
    };
  }, [db, c, templateId, now]);
  async function submit() {
    if (!version)
      return setError('Choose a template with a published version.');
    setBusy(true);
    setError('');
    try {
      const id = await createTask(db, c, context.uid, {
        ...v,
        versionId: version.id,
        assigneeIds: assignees,
      });
      toast('Task created.');
      onCreated(id);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Drawer
      title="New task"
      subtitle="Create a task from a published template. Tasks belong to physical sites, never to a client."
      icon={<IconCircle icon={ClipboardCheck} tone="violet" />}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <span className="note">
            {assignees.length
              ? `${assignees.length} assignee(s) — starts as Assigned`
              : 'No assignee — starts as Pending'}
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
            disabled={busy || !version}
            onClick={() => void submit()}
          >
            <Save /> {busy ? 'Creating…' : 'Create task'}
          </button>
        </>
      }
    >
      <section className="form-section">
        <h3>
          <span className="num">1</span>Template
        </h3>
        <div className="form-grid">
          <div className="field wide">
            <span className="field-label">
              Task template
              <span className="req" aria-hidden="true">
                *
              </span>
            </span>
            <Picker
              context={context}
              kind="taskTemplates"
              label="Task template"
              value={templateId}
              onChange={setTemplateId}
            />
          </div>
        </div>
        {templateId && version === undefined && <Skeleton rows={1} />}
        {templateId && version === null && (
          <Banner tone="amber">
            This template has no published version yet. Publish its checklist
            first.
          </Banner>
        )}
        {version && (
          <Banner
            tone="green"
            title={`Using version ${version.version}: ${version.content.title}`}
          >
            {version.content.questions.length} questions ·{' '}
            {version.content.approvalRequired
              ? 'approval required'
              : 'no approval step'}{' '}
            · about {version.content.estimatedMinutes} min
          </Banner>
        )}
      </section>
      <section className="form-section">
        <h3>
          <span className="num">2</span>Where
        </h3>
        <div className="form-grid">
          <div className="field wide">
            <label htmlFor="task-title">
              Task title
              <span className="req" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="task-title"
              className="input"
              maxLength={160}
              value={v.title}
              onChange={(e) => setV({ ...v, title: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="field-label">
              Site
              <span className="req" aria-hidden="true">
                *
              </span>
            </span>
            <Picker
              context={context}
              kind="sites"
              label="Site"
              value={v.siteId}
              onChange={(x) =>
                setV({
                  ...v,
                  siteId: x,
                  locationId: '',
                  facilityId: '',
                  assetId: '',
                })
              }
            />
          </div>
          <div className="field">
            <span className="field-label">Location</span>
            <Picker
              context={context}
              kind="locations"
              label="Location"
              value={v.locationId}
              disabled={!v.siteId}
              placeholder={v.siteId ? undefined : 'Choose a site first'}
              filter={{ key: 'siteId', value: v.siteId }}
              onChange={(x) => setV({ ...v, locationId: x })}
            />
          </div>
          <div className="field">
            <span className="field-label">Facility</span>
            <Picker
              context={context}
              kind="facilities"
              label="Facility"
              value={v.facilityId}
              disabled={!v.siteId}
              placeholder={v.siteId ? undefined : 'Choose a site first'}
              filter={{ key: 'siteId', value: v.siteId }}
              onChange={(x) => setV({ ...v, facilityId: x })}
            />
          </div>
          <div className="field">
            <span className="field-label">Asset</span>
            <Picker
              context={context}
              kind="assets"
              label="Asset"
              value={v.assetId}
              disabled={!v.siteId}
              placeholder={v.siteId ? undefined : 'Choose a site first'}
              filter={{ key: 'siteId', value: v.siteId }}
              onChange={(x) => setV({ ...v, assetId: x })}
            />
          </div>
        </div>
      </section>
      <section className="form-section">
        <h3>
          <span className="num">3</span>Who
        </h3>
        <div className="form-grid">
          <div className="field">
            <span className="field-label">Responsible department</span>
            <Picker
              context={context}
              kind="departments"
              label="Department"
              value={v.departmentId}
              onChange={(x) => setV({ ...v, departmentId: x })}
            />
          </div>
          <div className="field">
            <span className="field-label">Assign employees</span>
            <Picker
              context={context}
              kind="employees"
              label="Employee"
              placeholder="Add employee"
              value=""
              onChange={(x) =>
                x &&
                !assignees.includes(x) &&
                setAssignees([...assignees, x].slice(0, 10))
              }
            />
          </div>
          <div className="field wide">
            <div className="chips">
              {assignees.map((id) => (
                <span key={id} className="pill tone-green">
                  <Name context={context} kind="employees" id={id} />
                  <button
                    type="button"
                    className="chip-x"
                    aria-label="Remove assignee"
                    onClick={() =>
                      setAssignees(assignees.filter((x) => x !== id))
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
              {!assignees.length && (
                <span className="muted small">
                  You can assign later from the task.
                </span>
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="form-section">
        <h3>
          <span className="num">4</span>When
        </h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="task-priority">Priority</label>
            <select
              id="task-priority"
              className="input"
              value={v.priority}
              onChange={(e) =>
                setV({ ...v, priority: e.target.value as Task['priority'] })
              }
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </select>
          </div>
          <div />
          <div className="field">
            <label htmlFor="task-start">Planned start</label>
            <input
              id="task-start"
              className="input"
              type="datetime-local"
              value={v.plannedStart}
              onChange={(e) => setV({ ...v, plannedStart: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="task-due">
              Due
              <span className="req" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="task-due"
              className="input"
              type="datetime-local"
              value={v.dueAt}
              onChange={(e) => setV({ ...v, dueAt: e.target.value })}
            />
          </div>
          <div className="field wide">
            <label htmlFor="task-notes">Additional instructions</label>
            <textarea
              id="task-notes"
              className="input"
              rows={3}
              maxLength={2000}
              value={v.notes}
              onChange={(e) => setV({ ...v, notes: e.target.value })}
            />
          </div>
        </div>
      </section>
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
    </Drawer>
  );
}

/* ================================================================ task detail */
export function TaskDetail({
  context,
  taskId,
  onBack,
}: {
  context: Context;
  taskId: string;
  onBack: () => void;
}) {
  const [task, setTask] = useState<Task | null>(),
    [tab, setTab] = useState('checklist'),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [remarks, setRemarks] = useState(''),
    [showErrors, setShowErrors] = useState(false),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<
      | null
      | 'cancel'
      | 'assign'
      | 'issue'
      | 'approve'
      | 'request_rework'
      | 'reject'
      | 'submit'
    >(null),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  const toast = useToast();
  const db = context.services.db,
    c = context.company.companyId;
  const reload = useCallback(async () => {
    const t = await getTask(db, c, taskId);
    setTask(t);
    if (t) setAnswers(t.draftAnswers || {});
    setVersion((v) => v + 1);
  }, [db, c, taskId]);
  useEffect(() => {
    reload().catch((e) => setError(friendly(e)));
  }, [reload]);
  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      toast(label);
      setDialog(null);
      await reload();
    } catch (e) {
      const msg = friendly(e);
      setError(msg);
      toast(msg, 'red');
      // Close confirmations so the explanation is visible; keep drawers with typed input open.
      setDialog((d) => (d === 'assign' || d === 'issue' ? d : null));
      if (msg.includes('updated by someone else')) await reload();
    } finally {
      setBusy(false);
    }
  }
  if (task === undefined)
    return (
      <section className="card card-pad">
        <Skeleton rows={4} />
      </section>
    );
  if (!task)
    return (
      <Empty
        title="Task not found"
        action={
          <button type="button" className="btn btn-outline" onClick={onBack}>
            Back
          </button>
        }
      />
    );
  const overdue = isOverdue(task.status, task.dueAt?.toDate() || null);
  const executing = task.status === 'in_progress';
  const evaluation = evaluateSubmission(task.content, answers);
  return (
    <section className="card card-pad rise">
      <button
        type="button"
        className="link-btn"
        onClick={onBack}
        style={{ marginBottom: 14 }}
      >
        ← Back
      </button>
      <div className="detail-head">
        <IconCircle
          icon={ClipboardCheck}
          tone={statusTone[task.status]}
          size="lg"
        />
        <div className="grow">
          <h1>{task.title}</h1>
          <div className="meta">
            <span className="code-chip">{task.reference}</span>
            <TaskStatusPill status={task.status} />
            <PriorityPill p={task.priority} />
            {overdue && <Pill tone="red">Overdue</Pill>}
            {task.evidencePending && <Pill tone="amber">Evidence pending</Pill>}
            {task.exceptionCount > 0 && (
              <Pill tone="red">{task.exceptionCount} issue(s)</Pill>
            )}
            <span className="code-chip">v{task.version}</span>
          </div>
        </div>
        <div className="page-actions task-actions">
          {canPerform('assign', task.status) && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setDialog('assign')}
            >
              <UserPlus /> {task.assigneeIds.length ? 'Reassign' : 'Assign'}
            </button>
          )}
          {canPerform('start', task.status) && (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={busy}
              onClick={() =>
                run('Task started.', () =>
                  transitionTask(db, c, context.uid, task, 'start'),
                )
              }
            >
              <Play /> Start task
            </button>
          )}
          {canPerform('pause', task.status) && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() =>
                run('Task paused.', () =>
                  transitionTask(db, c, context.uid, task, 'pause'),
                )
              }
            >
              <Pause /> Pause
            </button>
          )}
          {canPerform('resume', task.status) && (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={busy}
              onClick={() =>
                run('Task resumed.', () =>
                  transitionTask(db, c, context.uid, task, 'resume'),
                )
              }
            >
              <Play /> Resume
            </button>
          )}
          {canPerform('restart', task.status) && (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={busy}
              onClick={() =>
                run('Rework started.', () =>
                  transitionTask(db, c, context.uid, task, 'restart'),
                )
              }
            >
              <RotateCcw /> Start rework
            </button>
          )}
          {task.status === 'awaiting_approval' && (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => setDialog('approve')}
              >
                <ThumbsUp /> Approve
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => setDialog('request_rework')}
              >
                <RotateCcw /> Request rework
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => setDialog('reject')}
              >
                <ThumbsDown /> Reject
              </button>
            </>
          )}
          {openStatuses.includes(task.status) &&
            task.status !== 'awaiting_approval' && (
              <button
                type="button"
                className="btn btn-outline"
                disabled={busy}
                onClick={() => setDialog('issue')}
              >
                <AlertTriangle /> Report issue
              </button>
            )}
          {canPerform('cancel', task.status) && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setDialog('cancel')}
            >
              <Ban /> Cancel task
            </button>
          )}
        </div>
      </div>
      <dl className="facts" style={{ marginTop: 18 }}>
        <div className="fact">
          <dt>Site</dt>
          <dd>
            <Name context={context} kind="sites" id={task.siteId} />
          </dd>
        </div>
        {task.locationId && (
          <div className="fact">
            <dt>Location</dt>
            <dd>
              <Name context={context} kind="locations" id={task.locationId} />
            </dd>
          </div>
        )}
        {task.facilityId && (
          <div className="fact">
            <dt>Facility</dt>
            <dd>
              <Name context={context} kind="facilities" id={task.facilityId} />
            </dd>
          </div>
        )}
        {task.assetId && (
          <div className="fact">
            <dt>Asset</dt>
            <dd>
              <Name context={context} kind="assets" id={task.assetId} />
            </dd>
          </div>
        )}
        <div className="fact">
          <dt>Due</dt>
          <dd>
            <Due task={task} />
          </dd>
        </div>
        <div className="fact">
          <dt>Assigned to</dt>
          <dd>
            {task.assigneeIds.length
              ? task.assigneeIds.map((id, i) => (
                  <span key={id}>
                    {i ? ', ' : ''}
                    <Name context={context} kind="employees" id={id} />
                  </span>
                ))
              : 'Unassigned'}
          </dd>
        </div>
        <div className="fact">
          <dt>Attempt</dt>
          <dd>{task.attempt}</dd>
        </div>
        {task.cancelReason && (
          <div className="fact wide">
            <dt>Cancellation reason</dt>
            <dd>{task.cancelReason}</dd>
          </div>
        )}
      </dl>
      {error && (
        <div style={{ marginTop: 12 }}>
          <Banner tone="red" role="alert">
            {error}
          </Banner>
        </div>
      )}
      <Tabs
        label="Task sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'checklist', label: executing ? 'Checklist' : 'Checklist' },
          { value: 'timeline', label: 'Timeline' },
          { value: 'submissions', label: 'Submissions & reviews' },
          { value: 'issues', label: 'Issues' },
          { value: 'details', label: 'Template & RACI' },
        ]}
      />
      {tab === 'checklist' && (
        <div className="execution">
          {(task.content.instructions || task.notes) && (
            <Banner tone="blue" title="Instructions">
              <span style={{ whiteSpace: 'pre-wrap' }}>
                {[task.content.instructions, task.notes]
                  .filter(Boolean)
                  .join('\n\n')}
              </span>
            </Banner>
          )}
          {!executing &&
            ['pending', 'assigned', 'paused'].includes(task.status) && (
              <Banner tone="amber">
                {task.status === 'paused'
                  ? 'Resume the task to continue answering.'
                  : 'Start the task to answer the checklist.'}
              </Banner>
            )}
          {!executing &&
          !['pending', 'assigned', 'paused'].includes(task.status) ? (
            <LatestSubmission context={context} task={task} key={version} />
          ) : (
            <>
              <ChecklistForm
                content={task.content}
                answers={answers}
                onChange={executing ? setAnswers : undefined}
                disabled={!executing || busy}
                showErrors={showErrors}
              />
              {executing && (
                <>
                  <div className="field" style={{ marginTop: 14 }}>
                    <label htmlFor="task-remarks">Remarks</label>
                    <textarea
                      id="task-remarks"
                      className="input"
                      rows={3}
                      maxLength={2000}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Observations for the reviewer"
                    />
                  </div>
                  <div className="execution-bar">
                    <span className="muted small">
                      {evaluation.answered} of {evaluation.total} answered
                      {evaluation.exceptions.length > 0 &&
                        ` · ${evaluation.exceptions.length} exception(s) will be recorded`}
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-lg"
                      disabled={busy}
                      onClick={() =>
                        run('Progress saved.', () =>
                          saveProgress(db, c, context.uid, task, answers),
                        )
                      }
                    >
                      <Save /> Save progress
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      disabled={busy}
                      onClick={() => {
                        setShowErrors(true);
                        if (Object.keys(evaluation.errors).length) {
                          setError(
                            `Complete ${Object.keys(evaluation.errors).length} required or invalid answer(s) before submitting.`,
                          );
                          return;
                        }
                        setDialog('submit');
                      }}
                    >
                      <Send /> Submit checklist
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
      {tab === 'timeline' && (
        <TaskTimeline context={context} taskId={task.id} key={version} />
      )}
      {tab === 'submissions' && (
        <SubmissionHistory context={context} task={task} key={version} />
      )}
      {tab === 'issues' && (
        <IssueList
          context={context}
          filter={{ taskId: task.id }}
          key={version}
        />
      )}
      {tab === 'details' && (
        <div>
          <p className="muted small" style={{ marginBottom: 12 }}>
            This task keeps a frozen copy of template version {task.version},
            including its responsibilities.
          </p>
          <VersionSummary context={context} content={task.content} />
        </div>
      )}
      {dialog === 'submit' && (
        <ConfirmDialog
          title="Submit this checklist?"
          confirmLabel="Submit"
          tone="blue"
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() =>
            run(
              task.approvalRequired
                ? 'Submitted for approval.'
                : 'Task completed.',
              () => submitTask(db, c, context.uid, task, answers, remarks),
            )
          }
        >
          {`Submitted answers are permanent. ${task.approvalRequired ? 'A reviewer will approve it or request rework.' : 'The task completes on submission.'}${evaluation.exceptions.length ? ` ${evaluation.exceptions.length} exception(s) will be recorded for follow-up.` : ''}${evaluation.evidencePending.length ? ' Some evidence will be marked pending until file storage is available.' : ''}`}
        </ConfirmDialog>
      )}
      {dialog === 'cancel' && (
        <ReasonDialog
          title="Cancel this task?"
          label="Reason for cancelling"
          confirm="Cancel task"
          busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={(r) =>
            run('Task cancelled.', () =>
              transitionTask(db, c, context.uid, task, 'cancel', { note: r }),
            )
          }
        />
      )}
      {dialog === 'approve' && (
        <ConfirmDialog
          title="Approve this submission?"
          confirmLabel="Approve"
          tone="blue"
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() =>
            run('Submission approved.', () =>
              reviewTask(db, c, context.uid, task, 'approve', ''),
            )
          }
        >
          The task will be marked complete. The decision is permanent and
          recorded with your name.
        </ConfirmDialog>
      )}
      {dialog === 'request_rework' && (
        <ReasonDialog
          title="Request rework?"
          label="What needs to be corrected?"
          confirm="Request rework"
          busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={(r) =>
            run('Rework requested.', () =>
              reviewTask(db, c, context.uid, task, 'request_rework', r),
            )
          }
        />
      )}
      {dialog === 'reject' && (
        <ReasonDialog
          title="Reject and close this task?"
          label="Reason for rejection"
          confirm="Reject"
          busy={busy}
          onClose={() => setDialog(null)}
          onConfirm={(r) =>
            run('Submission rejected.', () =>
              reviewTask(db, c, context.uid, task, 'reject', r),
            )
          }
        />
      )}
      {dialog === 'assign' && (
        <AssignDrawer
          context={context}
          task={task}
          busy={busy}
          onClose={() => setDialog(null)}
          onAssign={(ids) =>
            run('Task assigned.', () =>
              transitionTask(db, c, context.uid, task, 'assign', {
                assigneeIds: ids,
              }),
            )
          }
        />
      )}
      {dialog === 'issue' && (
        <IssueDrawer
          busy={busy}
          onClose={() => setDialog(null)}
          onReport={(x) =>
            run('Issue recorded.', () =>
              reportException(db, c, context.uid, task, x),
            )
          }
        />
      )}
    </section>
  );
}
function ReasonDialog({
  title,
  label,
  confirm,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  label: string;
  confirm: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog
      title={title}
      confirmLabel={confirm}
      busy={busy || !reason.trim()}
      onCancel={onClose}
      onConfirm={() => onConfirm(reason)}
    >
      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="reason">
          {label}
          <span className="req" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="reason"
          autoFocus
          className="input"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </ConfirmDialog>
  );
}
function AssignDrawer({
  context,
  task,
  busy,
  onClose,
  onAssign,
}: {
  context: Context;
  task: Task;
  busy: boolean;
  onClose: () => void;
  onAssign: (ids: string[]) => void;
}) {
  const [ids, setIds] = useState<string[]>(task.assigneeIds),
    [suggested, setSuggested] = useState<string[]>();
  const rule = task.content.assignment;
  return (
    <Drawer
      narrow
      title={task.assigneeIds.length ? 'Reassign task' : 'Assign task'}
      subtitle="Assignment history is kept on the timeline."
      icon={<IconCircle icon={UserPlus} tone="blue" />}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !ids.length}
            onClick={() => onAssign(ids)}
          >
            Save assignment
          </button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">Add employee</span>
        <Picker
          context={context}
          kind="employees"
          label="Employee"
          placeholder="Add employee"
          value=""
          onChange={(x) =>
            x && !ids.includes(x) && setIds([...ids, x].slice(0, 10))
          }
        />
      </div>
      <div className="chips" style={{ margin: '12px 0' }}>
        {ids.map((id) => (
          <span key={id} className="pill tone-green">
            <Name context={context} kind="employees" id={id} />
            <button
              type="button"
              className="chip-x"
              aria-label="Remove assignee"
              onClick={() => setIds(ids.filter((x) => x !== id))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {rule.mode !== 'manual' && (
        <>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={async () =>
              setSuggested(
                await eligibleEmployees(
                  context.services.db,
                  context.company.companyId,
                  rule,
                ),
              )
            }
          >
            <Users /> Suggest from template rule ({humanize(rule.mode)})
          </button>
          {suggested && (
            <div className="chips" style={{ marginTop: 10 }}>
              {suggested.length ? (
                suggested.map((id) => (
                  <button
                    type="button"
                    key={id}
                    className="chip-toggle"
                    aria-pressed={ids.includes(id)}
                    onClick={() =>
                      setIds(
                        ids.includes(id)
                          ? ids.filter((x) => x !== id)
                          : [...ids, id].slice(0, 10),
                      )
                    }
                  >
                    <Name context={context} kind="employees" id={id} />
                  </button>
                ))
              ) : (
                <span className="muted small">
                  No eligible employees found.
                </span>
              )}
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}
function IssueDrawer({
  busy,
  onClose,
  onReport,
}: {
  busy: boolean;
  onClose: () => void;
  onReport: (x: {
    type: string;
    severity: 'warning' | 'critical';
    description: string;
  }) => void;
}) {
  const [x, setX] = useState({
    type: exceptionTypes[0] as string,
    severity: 'warning' as 'warning' | 'critical',
    description: '',
  });
  return (
    <Drawer
      narrow
      title="Report an issue"
      subtitle="Issues are kept for follow-up. Work orders arrive in Phase 4."
      icon={<IconCircle icon={AlertTriangle} tone="red" />}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy || !x.description.trim()}
            onClick={() => onReport(x)}
          >
            Record issue
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label htmlFor="issue-type">Issue type</label>
          <select
            id="issue-type"
            className="input"
            value={x.type}
            onChange={(e) => setX({ ...x, type: e.target.value })}
          >
            {exceptionTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="field-label">Severity</span>
          <Segmented
            label="Severity"
            value={x.severity}
            onChange={(s) => setX({ ...x, severity: s })}
            options={[
              { value: 'warning', label: 'Warning' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
        </div>
        <div className="field wide">
          <label htmlFor="issue-desc">
            What did you find?
            <span className="req" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id="issue-desc"
            className="input"
            rows={4}
            maxLength={1000}
            value={x.description}
            onChange={(e) => setX({ ...x, description: e.target.value })}
          />
        </div>
      </div>
    </Drawer>
  );
}
function TaskTimeline({
  context,
  taskId,
}: {
  context: Context;
  taskId: string;
}) {
  const [events, setEvents] = useState<TaskEvent[]>();
  useEffect(() => {
    taskEvents(context.services.db, context.company.companyId, taskId).then(
      setEvents,
    );
  }, [context, taskId]);
  if (!events) return <Skeleton rows={3} />;
  return (
    <>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Append-only operational history. Entries are written by signed-in users
        and protected from editing by the security rules; an independent trusted
        audit trail arrives with the Phase 4 backend.
      </p>
      <EventList context={context} events={events} showTask={false} />
    </>
  );
}
function AnswerView({ task, s }: { task: Task; s: Submission }) {
  return (
    <div className="answers">
      {task.content.questions
        .filter(
          (q) =>
            s.answers[q.id] !== undefined || s.evidencePending.includes(q.id),
        )
        .map((q) => {
          const ex = s.exceptions.find((e) => e.questionId === q.id);
          return (
            <div key={q.id} className="answer-row">
              <span className="muted">{q.label}</span>
              <strong>
                {s.answers[q.id] ? (
                  humanize(s.answers[q.id].replaceAll('|', ', ')) +
                  (q.unit ? ' ' + q.unit : '')
                ) : (
                  <Pill tone="amber">Evidence pending</Pill>
                )}
              </strong>
              {ex && (
                <Pill tone={ex.severity === 'critical' ? 'red' : 'amber'}>
                  {ex.reason}
                </Pill>
              )}
            </div>
          );
        })}
    </div>
  );
}
function LatestSubmission({ context, task }: { context: Context; task: Task }) {
  const [subs, setSubs] = useState<Submission[]>();
  useEffect(() => {
    submissions(context.services.db, context.company.companyId, task.id).then(
      setSubs,
    );
  }, [context, task.id]);
  if (!subs) return <Skeleton rows={2} />;
  const last = subs.at(-1);
  if (!last)
    return <p className="muted">No checklist was submitted for this task.</p>;
  return (
    <div>
      <Banner
        tone={
          task.status === 'completed'
            ? 'green'
            : task.status === 'rework_required'
              ? 'amber'
              : 'blue'
        }
        title={`Attempt ${last.attempt} submitted ${formatInstant(last.submittedAt.toDate())}`}
      >
        {task.status === 'rework_required'
          ? 'Rework was requested. Start rework to answer a new attempt; this one stays on record.'
          : 'Submitted answers are permanent.'}
      </Banner>
      <AnswerView task={task} s={last} />
      {last.remarks && (
        <p style={{ marginTop: 10 }}>
          <strong>Remarks:</strong> {last.remarks}
        </p>
      )}
    </div>
  );
}
function SubmissionHistory({
  context,
  task,
}: {
  context: Context;
  task: Task;
}) {
  const [data, setData] = useState<{
    subs: Submission[];
    decisions: Approval[];
  }>();
  useEffect(() => {
    Promise.all([
      submissions(context.services.db, context.company.companyId, task.id),
      approvals(context.services.db, context.company.companyId, task.id),
    ]).then(([subs, decisions]) => setData({ subs, decisions }));
  }, [context, task.id]);
  if (!data) return <Skeleton rows={2} />;
  if (!data.subs.length)
    return <Empty icon={ListChecks} title="No submissions yet" />;
  return (
    <div className="queue">
      {data.subs.map((s) => {
        const d = data.decisions.find((x) => x.attempt === s.attempt);
        return (
          <div key={s.id} className="submission-card">
            <div className="submission-head">
              <strong>Attempt {s.attempt}</strong>
              <span className="muted small">
                Submitted by <Actor context={context} uid={s.submittedBy} /> ·{' '}
                {formatInstant(s.submittedAt.toDate())}
              </span>
              {d ? (
                <Pill
                  tone={
                    d.decision === 'approve'
                      ? 'green'
                      : d.decision === 'reject'
                        ? 'red'
                        : 'amber'
                  }
                >
                  {actionLabels[d.decision]}
                </Pill>
              ) : task.status === 'awaiting_approval' &&
                s.attempt === task.attempt ? (
                <Pill tone="amber">Awaiting review</Pill>
              ) : null}
            </div>
            <AnswerView task={task} s={s} />
            {s.remarks && (
              <p className="small" style={{ marginTop: 8 }}>
                <strong>Remarks:</strong> {s.remarks}
              </p>
            )}
            {d && (
              <p className="small" style={{ marginTop: 8 }}>
                <strong>
                  Review by <Actor context={context} uid={d.reviewerUid} />:
                </strong>{' '}
                {d.reason || 'Approved'} · {formatInstant(d.decidedAt.toDate())}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
export function IssueList({
  context,
  filter,
  onOpen,
}: {
  context: Context;
  filter: { taskId?: string; status?: string };
  onOpen?: (id: string) => void;
}) {
  const [rows, setRows] = useState<TaskException[]>(),
    [act, setAct] = useState<{
      x: TaskException;
      to: 'acknowledged' | 'closed';
    }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  const toast = useToast();
  const key = JSON.stringify(filter);
  useEffect(() => {
    listExceptions(
      context.services.db,
      context.company.companyId,
      JSON.parse(key),
    )
      .then((r) => setRows(r.rows))
      .catch((e) => setError(friendly(e)));
  }, [context, key, version]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!rows) return <Skeleton rows={2} />;
  if (!rows.length)
    return <Empty icon={CheckCircle2} title="No issues recorded" />;
  return (
    <>
      <div className="queue">
        {rows.map((x) => (
          <div key={x.id} className="queue-row issue-row">
            <IconCircle
              icon={AlertTriangle}
              tone={x.severity === 'critical' ? 'red' : 'amber'}
            />
            <div style={{ minWidth: 0 }}>
              <div className="t">{x.type}</div>
              <div className="s">{x.description}</div>
              <div className="small muted">
                {formatInstant(x.detectedAt.toDate())}
                {x.resolutionNote ? ' · ' + x.resolutionNote : ''}
              </div>
            </div>
            <Pill
              tone={
                x.status === 'open'
                  ? 'red'
                  : x.status === 'acknowledged'
                    ? 'amber'
                    : 'green'
              }
            >
              {humanize(x.status)}
            </Pill>
            <div className="row-actions">
              {onOpen && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onOpen(x.taskId)}
                >
                  Task
                </button>
              )}
              {x.status === 'open' && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setAct({ x, to: 'acknowledged' })}
                >
                  Acknowledge
                </button>
              )}
              {x.status !== 'closed' && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setAct({ x, to: 'closed' })}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {act && (
        <ReasonDialog
          title={
            act.to === 'closed'
              ? 'Close this issue?'
              : 'Acknowledge this issue?'
          }
          label="Note"
          confirm={act.to === 'closed' ? 'Close issue' : 'Acknowledge'}
          busy={busy}
          onClose={() => setAct(undefined)}
          onConfirm={async (note) => {
            setBusy(true);
            try {
              await updateException(
                context.services.db,
                context.company.companyId,
                context.uid,
                act.x,
                act.to,
                note,
              );
              toast(
                act.to === 'closed' ? 'Issue closed.' : 'Issue acknowledged.',
              );
              setAct(undefined);
              setVersion((v) => v + 1);
            } catch (e) {
              toast(friendly(e), 'red');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}

/* ================================================================ other pages */
export function AssignmentsPage({
  context,
  onOpen,
}: {
  context: Context;
  onOpen: (id: string) => void;
}) {
  const [view, setView] = useState<'unassigned' | 'employee'>('unassigned'),
    [employee, setEmployee] = useState('');
  return (
    <>
      <div className="rise">
        <Segmented
          label="Assignment view"
          value={view}
          onChange={setView}
          options={[
            { value: 'unassigned', label: 'Unassigned tasks' },
            { value: 'employee', label: 'Workload by employee' },
          ]}
        />
      </div>
      {view === 'unassigned' ? (
        <TaskRegister
          context={context}
          onOpen={onOpen}
          fixedStatus="pending"
          title="Waiting for assignment"
          allowCreate={false}
        />
      ) : (
        <section className="card card-pad rise">
          <div className="field" style={{ maxWidth: 360, marginBottom: 14 }}>
            <span className="field-label">Employee</span>
            <Picker
              context={context}
              kind="employees"
              label="Employee"
              value={employee}
              onChange={setEmployee}
            />
          </div>
          {employee ? (
            <EmployeeTasks
              key={employee}
              context={context}
              employeeId={employee}
              onOpen={onOpen}
            />
          ) : (
            <Empty icon={CalendarClock} title="Choose an employee">
              See every task assigned to them, ordered by due time.
            </Empty>
          )}
        </section>
      )}
      <Banner tone="blue" title="How assignment works in Phase 3">
        Tasks are assigned manually, with suggestions from the template’s
        assignment rule (department, team, shift or site). Automatic, shift- and
        leave-aware assignment arrives with the Phase 4 scheduler.
      </Banner>
    </>
  );
}
function EmployeeTasks({
  context,
  employeeId,
  onOpen,
}: {
  context: Context;
  employeeId: string;
  onOpen: (id: string) => void;
}) {
  const [rows, setRows] = useState<Task[]>();
  useEffect(() => {
    listTasks(context.services.db, context.company.companyId, {
      assigneeId: employeeId,
    }).then((r) => setRows(r.rows));
  }, [context, employeeId]);
  if (!rows) return <Skeleton rows={2} />;
  if (!rows.length) return <Empty title="No tasks assigned" />;
  return (
    <div className="queue">
      {rows.map((t) => (
        <button
          type="button"
          key={t.id}
          className="queue-row compact"
          onClick={() => onOpen(t.id)}
        >
          <IconCircle icon={ClipboardCheck} tone={statusTone[t.status]} />
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div className="t">{t.title}</div>
            <div className="s">
              <Due task={t} />
            </div>
          </div>
          <TaskStatusPill status={t.status} />
        </button>
      ))}
    </div>
  );
}
export function HistoryPage({
  context,
  onOpen,
}: {
  context: Context;
  onOpen: (id: string) => void;
}) {
  const [tab, setTab] = useState('activity'),
    [status, setStatus] = useState('open'),
    [events, setEvents] = useState<TaskEvent[]>(),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [more, setMore] = useState(false);
  useEffect(() => {
    recentEvents(context.services.db, context.company.companyId).then((r) => {
      setEvents(r.rows);
      setCursor(r.cursor);
      setMore(r.hasMore);
    });
  }, [context]);
  return (
    <section className="card card-pad rise">
      <Tabs
        label="History"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'activity', label: 'Activity' },
          { value: 'issues', label: 'Issues' },
        ]}
      />
      {tab === 'activity' ? (
        !events ? (
          <Skeleton rows={3} />
        ) : !events.length ? (
          <Empty icon={HistoryIcon} title="No task activity yet" />
        ) : (
          <>
            <EventList context={context} events={events} onOpen={onOpen} />
            {more && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={async () => {
                  const r = await recentEvents(
                    context.services.db,
                    context.company.companyId,
                    cursor,
                  );
                  setEvents((v) => [...(v || []), ...r.rows]);
                  setCursor(r.cursor);
                  setMore(r.hasMore);
                }}
              >
                Load more
              </button>
            )}
          </>
        )
      ) : (
        <>
          <div className="toolbar">
            <Segmented
              label="Issue status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'acknowledged', label: 'Acknowledged' },
                { value: 'closed', label: 'Closed' },
              ]}
            />
          </div>
          <IssueList
            key={status}
            context={context}
            filter={{ status }}
            onOpen={onOpen}
          />
        </>
      )}
    </section>
  );
}
/** A task area page; opening a task adds ?task=<id> so links and Back work. */
export function TaskArea({
  context,
  screen,
}: {
  context: Context;
  screen:
    'taskDashboard' | 'tasks' | 'taskAssignments' | 'approvals' | 'taskHistory';
}) {
  const [params, setParams] = useSearchParams();
  const taskId = params.get('task') || '';
  const open = (id: string) => setParams({ task: id });
  if (taskId)
    return (
      <TaskDetail
        key={taskId}
        context={context}
        taskId={taskId}
        onBack={() => setParams({})}
      />
    );
  if (screen === 'taskDashboard')
    return <TaskDashboard context={context} onOpen={open} />;
  if (screen === 'taskAssignments')
    return <AssignmentsPage context={context} onOpen={open} />;
  if (screen === 'approvals')
    return (
      <>
        <Banner tone="blue" title="Review rules">
          Reviewers must be company owners or admins and cannot approve work
          they submitted themselves. Every decision is permanent.
        </Banner>
        <TaskRegister
          context={context}
          onOpen={open}
          fixedStatus="awaiting_approval"
          title="Submissions awaiting review"
          allowCreate={false}
        />
      </>
    );
  if (screen === 'taskHistory')
    return <HistoryPage context={context} onOpen={open} />;
  return <TaskRegister context={context} onOpen={open} />;
}
