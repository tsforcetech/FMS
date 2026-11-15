import { ExportMenu } from '../ui/ExportMenu';
import { caseListDataset } from './exportSets';
import { exportBlocked } from './planGate';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection,
  getDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  MessageSquareWarning,
  Megaphone,
  Plus,
  RefreshCw,
  Timer,
  Hammer,
  Package,
  CheckCircle2,
  Wrench,
  CalendarClock,
  ShieldAlert,
} from 'lucide-react';
import {
  availableActions,
  caseDefinitions,
  caseKinds,
  complaintSources,
  formatQuantity,
  linkedCaseId,
  parseQuantity,
  problemCategories,
  severities,
  slaState,
  unitDecimals,
  openStatuses,
  type CaseKind,
} from '@facilityos/shared';
import {
  breachedCases,
  caseEvents,
  createCase,
  emptyCase,
  escalateFurther,
  getCase,
  listCases,
  openCaseCount,
  transitionCase,
  workOrderFromComplaint,
  workOrderMaterials,
  type CaseEvent,
  type CaseRecord,
  type NewCase,
} from './casesStore';
import { listExceptions, type Task, type TaskException } from './tasksStore';
import { newMovementId, postMovement, recordById } from './store';
import { formatInstant, type Context } from './context';
import { Picker } from './Picker';
import { Name, PriorityPill, TaskDetail, TaskStatusPill } from './Tasks';
import {
  Banner,
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

const kindIcon = {
  workOrders: ClipboardList,
  complaints: MessageSquareWarning,
  escalations: Megaphone,
} as const;
const statusTone: Record<string, Tone> = {
  reported: 'gray',
  open: 'gray',
  raised: 'red',
  reviewed: 'blue',
  assigned: 'blue',
  acknowledged: 'blue',
  in_progress: 'violet',
  on_hold: 'amber',
  resolved: 'green',
  verified: 'green',
  closed: 'gray',
  cancelled: 'gray',
};
export function CaseStatusPill({ status }: { status: string }) {
  return (
    <Pill tone={statusTone[status] || 'gray'} dot>
      {humanize(status)}
    </Pill>
  );
}
function SlaPill({ r }: { r: CaseRecord }) {
  if (!r.resolutionDueAt) return <span className="muted small">No SLA</span>;
  const done = r.resolvedAt?.toDate() || r.closedAt?.toDate() || null;
  const s = slaState(r.resolutionDueAt.toDate(), done);
  if (s.met) return <Pill tone="green">Met</Pill>;
  if (s.breached)
    return (
      <Pill tone="red">Breached {Math.round(s.overdueMinutes / 60)}h</Pill>
    );
  const left = (r.resolutionDueAt.toMillis() - Date.now()) / 3600000;
  return (
    <Pill tone={left < 4 ? 'amber' : 'blue'}>
      Due {formatInstant(r.resolutionDueAt.toDate())}
    </Pill>
  );
}
function Field({
  label,
  children,
  wide,
  required,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  required?: boolean;
}) {
  return (
    <div className={'field' + (wide ? ' wide' : '')}>
      <span className="field-label">
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
      </span>
      {children}
    </div>
  );
}

/* ================================================================ area */
export function CaseArea({
  context,
  kind,
}: {
  context: Context;
  kind: CaseKind;
}) {
  const [params, setParams] = useSearchParams();
  const id = params.get('case') || '';
  if (id)
    return (
      <CaseDetail
        key={id}
        context={context}
        kind={kind}
        id={id}
        onBack={() => setParams({})}
      />
    );
  return (
    <CaseList
      context={context}
      kind={kind}
      onOpen={(x) => setParams({ case: x })}
    />
  );
}
function CaseList({
  context,
  kind,
  onOpen,
}: {
  context: Context;
  kind: CaseKind;
  onOpen: (id: string) => void;
}) {
  const def = caseDefinitions[kind];
  const [status, setStatus] = useState(''),
    [siteId, setSiteId] = useState(''),
    [rows, setRows] = useState<CaseRecord[]>(),
    [error, setError] = useState(''),
    [creating, setCreating] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    setRows(undefined);
    listCases(context.services.db, context.company.companyId, kind, {
      status: status === 'open' ? '' : status,
      siteId,
    })
      .then(
        (r) =>
          live &&
          setRows(
            status === 'open'
              ? r.filter((x) => def.open.includes(x.status))
              : r,
          ),
      )
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [context, kind, status, siteId, version, def.open]);
  const Icon = kindIcon[kind];
  return (
    <section className="card card-pad rise">
      <div className="toolbar">
        <select
          className="select"
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="open">All open</option>
          {def.statuses.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
        <div style={{ minWidth: 220 }}>
          <Picker
            context={context}
            kind="sites"
            label="Site"
            value={siteId}
            placeholder="All sites"
            onChange={setSiteId}
          />
        </div>
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
          dataset={() =>
            caseListDataset(context, kind, { status, siteId }, rows || [])
          }
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreating(true)}
        >
          <Plus />{' '}
          {kind === 'workOrders'
            ? 'New work order'
            : kind === 'complaints'
              ? 'Register complaint'
              : 'Raise escalation'}
        </button>
      </div>
      {error && <Banner tone="red">{error}</Banner>}
      {!rows && !error && <Skeleton rows={3} />}
      {rows && !rows.length && (
        <Empty icon={Icon} title={`No ${def.title.toLowerCase()}`}>
          {kind === 'workOrders'
            ? 'Corrective work orders come from reported issues, complaints, inspections or manual requests.'
            : kind === 'complaints'
              ? 'Register complaints from clients, staff or inspections and track them to closure.'
              : 'Escalations route problems to another department with response and resolution targets.'}
        </Empty>
      )}
      {!!rows?.length && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{def.singular[0].toUpperCase() + def.singular.slice(1)}</th>
                <th>Site</th>
                <th>Priority</th>
                <th>SLA</th>
                <th>Created</th>
                <th>Status</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  className="clickable"
                  style={{ ['--i' as string]: i }}
                  onClick={() => onOpen(r.id)}
                >
                  <td>
                    <div className="cell-main">
                      <span
                        className={
                          'icon-circle tone-' +
                          (r.priority === 'critical' ? 'red' : 'violet')
                        }
                        style={{ width: 38, height: 38 }}
                      >
                        <Icon size={17} />
                      </span>
                      <div>
                        <button
                          type="button"
                          className="text-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(r.id);
                          }}
                        >
                          {r.title}
                        </button>
                        <div className="s">
                          <span className="code-chip">{r.number}</span>
                          {kind === 'escalations' && (
                            <span className="muted small">
                              {' '}
                              · Level {r.level}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="cell-ref">
                    <Name context={context} kind="sites" id={r.siteId} />
                  </td>
                  <td>
                    <PriorityPill p={r.priority} />
                  </td>
                  <td>
                    <SlaPill r={r} />
                  </td>
                  <td className="small">
                    {r.createdAt ? formatInstant(r.createdAt.toDate()) : '—'}
                  </td>
                  <td>
                    <CaseStatusPill status={r.status} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn sm"
                      aria-label={'Open ' + r.title}
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
        <NewCaseDrawer
          context={context}
          kind={kind}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onOpen(id);
          }}
        />
      )}
    </section>
  );
}

/* ================================================================ create */
export function NewCaseDrawer({
  context,
  kind,
  initial,
  onClose,
  onCreated,
}: {
  context: Context;
  kind: CaseKind;
  initial?: Partial<NewCase>;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const def = caseDefinitions[kind];
  const [v, setV] = useState<NewCase>({ ...emptyCase(kind), ...initial }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  const set = (p: Partial<NewCase>) => setV((x) => ({ ...x, ...p }));
  async function save() {
    setBusy(true);
    setError('');
    try {
      const r = await createCase(
        context.services.db,
        context.company.companyId,
        context.uid,
        kind,
        v,
      );
      toast(
        r.created
          ? `${def.singular[0].toUpperCase() + def.singular.slice(1)} created.`
          : `This ${def.singular} already exists; opening it.`,
      );
      onCreated(r.id);
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  }
  const Icon = kindIcon[kind];
  return (
    <Drawer
      title={
        kind === 'workOrders'
          ? 'New work order'
          : kind === 'complaints'
            ? 'Register complaint'
            : 'Raise escalation'
      }
      subtitle="Response and resolution targets come from the matching SLA policy and are stored when the record is created."
      icon={<IconCircle icon={Icon} tone="violet" />}
      onClose={() => !busy && onClose()}
      footer={
        <>
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
            {busy ? 'Saving…' : 'Create'}
          </button>
        </>
      }
    >
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <section className="form-section">
        <div className="form-grid">
          <div className="field wide">
            <label htmlFor="case-title">
              Title
              <span className="req" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="case-title"
              className="input"
              maxLength={160}
              value={v.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
          <div className="field wide">
            <label htmlFor="case-desc">Description</label>
            <textarea
              id="case-desc"
              className="input"
              rows={3}
              maxLength={4000}
              value={v.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="case-priority">Priority</label>
            <select
              id="case-priority"
              className="select"
              value={v.priority}
              onChange={(e) =>
                set({ priority: e.target.value as NewCase['priority'] })
              }
            >
              {severities.map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="case-severity">Severity</label>
            <select
              id="case-severity"
              className="select"
              value={v.severity}
              onChange={(e) =>
                set({ severity: e.target.value as NewCase['severity'] })
              }
            >
              {severities.map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="case-category">Problem category</label>
            <select
              id="case-category"
              className="select"
              value={v.category}
              onChange={(e) => set({ category: e.target.value })}
            >
              <option value="">Not set</option>
              {problemCategories.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {kind === 'complaints' && (
            <div className="field">
              <label htmlFor="case-source">Source</label>
              <select
                id="case-source"
                className="select"
                value={v.sourceType}
                onChange={(e) => set({ sourceType: e.target.value })}
              >
                {complaintSources
                  .filter((s) => s !== 'task_exception')
                  .map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="case-reporter">Reported by</label>
            <input
              id="case-reporter"
              className="input"
              maxLength={120}
              value={v.reportedBy}
              onChange={(e) => set({ reportedBy: e.target.value })}
            />
          </div>
        </div>
      </section>
      <section className="form-section">
        <h3>Where</h3>
        <div className="form-grid">
          <Field label="Site" required>
            <Picker
              context={context}
              kind="sites"
              label="Site"
              value={v.siteId}
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
          <Field label="Asset">
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
          <Field label="Department">
            <Picker
              context={context}
              kind="departments"
              label="Department"
              value={v.departmentId}
              onChange={(x) => set({ departmentId: x })}
            />
          </Field>
          {kind === 'escalations' && (
            <Field label="Escalate to department" required>
              <Picker
                context={context}
                kind="departments"
                label="Escalate to department"
                value={v.targetDepartmentId}
                onChange={(x) => set({ targetDepartmentId: x })}
              />
            </Field>
          )}
          {kind === 'complaints' && (
            <Field label="Client">
              <Picker
                context={context}
                kind="clients"
                label="Client"
                value={v.clientId}
                onChange={(x) => set({ clientId: x })}
              />
            </Field>
          )}
          {kind === 'workOrders' && (
            <div className="field">
              <label htmlFor="case-planned">Planned date</label>
              <input
                id="case-planned"
                type="datetime-local"
                className="input"
                value={v.plannedDate}
                onChange={(e) => set({ plannedDate: e.target.value })}
              />
            </div>
          )}
        </div>
      </section>
      <p className="small muted">
        Photo evidence is pending activation: it needs Cloud Storage (Firebase
        Blaze plan), which has not been approved. Nothing is uploaded or stored
        in the database as an image.
      </p>
    </Drawer>
  );
}

/* ================================================================ detail */
function CaseDetail({
  context,
  kind,
  id,
  onBack,
}: {
  context: Context;
  kind: CaseKind;
  id: string;
  onBack: () => void;
}) {
  const def = caseDefinitions[kind];
  const db = context.services.db,
    c = context.company.companyId;
  const [r, setR] = useState<CaseRecord | null>(),
    [events, setEvents] = useState<CaseEvent[]>([]),
    [children, setChildren] = useState<CaseRecord[]>([]),
    [action, setAction] = useState(''),
    [escalating, setEscalating] = useState(false),
    [issuing, setIssuing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  const [, setParams] = useSearchParams();
  const toast = useToast();
  useEffect(() => {
    let live = true;
    Promise.all([
      getCase(db, c, kind, id),
      caseEvents(db, c, kind, id),
      listCases(db, c, 'escalations', { sourceId: id }),
    ])
      .then(([x, e, ch]) => {
        if (!live) return;
        setR(x);
        setEvents(e);
        setChildren(ch);
      })
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c, kind, id, version]);
  if (error && r === undefined) return <Banner tone="red">{error}</Banner>;
  if (r === undefined) return <Skeleton rows={4} />;
  if (!r)
    return (
      <Empty
        icon={kindIcon[kind]}
        title="Record not found"
        action={
          <button className="btn btn-outline" onClick={onBack}>
            Back
          </button>
        }
      />
    );
  const actions = availableActions(kind, r.status);
  const open = def.open.includes(r.status);
  const Icon = kindIcon[kind];
  const pathOf = (k: string) =>
    k === 'workOrders'
      ? 'work-orders'
      : k === 'complaints'
        ? 'complaints'
        : 'escalations';
  return (
    <>
      <section className="card card-pad rise">
        <button
          type="button"
          className="link-btn"
          onClick={onBack}
          style={{ marginBottom: 14 }}
        >
          ← All {def.title.toLowerCase()}
        </button>
        <div className="detail-head">
          <IconCircle
            icon={Icon}
            tone={statusTone[r.status] || 'gray'}
            size="lg"
          />
          <div className="grow">
            <h1>{r.title}</h1>
            <div className="meta">
              <span className="code-chip">{r.number}</span>
              <CaseStatusPill status={r.status} />
              <PriorityPill p={r.priority} />
              <SlaPill r={r} />
              {kind === 'escalations' && (
                <Pill tone="violet">Level {r.level}</Pill>
              )}
            </div>
          </div>
        </div>
        {error && (
          <Banner tone="red" role="alert">
            {error}
          </Banner>
        )}
        <div className="page-actions task-actions">
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              className={
                'btn ' +
                (['resolve', 'close', 'verify'].includes(a.id)
                  ? 'btn-primary'
                  : 'btn-outline')
              }
              disabled={busy}
              onClick={() => setAction(a.id)}
            >
              {a.label}
            </button>
          ))}
          {kind === 'complaints' && !r.workOrderId && open && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const w = await workOrderFromComplaint(db, c, context.uid, r);
                  toast(
                    w.created
                      ? 'Work order created and linked.'
                      : 'This complaint already has a work order.',
                  );
                  setVersion((x) => x + 1);
                } catch (e) {
                  setError(friendly(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <ClipboardList /> Create work order
            </button>
          )}
          {open && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setEscalating(true)}
            >
              <Megaphone />{' '}
              {kind === 'escalations' ? 'Escalate further' : 'Escalate'}
            </button>
          )}
          {kind === 'workOrders' &&
            ['assigned', 'in_progress', 'on_hold'].includes(r.status) && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setIssuing(true)}
              >
                <Package /> Issue material
              </button>
            )}
        </div>
        <dl className="facts" style={{ marginTop: 18 }}>
          <Fact label="Site">
            <Name context={context} kind="sites" id={r.siteId} />
          </Fact>
          {r.locationId && (
            <Fact label="Location">
              <Name context={context} kind="locations" id={r.locationId} />
            </Fact>
          )}
          {r.assetId && (
            <Fact label="Asset">
              <Name context={context} kind="assets" id={r.assetId} />
            </Fact>
          )}
          {r.departmentId && (
            <Fact label="Department">
              <Name context={context} kind="departments" id={r.departmentId} />
            </Fact>
          )}
          {r.targetDepartmentId && (
            <Fact label="Escalated to">
              <Name
                context={context}
                kind="departments"
                id={r.targetDepartmentId}
              />
            </Fact>
          )}
          <Fact label="Assigned to">
            {r.assigneeIds.length ? (
              r.assigneeIds.map((a) => (
                <div key={a}>
                  <Name context={context} kind="employees" id={a} />
                </div>
              ))
            ) : (
              <span className="muted">Nobody yet</span>
            )}
          </Fact>
          <Fact label="Category">{r.category || '—'}</Fact>
          <Fact label="Source">
            {humanize(r.sourceType)}
            {r.sourceId && r.sourceType !== 'manual' && (
              <span className="muted small"> · {r.sourceId.slice(0, 18)}</span>
            )}
          </Fact>
          <Fact label="Reported by">{r.reportedBy || '—'}</Fact>
          <Fact label="Response target">
            {r.responseDueAt ? formatInstant(r.responseDueAt.toDate()) : '—'}
            {r.respondedAt && (
              <div className="small muted">
                Responded {formatInstant(r.respondedAt.toDate())}
              </div>
            )}
          </Fact>
          <Fact label="Resolution target">
            {r.resolutionDueAt
              ? formatInstant(r.resolutionDueAt.toDate())
              : '—'}
            {r.resolvedAt && (
              <div className="small muted">
                Resolved {formatInstant(r.resolvedAt.toDate())}
              </div>
            )}
          </Fact>
          {r.workOrderId && (
            <Fact label="Work order">
              <a
                className="text-link"
                href={`#/work-orders?case=${r.workOrderId}`}
              >
                Open linked work order
              </a>
            </Fact>
          )}
          {r.complaintId && (
            <Fact label="Complaint">
              <a
                className="text-link"
                href={`#/complaints?case=${r.complaintId}`}
              >
                Open complaint
              </a>
            </Fact>
          )}
          {r.parentId && (
            <Fact label="Escalated from">
              <a
                className="text-link"
                href={`#/escalations?case=${r.parentId}`}
              >
                Previous level
              </a>
            </Fact>
          )}
          {r.description && (
            <div className="fact wide">
              <dt>Description</dt>
              <dd style={{ whiteSpace: 'pre-wrap', fontWeight: 400 }}>
                {r.description}
              </dd>
            </div>
          )}
          {r.resolution && (
            <div className="fact wide">
              <dt>Resolution</dt>
              <dd style={{ whiteSpace: 'pre-wrap', fontWeight: 400 }}>
                {r.resolution}
              </dd>
            </div>
          )}
        </dl>
      </section>
      <div
        className="dash-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>History</h2>
          </div>
          <ol className="timeline">
            {events.map((e) => (
              <li key={e.id}>
                <strong>
                  {e.action === 'create'
                    ? 'Created'
                    : e.action === 'link'
                      ? 'Linked'
                      : def.actions[e.action]?.label || humanize(e.action)}
                </strong>
                <span className="small muted">
                  {' '}
                  {e.fromStatus ? `${humanize(e.fromStatus)} → ` : ''}
                  {humanize(e.toStatus)} ·{' '}
                  {e.actorUid === context.uid
                    ? 'You'
                    : 'User ' + e.actorUid.slice(0, 6)}{' '}
                  · {e.at ? formatInstant(e.at.toDate()) : ''}
                </span>
                {e.note && <div className="small">{e.note}</div>}
              </li>
            ))}
          </ol>
        </section>
        {kind === 'workOrders' && (
          <Materials context={context} workOrderId={r.id} version={version} />
        )}
        {!!children.length && (
          <section className="card card-pad rise">
            <div className="card-head">
              <h2>Escalations</h2>
            </div>
            <div className="queue">
              {children.map((x) => (
                <a
                  key={x.id}
                  className="queue-row"
                  href={`#/${pathOf('escalations')}?case=${x.id}`}
                  onClick={() => setParams({})}
                >
                  <IconCircle icon={Megaphone} tone="red" />
                  <div>
                    <div className="t">
                      {x.number} · Level {x.level}
                    </div>
                    <div className="s">{x.title}</div>
                  </div>
                  <CaseStatusPill status={x.status} />
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
      {action && (
        <ActionDrawer
          context={context}
          record={r}
          action={action}
          onClose={(changed) => {
            setAction('');
            if (changed) setVersion((x) => x + 1);
          }}
        />
      )}
      {escalating && (
        <EscalateDrawer
          context={context}
          record={r}
          onClose={(newId) => {
            setEscalating(false);
            if (newId) setVersion((x) => x + 1);
          }}
        />
      )}
      {issuing && (
        <IssueMaterialDrawer
          context={context}
          record={r}
          onClose={(changed) => {
            setIssuing(false);
            if (changed) setVersion((x) => x + 1);
          }}
        />
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
function ActionDrawer({
  context,
  record,
  action,
  onClose,
}: {
  context: Context;
  record: CaseRecord;
  action: string;
  onClose: (changed: boolean) => void;
}) {
  const a = caseDefinitions[record.kind].actions[action];
  const [note, setNote] = useState(''),
    [assignees, setAssignees] = useState<string[]>(record.assigneeIds),
    [pick, setPick] = useState(''),
    [dept, setDept] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  async function save() {
    setBusy(true);
    setError('');
    try {
      await transitionCase(
        context.services.db,
        context.company.companyId,
        context.uid,
        record,
        action,
        {
          note,
          ...(a.assigns ? { assigneeIds: assignees } : {}),
          ...(a.redirects ? { targetDepartmentId: dept } : {}),
        },
      );
      toast(`${a.label} — done.`);
      onClose(true);
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  }
  return (
    <Drawer
      narrow
      title={a.label}
      subtitle={`${record.number} · ${humanize(record.status)} → ${humanize(a.to)}`}
      onClose={() => !busy && onClose(false)}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => onClose(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={
              'btn ' + (action === 'cancel' ? 'btn-danger' : 'btn-primary')
            }
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : a.label}
          </button>
        </>
      }
    >
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      {a.assigns && (
        <div className="field">
          <span className="field-label">Assign to</span>
          <div className="chips">
            {assignees.map((x) => (
              <span key={x} className="pill tone-blue">
                <Name context={context} kind="employees" id={x} />
                <button
                  type="button"
                  className="chip-x"
                  aria-label="Remove"
                  onClick={() => setAssignees(assignees.filter((y) => y !== x))}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {assignees.length < 10 && (
            <Picker
              context={context}
              kind="employees"
              label="Add employee"
              value={pick}
              onChange={(x) => {
                if (x && !assignees.includes(x))
                  setAssignees([...assignees, x]);
                setPick('');
              }}
            />
          )}
        </div>
      )}
      {a.redirects && (
        <div className="field">
          <span className="field-label">
            New department
            <span className="req" aria-hidden="true">
              *
            </span>
          </span>
          <Picker
            context={context}
            kind="departments"
            label="New department"
            value={dept}
            exclude={record.targetDepartmentId}
            onChange={setDept}
          />
        </div>
      )}
      <div className="field">
        <label htmlFor="case-note">
          {a.resolves ? 'Resolution' : a.reason ? 'Reason' : 'Note (optional)'}
          {a.reason && (
            <span className="req" aria-hidden="true">
              *
            </span>
          )}
        </label>
        <textarea
          id="case-note"
          className="input"
          rows={4}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Drawer>
  );
}
function EscalateDrawer({
  context,
  record,
  onClose,
}: {
  context: Context;
  record: CaseRecord;
  onClose: (id?: string) => void;
}) {
  const [dept, setDept] = useState(''),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  return (
    <Drawer
      narrow
      title={
        record.kind === 'escalations'
          ? 'Escalate to the next level'
          : 'Escalate'
      }
      subtitle={`${record.number} ${record.title}`}
      icon={<IconCircle icon={Megaphone} tone="red" />}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => onClose()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !dept}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await escalateFurther(
                  context.services.db,
                  context.company.companyId,
                  context.uid,
                  record,
                  dept,
                  reason,
                );
                toast(
                  r.created
                    ? 'Escalation raised.'
                    : 'This escalation level already exists.',
                );
                onClose(r.id);
              } catch (e) {
                setError(friendly(e));
                setBusy(false);
              }
            }}
          >
            Raise escalation
          </button>
        </>
      }
    >
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <div className="field">
        <span className="field-label">
          Department
          <span className="req" aria-hidden="true">
            *
          </span>
        </span>
        <Picker
          context={context}
          kind="departments"
          label="Department"
          value={dept}
          onChange={setDept}
        />
      </div>
      <div className="field">
        <label htmlFor="esc-reason">
          Reason
          <span className="req" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="esc-reason"
          className="input"
          rows={4}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <p className="small muted">
        Repeating the same escalation level returns the existing record; it is
        never duplicated.
      </p>
    </Drawer>
  );
}
function Materials({
  context,
  workOrderId,
  version,
}: {
  context: Context;
  workOrderId: string;
  version: number;
}) {
  const [rows, setRows] =
      useState<(Record<string, unknown> & { id: string })[]>(),
    [units, setUnits] = useState<
      Record<string, { name: string; unit: string }>
    >({});
  useEffect(() => {
    let live = true;
    workOrderMaterials(
      context.services.db,
      context.company.companyId,
      workOrderId,
    ).then(async (r) => {
      const m: Record<string, { name: string; unit: string }> = {};
      for (const id of [...new Set(r.map((x) => String(x.materialId)))]) {
        const rec = await recordById(
          context.services.db,
          context.company.companyId,
          'materials',
          id,
        );
        if (rec)
          m[id] = {
            name: String(rec.values.name),
            unit: String(rec.values.unit),
          };
      }
      if (!live) return;
      setUnits(m);
      setRows(r);
    });
    return () => {
      live = false;
    };
  }, [context, workOrderId, version]);
  return (
    <section className="card card-pad rise">
      <div className="card-head">
        <h2>Materials used</h2>
      </div>
      {!rows ? (
        <Skeleton rows={2} />
      ) : !rows.length ? (
        <p className="small muted">
          No materials issued against this work order.
        </p>
      ) : (
        <div className="queue">
          {rows.map((m) => {
            const u = units[String(m.materialId)];
            return (
              <div key={m.id} className="queue-row">
                <IconCircle
                  icon={Package}
                  tone={m.movementType === 'reversal' ? 'amber' : 'blue'}
                />
                <div>
                  <div className="t">{u?.name || 'Material'}</div>
                  <div className="s">
                    {humanize(String(m.movementType))} ·{' '}
                    {u
                      ? formatQuantity(
                          Number(m.quantity),
                          unitDecimals(u.unit),
                        ) +
                        ' ' +
                        u.unit
                      : String(m.quantity)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
function IssueMaterialDrawer({
  context,
  record,
  onClose,
}: {
  context: Context;
  record: CaseRecord;
  onClose: (changed: boolean) => void;
}) {
  const [material, setMaterial] = useState(''),
    [store, setStore] = useState(''),
    [employee, setEmployee] = useState(record.assigneeIds[0] || ''),
    [qty, setQty] = useState(''),
    [unit, setUnit] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  const db = context.services.db,
    c = context.company.companyId;
  const movementId = useMemo(() => newMovementId(db, c), [db, c]);
  useEffect(() => {
    if (!material) return;
    recordById(db, c, 'materials', material).then((m) =>
      setUnit(String(m?.values.unit || '')),
    );
  }, [db, c, material]);
  async function save() {
    if (!material || !store) return setError('Choose a material and a store.');
    const q = parseQuantity(qty, unit ? unitDecimals(unit) : 0);
    if (!q.ok || q.minor <= 0)
      return setError(q.ok ? 'Enter a quantity greater than zero.' : q.error);
    setBusy(true);
    setError('');
    try {
      await postMovement(
        db,
        c,
        context.uid,
        {
          movementType: 'issue',
          materialId: material,
          fromStoreId: store,
          toStoreId: '',
          quantity: q.minor,
          movementDate: new Date().toISOString().slice(0, 10),
          reason: '',
          reference: record.number,
          notes: `Issued for ${record.number}`,
          issuedToEmployeeId: employee,
          issuedToLocationId: record.locationId,
          reversesId: '',
          workOrderId: record.id,
        },
        movementId,
      );
      toast('Material issued and stock updated.');
      onClose(true);
    } catch (e) {
      setError(friendly(e));
      setBusy(false);
    }
  }
  return (
    <Drawer
      narrow
      title="Issue material"
      subtitle={`Against ${record.number}. Stock changes through the inventory ledger.`}
      icon={<IconCircle icon={Package} tone="blue" />}
      onClose={() => !busy && onClose(false)}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => onClose(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? 'Posting…' : 'Issue'}
          </button>
        </>
      }
    >
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <Field label="Material" required>
        <Picker
          context={context}
          kind="materials"
          label="Material"
          value={material}
          onChange={setMaterial}
        />
      </Field>
      <Field label="From store" required>
        <Picker
          context={context}
          kind="stores"
          label="Store"
          value={store}
          onChange={setStore}
        />
      </Field>
      <div className="field">
        <label htmlFor="issue-qty">Quantity{unit ? ` (${unit})` : ''}</label>
        <input
          id="issue-qty"
          className="input"
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </div>
      <Field label="Issued to">
        <Picker
          context={context}
          kind="employees"
          label="Employee"
          value={employee}
          onChange={setEmployee}
        />
      </Field>
    </Drawer>
  );
}

/* ================================================================ reported issues */
export function ReportedIssues({ context }: { context: Context }) {
  const [params, setParams] = useSearchParams();
  const task = params.get('task') || '';
  const [status, setStatus] = useState('open'),
    [rows, setRows] = useState<TaskException[]>(),
    [linked, setLinked] = useState<
      Record<string, { wo?: boolean; esc?: boolean }>
    >({}),
    [escalate, setEscalate] = useState<TaskException | null>(null),
    [busy, setBusy] = useState(''),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  const toast = useToast();
  const db = context.services.db,
    c = context.company.companyId;
  useEffect(() => {
    let live = true;
    listExceptions(db, c, status ? { status } : {})
      .then(async (r) => {
        const map: Record<string, { wo?: boolean; esc?: boolean }> = {};
        await Promise.all(
          r.rows.map(async (x) => {
            const [wo, esc] = await Promise.all([
              getDoc(
                doc(
                  db,
                  'companies',
                  c,
                  'workOrders',
                  linkedCaseId('workOrders', 'task_exception', x.id),
                ),
              ),
              getDoc(
                doc(
                  db,
                  'companies',
                  c,
                  'escalations',
                  linkedCaseId('escalations', 'task_exception', x.id, 'L1'),
                ),
              ),
            ]);
            map[x.id] = { wo: wo.exists(), esc: esc.exists() };
          }),
        );
        if (!live) return;
        setLinked(map);
        setRows(r.rows);
      })
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c, status, version]);
  if (task)
    return (
      <TaskDetail
        key={task}
        context={context}
        taskId={task}
        onBack={() => setParams({})}
      />
    );
  const base = (x: TaskException): NewCase => ({
    ...emptyCase('workOrders'),
    title: `${x.type}: ${x.description}`.slice(0, 160),
    description: x.description,
    priority: x.severity === 'critical' ? 'high' : 'medium',
    severity: x.severity === 'critical' ? 'high' : 'medium',
    siteId: x.siteId,
    locationId: x.locationId,
    facilityId: x.facilityId,
    assetId: x.assetId,
    sourceType: 'task_exception',
    sourceId: x.id,
    reportedBy: 'Task checklist',
  });
  return (
    <section className="card card-pad rise">
      <div className="toolbar">
        <select
          className="select"
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="closed">Closed</option>
          <option value="">All</option>
        </select>
        <button
          type="button"
          className="icon-btn"
          aria-label="Refresh"
          onClick={() => setVersion((x) => x + 1)}
        >
          <RefreshCw />
        </button>
      </div>
      {error && <Banner tone="red">{error}</Banner>}
      {!rows && !error && <Skeleton rows={3} />}
      {rows && !rows.length && (
        <Empty icon={CheckCircle2} title="No reported issues">
          Failed checklist answers and issues reported during tasks appear here.
        </Empty>
      )}
      {!!rows?.length && (
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
                  {formatInstant(x.detectedAt.toDate())} ·{' '}
                  <Name context={context} kind="sites" id={x.siteId} /> ·{' '}
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setParams({ task: x.taskId })}
                  >
                    Open task
                  </button>
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
                {linked[x.id]?.wo ? (
                  <a
                    className="btn btn-outline btn-sm"
                    href={`#/work-orders?case=${linkedCaseId('workOrders', 'task_exception', x.id)}`}
                  >
                    View work order
                  </a>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={busy === x.id}
                    onClick={async () => {
                      setBusy(x.id);
                      try {
                        const r = await createCase(
                          db,
                          c,
                          context.uid,
                          'workOrders',
                          base(x),
                        );
                        toast(
                          r.created
                            ? 'Work order created.'
                            : 'A work order already exists for this issue.',
                        );
                        setVersion((v) => v + 1);
                      } catch (e) {
                        setError(friendly(e));
                      } finally {
                        setBusy('');
                      }
                    }}
                  >
                    <Wrench /> Create work order
                  </button>
                )}
                {linked[x.id]?.esc ? (
                  <a
                    className="btn btn-ghost btn-sm"
                    href={`#/escalations?case=${linkedCaseId('escalations', 'task_exception', x.id, 'L1')}`}
                  >
                    View escalation
                  </a>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEscalate(x)}
                  >
                    <Megaphone /> Escalate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {escalate && (
        <NewCaseDrawer
          context={context}
          kind="escalations"
          initial={{ ...base(escalate), sourceType: 'task_exception' }}
          onClose={() => setEscalate(null)}
          onCreated={() => {
            setEscalate(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </section>
  );
}

/* ================================================================ SLA */
export function SlaMonitor({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const [data, setData] = useState<{
      open: Record<string, number>;
      breached: CaseRecord[];
      atRisk: CaseRecord[];
    }>(),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const now = new Date();
    Promise.all(
      caseKinds.map(async (k) => {
        const [open, breached, risk] = await Promise.all([
          openCaseCount(db, c, k),
          breachedCases(db, c, k, now),
          getDocs(
            query(
              collection(db, 'companies', c, k),
              where('status', 'in', caseDefinitions[k].open),
              where('resolutionDueAt', '>=', Timestamp.fromDate(now)),
              where(
                'resolutionDueAt',
                '<',
                Timestamp.fromMillis(now.getTime() + 8 * 3600000),
              ),
              orderBy('resolutionDueAt'),
              limit(50),
            ),
          ).then((r) =>
            r.docs.map((d) => ({ id: d.id, ...d.data() }) as CaseRecord),
          ),
        ]);
        return { k, open, breached, risk };
      }),
    )
      .then((all) => {
        if (!live) return;
        setData({
          open: Object.fromEntries(all.map((x) => [x.k, x.open])),
          breached: all.flatMap((x) => x.breached),
          atRisk: all.flatMap((x) => x.risk),
        });
      })
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={4} />;
  const path = (k: string) => (k === 'workOrders' ? 'work-orders' : k);
  const list = (rows: CaseRecord[], empty: string) =>
    rows.length ? (
      <div className="queue">
        {rows.map((r) => (
          <a
            key={r.kind + r.id}
            className="queue-row"
            href={`#/${path(r.kind)}?case=${r.id}`}
          >
            <IconCircle
              icon={kindIcon[r.kind]}
              tone={statusTone[r.status] || 'gray'}
            />
            <div style={{ minWidth: 0 }}>
              <div className="t">
                {r.number} · {r.title}
              </div>
              <div className="s">
                Resolution target{' '}
                {r.resolutionDueAt
                  ? formatInstant(r.resolutionDueAt.toDate())
                  : '—'}
              </div>
            </div>
            <SlaPill r={r} />
          </a>
        ))}
      </div>
    ) : (
      <p className="small muted">{empty}</p>
    );
  return (
    <>
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>Service levels</h2>
          <span className="muted small">
            From stored response and resolution targets
          </span>
        </div>
        <div className="stat-grid">
          {caseKinds.map((k) => (
            <div key={k} className="stat stat-blue">
              <strong>{data.open[k]}</strong>
              <span>Open {caseDefinitions[k].title.toLowerCase()}</span>
            </div>
          ))}
          <div className="stat stat-red">
            <strong>{data.breached.length}</strong>
            <span>Breached</span>
          </div>
          <div className="stat stat-amber">
            <strong>{data.atRisk.length}</strong>
            <span>Due within 8 hours</span>
          </div>
        </div>
      </section>
      <div
        className="dash-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>
              <ShieldAlert size={18} /> Breached
            </h2>
          </div>
          {list(
            data.breached,
            'No open items have passed their resolution target.',
          )}
        </section>
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>
              <Timer size={18} /> At risk
            </h2>
          </div>
          {list(data.atRisk, 'Nothing is due in the next 8 hours.')}
        </section>
      </div>
      <Banner tone="blue" title="How SLA status is decided">
        Targets are calculated from the matching SLA policy (calendar or site
        business hours, skipping holidays) and stored when the record is
        created. A record is breached only when it is still open after its
        stored resolution target. Notifications for breaches are sent by the
        scheduler.
      </Banner>
    </>
  );
}

/* ================================================================ maintenance */
export function MaintenanceDashboard({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const [params, setParams] = useSearchParams();
  const taskId = params.get('task') || '';
  const [data, setData] = useState<{
      plans: number;
      upcoming: Task[];
      overdue: Task[];
      openWo: number;
      breachedWo: number;
    }>(),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const now = Timestamp.now();
    const tasksQ = (...c2: Parameters<typeof query>[1][]) =>
      getDocs(
        query(collection(db, 'companies', c, 'tasks'), ...(c2 as [])),
      ).then((r) => r.docs.map((d) => ({ id: d.id, ...d.data() }) as Task));
    Promise.all([
      getDocs(
        query(
          collection(db, 'companies', c, 'recurringSchedules'),
          where('purpose', '==', 'maintenance'),
          where('status', '==', 'active'),
          orderBy('name'),
          limit(200),
        ),
      ).then((r) => r.size),
      tasksQ(
        where('origin', '==', 'maintenance'),
        where('dueAt', '>=', now),
        orderBy('dueAt'),
        limit(10),
      ),
      tasksQ(
        where('origin', '==', 'maintenance'),
        where('dueAt', '<', now),
        orderBy('dueAt', 'desc'),
        limit(100),
      ).then((r) => r.filter((t) => openStatuses.includes(t.status))),
      openCaseCount(db, c, 'workOrders'),
      breachedCases(db, c, 'workOrders').then((r) => r.length),
    ])
      .then(
        ([plans, upcoming, overdue, openWo, breachedWo]) =>
          live && setData({ plans, upcoming, overdue, openWo, breachedWo }),
      )
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c]);
  if (taskId)
    return (
      <TaskDetail
        key={taskId}
        context={context}
        taskId={taskId}
        onBack={() => setParams({})}
      />
    );
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={4} />;
  const list = (rows: Task[], empty: string) =>
    rows.length ? (
      <div className="queue">
        {rows.map((t) => (
          <button
            key={t.id}
            type="button"
            className="queue-row"
            onClick={() => setParams({ task: t.id })}
          >
            <IconCircle icon={CalendarClock} tone="violet" />
            <div style={{ minWidth: 0 }}>
              <div className="t">{t.title}</div>
              <div className="s">
                {formatInstant((t.plannedStart || t.dueAt).toDate())}
                {t.assetId && (
                  <>
                    {' · '}
                    <Name context={context} kind="assets" id={t.assetId} />
                  </>
                )}
              </div>
            </div>
            <TaskStatusPill status={t.status} />
          </button>
        ))}
      </div>
    ) : (
      <p className="small muted">{empty}</p>
    );
  return (
    <>
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>Maintenance overview</h2>
        </div>
        <div className="stat-grid">
          <a className="stat stat-violet" href="#/pm-plans">
            <strong>{data.plans}</strong>
            <span>Active PM plans</span>
          </a>
          <div className="stat stat-blue">
            <strong>{data.upcoming.length}</strong>
            <span>Upcoming (next 10)</span>
          </div>
          <div className="stat stat-red">
            <strong>{data.overdue.length}</strong>
            <span>Overdue PM tasks</span>
          </div>
          <a className="stat stat-amber" href="#/work-orders">
            <strong>{data.openWo}</strong>
            <span>Open work orders</span>
          </a>
          <div className="stat stat-red">
            <strong>{data.breachedWo}</strong>
            <span>Work orders past SLA</span>
          </div>
        </div>
      </section>
      <div
        className="dash-grid"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
      >
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>Upcoming preventive maintenance</h2>
          </div>
          {list(
            data.upcoming,
            'No generated maintenance occurrences ahead. Create a PM plan and run the scheduler.',
          )}
        </section>
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>Overdue preventive maintenance</h2>
          </div>
          {list(data.overdue.slice(0, 10), 'Nothing overdue.')}
        </section>
      </div>
    </>
  );
}
export function AssetHistory({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const [params, setParams] = useSearchParams();
  const [asset, setAsset] = useState(params.get('asset') || ''),
    [data, setData] = useState<{ tasks: Task[]; wos: CaseRecord[] }>(),
    [error, setError] = useState('');
  const taskId = params.get('task') || '';
  useEffect(() => {
    let live = true;
    if (!asset) return;
    setData(undefined);
    Promise.all([
      getDocs(
        query(
          collection(db, 'companies', c, 'tasks'),
          where('assetId', '==', asset),
          orderBy('dueAt', 'desc'),
          limit(50),
        ),
      ).then((r) => r.docs.map((d) => ({ id: d.id, ...d.data() }) as Task)),
      listCases(db, c, 'workOrders', { assetId: asset }, 50),
    ])
      .then(([tasks, wos]) => live && setData({ tasks, wos }))
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c, asset]);
  if (taskId)
    return (
      <TaskDetail
        key={taskId}
        context={context}
        taskId={taskId}
        onBack={() => setParams(asset ? { asset } : {})}
      />
    );
  return (
    <section className="card card-pad rise">
      <div className="toolbar">
        <div style={{ minWidth: 280 }}>
          <Picker
            context={context}
            kind="assets"
            label="Asset"
            value={asset}
            onChange={(x) => {
              setAsset(x);
              setParams(x ? { asset: x } : {});
            }}
          />
        </div>
      </div>
      {error && <Banner tone="red">{error}</Banner>}
      {!asset && (
        <Empty icon={Hammer} title="Choose an asset">
          See every inspection, preventive maintenance task and work order for
          one asset.
        </Empty>
      )}
      {asset && !data && !error && <Skeleton rows={3} />}
      {data && (
        <div
          className="dash-grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          }}
        >
          <div>
            <h3 className="section-title">
              Tasks and PM ({data.tasks.length})
            </h3>
            {data.tasks.length ? (
              <div className="queue">
                {data.tasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="queue-row"
                    onClick={() => setParams({ asset, task: t.id })}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="t">{t.title}</div>
                      <div className="s">
                        {formatInstant(t.dueAt.toDate())} ·{' '}
                        {t.origin === 'maintenance'
                          ? 'Preventive'
                          : t.origin === 'schedule'
                            ? 'Recurring'
                            : 'Manual'}
                      </div>
                    </div>
                    <TaskStatusPill status={t.status} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="small muted">No tasks recorded for this asset.</p>
            )}
          </div>
          <div>
            <h3 className="section-title">Work orders ({data.wos.length})</h3>
            {data.wos.length ? (
              <div className="queue">
                {data.wos.map((w) => (
                  <a
                    key={w.id}
                    className="queue-row"
                    href={`#/work-orders?case=${w.id}`}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="t">
                        {w.number} · {w.title}
                      </div>
                      <div className="s">
                        {w.createdAt ? formatInstant(w.createdAt.toDate()) : ''}
                      </div>
                    </div>
                    <CaseStatusPill status={w.status} />
                  </a>
                ))}
              </div>
            ) : (
              <p className="small muted">No work orders for this asset.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
