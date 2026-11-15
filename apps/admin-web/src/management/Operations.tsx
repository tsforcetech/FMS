import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  Inbox,
  Link2,
  Plus,
  RefreshCw,
  ScrollText,
  Send,
} from 'lucide-react';
import { formatDate, formatInstant, type Context } from './context';
import { Name } from './Tasks';
import { Picker } from './Picker';
import { listRuns, type SchedulerRun } from './scheduling';
import { breachedCases, openCaseCount } from './casesStore';
import {
  defaultRetention,
  getRetention,
  loadAudit,
  saveRetention,
  taskCounts,
  type AuditEntry,
  type Retention,
} from './reportsStore';
import {
  clientPlaces,
  intakeRequest,
  listCustomerLinks,
  listCustomerMembers,
  listServiceRequests,
  reconcileRequest,
  saveCustomerLink,
  statusLabel,
  teamReply,
  type CustomerLink,
  type CustomerPlace,
  type ServiceRequest,
} from './customerStore';
import {
  Banner,
  Drawer,
  Empty,
  Pill,
  Segmented,
  Skeleton,
  StatusPill,
  friendly,
  humanize,
  useToast,
} from '../ui/kit';

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [v, setV] = useState(0);
  useEffect(() => {
    let live = true;
    setData(undefined);
    setError('');
    fn()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, v]);
  return { data, error, reload: () => setV((x) => x + 1) };
}
function Card({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="card card-pad rise">
      <div className="card-head">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
const ago = (d: Date | null) => {
  if (!d) return 'never';
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  return m < 60
    ? `${m} min ago`
    : m < 2880
      ? `${Math.round(m / 60)} h ago`
      : `${Math.round(m / 1440)} days ago`;
};

/* ===================================================== operational monitoring */
export function OperationalMonitoring({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const { data, error, reload } = useLoad(async () => {
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 86400000);
    const [runs, counts, breachedWo, breachedCmp, openWo, openCmp] =
      await Promise.all([
        listRuns(db, c, 20),
        taskCounts(db, c, { from, to: new Date(now.getTime() + 86400000) }),
        breachedCases(db, c, 'workOrders', now),
        breachedCases(db, c, 'complaints', now),
        openCaseCount(db, c, 'workOrders'),
        openCaseCount(db, c, 'complaints'),
      ]);
    const requests = await listServiceRequests(db, c, 'submitted').catch(
      () => [],
    );
    return {
      runs,
      counts,
      breached: breachedWo.length + breachedCmp.length,
      openWo,
      openCmp,
      requests,
    };
  }, [db, c]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={6} />;
  const last = data.runs[0] as SchedulerRun | undefined;
  const lastAt = last?.startedAt?.toDate() || null;
  const stale = !lastAt || Date.now() - lastAt.getTime() > 26 * 3600000;
  const failed = data.runs.filter(
    (r) => r.status === 'error' || r.status === 'partial',
  );
  const checks: [string, boolean, string][] = [
    [
      'Task generation ran in the last 26 hours',
      !stale,
      last
        ? `Last run ${ago(lastAt)} (${last.mode})`
        : 'No scheduler run recorded',
    ],
    [
      'Recent scheduler runs succeeded',
      !failed.length,
      failed.length
        ? `${failed.length} of the last ${data.runs.length} runs reported errors`
        : 'No errors in recent runs',
    ],
    [
      'No overdue tasks in the last 30 days',
      !data.counts.overdue,
      `${data.counts.overdue} overdue`,
    ],
    [
      'No cases past their resolution target',
      !data.breached,
      `${data.breached} breached`,
    ],
    [
      'Customer requests taken in',
      !data.requests.length,
      `${data.requests.length} waiting for intake`,
    ],
  ];
  return (
    <>
      <Banner tone="blue" title="What this page can and cannot see">
        Checks read the records the system writes (scheduler runs, tasks, cases,
        requests). Mobile devices keep their offline queue on the device; sync
        conflicts surface as task exceptions and in the device’s Sync screen,
        not here.
      </Banner>
      <Card
        title="Health checks"
        actions={
          <button
            type="button"
            className="icon-btn"
            aria-label="Refresh"
            onClick={reload}
          >
            <RefreshCw />
          </button>
        }
      >
        <ul className="health-list">
          {checks.map(([label, ok, detail]) => (
            <li key={label}>
              <Pill tone={ok ? 'green' : 'amber'} dot>
                {ok ? 'OK' : 'Attention'}
              </Pill>
              <strong>{label}</strong>
              <span className="muted small">{detail}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Open work">
        <div className="stat-grid">
          {(
            [
              ['Open tasks (30 days)', data.counts.open],
              ['Awaiting approval', data.counts.awaiting],
              ['Open work orders', data.openWo],
              ['Open complaints', data.openCmp],
            ] as const
          ).map(([l, v]) => (
            <div className="stat" key={l}>
              <strong>{v}</strong>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Recent scheduler runs">
        {!data.runs.length ? (
          <Empty icon={Activity} title="No runs recorded yet" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Mode</th>
                  <th>Window</th>
                  <th>Created</th>
                  <th>Unassigned</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.startedAt
                        ? formatInstant(
                            r.startedAt.toDate(),
                            context.company.timeZone,
                          )
                        : '—'}
                    </td>
                    <td>{humanize(r.mode)}</td>
                    <td>
                      {formatDate(r.windowFrom)} – {formatDate(r.windowTo)}
                    </td>
                    <td>{r.created}</td>
                    <td>{r.unassigned}</td>
                    <td>
                      <StatusPill value={r.status} />
                      {!!r.errors?.length && (
                        <div className="muted small">{r.errors[0]}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/* ============================================================= audit history */
export function AuditHistory({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const [days, setDays] = useState<'1' | '7' | '30'>('7');
  const [source, setSource] = useState('');
  const range = useMemo(() => {
    const to = new Date(Date.now() + 60000);
    return { from: new Date(to.getTime() - Number(days) * 86400000), to };
  }, [days]);
  const { data, error } = useLoad(
    () => loadAudit(db, c, range, 300),
    [db, c, range],
  );
  const rows = (data || []).filter((x) => !source || x.source === source);
  return (
    <>
      <Banner tone="amber" title="How this history is protected">
        Events are written in the same transaction as the change and the
        security rules allow them to be created but never edited or deleted from
        the apps. That is append-only protection by access rules — not a
        cryptographically tamper-evident ledger, and a project owner with server
        access could still alter data.
      </Banner>
      <section className="card card-pad rise">
        <div className="toolbar">
          <Segmented
            label="Period"
            value={days}
            onChange={setDays}
            options={[
              { value: '1', label: '24 hours' },
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
            ]}
          />
          <label className="sr-only" htmlFor="audit-src">
            Source
          </label>
          <select
            className="select"
            id="audit-src"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">All events</option>
            <option value="task">Tasks</option>
            <option value="case">Work orders, complaints, escalations</option>
            <option value="stock">Stock movements</option>
            <option value="transfer">Asset transfers</option>
          </select>
        </div>
        {error && <Banner tone="red">{error}</Banner>}
        {!data && !error && <Skeleton rows={6} />}
        {data && !rows.length && (
          <Empty icon={ScrollText} title="No events in this period" />
        )}
        {!!rows.length && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Source</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Detail</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x: AuditEntry) => (
                  <tr key={x.source + x.id}>
                    <td>
                      {x.at
                        ? formatInstant(x.at, context.company.timeZone)
                        : '—'}
                    </td>
                    <td>{humanize(x.source)}</td>
                    <td>{humanize(x.action || '')}</td>
                    <td className="cell-ref">{x.subject}</td>
                    <td>{x.detail}</td>
                    <td>
                      {x.actorUid === context.uid
                        ? 'You'
                        : x.actorUid
                          ? 'User ' + x.actorUid.slice(0, 6)
                          : 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.length >= 300 && (
          <p className="muted small">
            Showing the latest 300 events; narrow the period to see older ones.
          </p>
        )}
      </section>
    </>
  );
}

/* ============================================================ data retention */
export function DataRetention({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const toast = useToast();
  const { data, error } = useLoad(() => getRetention(db, c), [db, c]);
  const [v, setV] = useState<Retention>(defaultRetention);
  const [busy, setBusy] = useState(false),
    [err, setErr] = useState('');
  useEffect(() => {
    if (data) setV(data);
  }, [data]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={4} />;
  const field = (key: keyof Retention, label: string, help: string) => (
    <div className="field">
      <label htmlFor={`ret-${key}`}>{label}</label>
      <input
        className="input"
        id={`ret-${key}`}
        type="number"
        min={1}
        value={v[key] as number}
        onChange={(e) => setV({ ...v, [key]: Number(e.target.value) })}
      />
      <span className="help">{help}</span>
    </div>
  );
  return (
    <>
      <Banner
        tone="amber"
        title="Policy only — nothing is deleted automatically yet"
      >
        These periods record your company’s retention policy. On the free
        Firebase plan there is no server job to purge data, so expired records
        are not removed automatically. Purging will need an approved server
        process (or the Phase 8 export-and-purge tool).
      </Banner>
      <section className="card card-pad rise">
        {err && (
          <Banner tone="red" role="alert">
            {err}
          </Banner>
        )}
        <div className="form-grid">
          {field(
            'gpsDays',
            'GPS locations (days)',
            'Check-in/out coordinates and GPS evidence',
          )}
          {field(
            'attendanceDays',
            'Attendance records (days)',
            'Check-in/out times and corrections',
          )}
          {field(
            'photoDays',
            'Photos (days)',
            'Evidence photos in storage, when photo storage is enabled',
          )}
          {field(
            'notificationDays',
            'Notifications (days)',
            'In-app notification history',
          )}
          {field('auditDays', 'Audit history (days)', 'Minimum one year')}
          <div className="field wide">
            <label htmlFor="ret-note">Policy note</label>
            <textarea
              className="input"
              id="ret-note"
              value={v.note}
              onChange={(e) => setV({ ...v, note: e.target.value })}
            />
          </div>
        </div>
        <div className="toolbar">
          {data.updatedAt && (
            <span className="muted small">
              Last changed{' '}
              {formatInstant(data.updatedAt.toDate(), context.company.timeZone)}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                await saveRetention(db, c, context.uid, v);
                toast('Retention policy saved');
              } catch (e) {
                setErr(friendly(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Save policy
          </button>
        </div>
      </section>
    </>
  );
}

/* ===================================================== backup & recovery status */
export function BackupStatus() {
  const rows: [string, 'green' | 'amber' | 'red', string, string][] = [
    [
      'Managed Firestore backups / PITR',
      'red',
      'Not configured',
      'Requires the paid Blaze plan. Not enabled — upgrading needs separate approval.',
    ],
    [
      'Scheduled Firestore export',
      'red',
      'Not configured',
      'Managed export to Cloud Storage requires Blaze. Not enabled.',
    ],
    [
      'Manual JSON export',
      'amber',
      'Available, operator-run',
      'scripts/backup-export.ts reads one company with the operator’s own login and writes a local JSON snapshot. Run it before releases and keep the file securely.',
    ],
    [
      'Security rules and indexes',
      'green',
      'Versioned in Git',
      'firebase/firestore.rules and firestore.indexes.json can be redeployed from any commit.',
    ],
    [
      'Application code',
      'green',
      'Versioned in Git',
      'Every release is a commit on main; GitHub Pages can be rebuilt from it.',
    ],
  ];
  return (
    <>
      <Banner tone="red" title="There is no automatic backup today">
        This project runs on the free Firebase Spark plan. Firestore managed
        backups, point-in-time recovery and scheduled exports are not available
        on it, and none are configured. Accidental deletion or corruption can
        only be recovered from a manual export.
      </Banner>
      <section className="card card-pad rise">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Protection</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, tone, status, note]) => (
                <tr key={name}>
                  <td>
                    <strong>{name}</strong>
                  </td>
                  <td>
                    <Pill tone={tone} dot>
                      {status}
                    </Pill>
                  </td>
                  <td>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Recovery procedure, export steps and the paid-plan option are in{' '}
          <code>docs/backup-recovery.md</code>.
        </p>
      </section>
    </>
  );
}

/* ============================================================ customer access */
export function CustomerAccess({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const [editing, setEditing] = useState<CustomerLink | 'new' | null>(null);
  const { data, error, reload } = useLoad(
    async () => ({
      links: await listCustomerLinks(db, c),
      members: await listCustomerMembers(db, c),
    }),
    [db, c],
  );
  return (
    <>
      <Banner tone="blue" title="How customers sign in">
        1) The trusted operator creates the customer’s login with the{' '}
        <strong>customer</strong> role. 2) Link it here to one client and,
        optionally, to specific allocations (e.g. only Office 201). The customer
        then uses the portal at <strong>/customer/</strong>. An email address
        alone never grants access, and customers only ever see the places listed
        on their link.
      </Banner>
      <section className="card card-pad rise">
        <div className="toolbar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Refresh"
            onClick={reload}
          >
            <RefreshCw />
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing('new')}
          >
            <Plus /> Link a customer login
          </button>
        </div>
        {error && <Banner tone="red">{error}</Banner>}
        {!data && !error && <Skeleton rows={3} />}
        {data && !data.links.length && (
          <Empty icon={Link2} title="No customer logins linked yet" />
        )}
        {!!data?.links.length && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Login</th>
                  <th>Client</th>
                  <th>Places</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.links.map((l) => (
                  <tr key={l.uid}>
                    <td>{l.contactName || '—'}</td>
                    <td className="cell-ref">{l.uid.slice(0, 10)}</td>
                    <td>{l.clientName}</td>
                    <td>
                      {l.places
                        .slice(0, 3)
                        .map((p) => p.locationName || p.siteName)
                        .join(', ')}
                      {l.places.length > 3 && ` +${l.places.length - 3}`}
                      {!l.allocationIds.length && (
                        <div className="muted small">
                          All allocations of the client
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusPill value={l.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setEditing(l)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && data && (
        <CustomerDrawer
          context={context}
          link={editing === 'new' ? null : editing}
          members={data.members.filter(
            (m) =>
              m.status === 'active' &&
              (editing !== 'new' || !data.links.some((l) => l.uid === m.uid)),
          )}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </>
  );
}
function CustomerDrawer({
  context,
  link,
  members,
  onClose,
  onSaved,
}: {
  context: Context;
  link: CustomerLink | null;
  members: { uid: string; displayName?: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const db = context.services.db,
    c = context.company.companyId;
  const toast = useToast();
  const [uid, setUid] = useState(link?.uid || '');
  const [clientId, setClientId] = useState(link?.clientId || '');
  const [contactName, setContactName] = useState(link?.contactName || '');
  const [scope, setScope] = useState<string[]>(link?.allocationIds || []);
  const [places, setPlaces] = useState<CustomerPlace[]>();
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setPlaces(undefined);
    if (clientId)
      clientPlaces(db, c, clientId, [])
        .then((p) => live && setPlaces(p))
        .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [db, c, clientId]);
  async function save(status: 'active' | 'revoked') {
    setBusy(true);
    setError('');
    try {
      await saveCustomerLink(db, c, context.uid, {
        uid,
        clientId,
        contactName,
        allocationIds: scope,
        status,
      });
      toast(status === 'revoked' ? 'Access revoked' : 'Customer access saved');
      onSaved();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Drawer
      title={link ? 'Customer access' : 'Link a customer login'}
      onClose={onClose}
      footer={
        <>
          {link && link.status === 'active' && (
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() => void save('revoked')}
            >
              Revoke access
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !uid || !clientId}
            onClick={() => void save('active')}
          >
            {link?.status === 'revoked' ? 'Restore access' : 'Save'}
          </button>
        </>
      }
    >
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <div className="form-grid">
        <div className="field wide">
          <label htmlFor="cust-login">Customer login</label>
          {link ? (
            <input
              className="input"
              id="cust-login"
              value={link.uid}
              disabled
            />
          ) : (
            <select
              className="select"
              id="cust-login"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
            >
              <option value="">Choose a provisioned customer login…</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName || m.uid}
                </option>
              ))}
            </select>
          )}
          {!link && !members.length && (
            <span className="help">
              No unlinked customer logins. Ask the operator to provision one.
            </span>
          )}
        </div>
        <div className="field wide">
          <label className="field-label" htmlFor="cust-client">
            Client
          </label>
          <Picker
            context={context}
            kind="clients"
            label="Client"
            inputId="cust-client"
            value={clientId}
            disabled={!!link}
            onChange={setClientId}
          />
        </div>
        <div className="field wide">
          <label htmlFor="cust-contact">Contact name</label>
          <input
            className="input"
            id="cust-contact"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </div>
      </div>
      {clientId && (
        <fieldset className="field wide">
          <legend className="field-label">Places this login may see</legend>
          {!places && <Skeleton rows={2} />}
          {places && !places.length && (
            <Banner tone="amber">
              This client has no contract allocations yet.
            </Banner>
          )}
          {places?.map((p) => (
            <label key={p.allocationId} className="check">
              <input
                type="checkbox"
                checked={scope.includes(p.allocationId)}
                onChange={(e) =>
                  setScope(
                    e.target.checked
                      ? [...scope, p.allocationId]
                      : scope.filter((x) => x !== p.allocationId),
                  )
                }
              />{' '}
              {p.siteName}
              {p.locationName && ` · ${p.locationName}`}{' '}
              <span className="muted small">
                {formatDate(p.startDate)} –{' '}
                {p.endDate ? formatDate(p.endDate) : 'open'}
              </span>
            </label>
          ))}
          <p className="help">
            Leave all unticked to allow every allocation of this client (up to
            40). Tick up to 10 to restrict.
          </p>
        </fieldset>
      )}
    </Drawer>
  );
}

/* =========================================================== service requests */
export function ServiceRequests({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const toast = useToast();
  const [status, setStatus] = useState<ServiceRequest['status'] | ''>('');
  const [open, setOpen] = useState<ServiceRequest | null>(null);
  const { data, error, reload } = useLoad(
    () => listServiceRequests(db, c, status || undefined),
    [db, c, status],
  );
  // Keep customer status in step with complaints moved on by staff.
  useEffect(() => {
    if (!data) return;
    const stale = data.filter(
      (r) => r.complaintId && !['closed', 'cancelled'].includes(r.status),
    );
    if (!stale.length) return;
    Promise.all(
      stale
        .slice(0, 20)
        .map((r) => reconcileRequest(db, c, context.uid, r).catch(() => false)),
    ).then((x) => x.some(Boolean) && reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  return (
    <>
      <Banner tone="blue" title="Customer service requests">
        Requests from the customer portal become complaints in the normal
        workflow (with SLA). Customers see only the status, a short timeline,
        your replies and the resolution summary — never internal notes,
        assignees or costs.
      </Banner>
      <section className="card card-pad rise">
        <div className="toolbar">
          <label className="sr-only" htmlFor="sr-status">
            Status
          </label>
          <select
            className="select"
            id="sr-status"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as ServiceRequest['status'] | '')
            }
          >
            <option value="">All statuses</option>
            {Object.entries(statusLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="icon-btn"
            aria-label="Refresh"
            onClick={reload}
          >
            <RefreshCw />
          </button>
        </div>
        {error && <Banner tone="red">{error}</Banner>}
        {!data && !error && <Skeleton rows={4} />}
        {data && !data.length && (
          <Empty icon={Inbox} title="No service requests" />
        )}
        {!!data?.length && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Raised</th>
                  <th>Place</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id}>
                    <td className="cell-ref">{r.reference}</td>
                    <td>
                      {r.createdAt
                        ? formatInstant(
                            r.createdAt.toDate(),
                            context.company.timeZone,
                          )
                        : '—'}
                    </td>
                    <td>
                      <Name context={context} kind="sites" id={r.siteId} />
                      {r.locationId && (
                        <>
                          {' · '}
                          <Name
                            context={context}
                            kind="locations"
                            id={r.locationId}
                          />
                        </>
                      )}
                    </td>
                    <td>{r.category}</td>
                    <td>
                      <StatusPill value={r.priority} />
                    </td>
                    <td>
                      <StatusPill value={r.status} />
                    </td>
                    <td>
                      {!r.complaintId ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={async () => {
                            try {
                              await intakeRequest(db, c, context.uid, r);
                              toast('Complaint created from request');
                              reload();
                            } catch (e) {
                              toast(friendly(e));
                            }
                          }}
                        >
                          Take in
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setOpen(r)}
                        >
                          Open
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && (
        <RequestDrawer
          context={context}
          request={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null);
            reload();
          }}
        />
      )}
    </>
  );
}
function RequestDrawer({
  context,
  request: r,
  onClose,
  onChanged,
}: {
  context: Context;
  request: ServiceRequest;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [text, setText] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const tz = context.company.timeZone;
  return (
    <Drawer
      title={r.reference}
      subtitle={`${r.category} · ${statusLabel[r.status]}`}
      onClose={onClose}
    >
      {r.status === 'reopen_requested' && (
        <Banner tone="amber" title="The customer asked to reopen">
          Review their message below, then reopen the complaint{' '}
          {r.complaintId && <code>{r.complaintId}</code>} from the Complaints
          page.
        </Banner>
      )}
      <p>{r.description}</p>
      {r.resolutionSummary && (
        <Banner tone="green" title="Resolution shown to the customer">
          {r.resolutionSummary}
        </Banner>
      )}
      <h3>Timeline (visible to the customer)</h3>
      <ul className="timeline-list">
        {r.timeline.map((t, i) => (
          <li key={i}>
            <strong>{t.label}</strong>{' '}
            <span className="muted small">
              {formatInstant(t.at.toDate(), tz)}
            </span>
          </li>
        ))}
      </ul>
      <h3>Messages</h3>
      {!r.remarks.length && <p className="muted small">No messages yet.</p>}
      <ul className="timeline-list">
        {r.remarks.map((m, i) => (
          <li key={i}>
            <Pill tone={m.by === 'customer' ? 'violet' : 'blue'}>
              {m.by === 'customer' ? 'Customer' : 'Service team'}
            </Pill>{' '}
            {m.text}{' '}
            <span className="muted small">
              {formatInstant(m.at.toDate(), tz)}
            </span>
          </li>
        ))}
      </ul>
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <div className="field">
        <label htmlFor="sr-reply">
          Reply to the customer (they will see this)
        </label>
        <textarea
          className="input"
          id="sr-reply"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy || !text.trim()}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await teamReply(
              context.services.db,
              context.company.companyId,
              context.uid,
              r.id,
              text,
            );
            onChanged();
          } catch (e) {
            setError(friendly(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Send /> Send reply
      </button>
      <p className="muted small">
        Internal discussion belongs on the complaint itself — it is never shown
        to the customer. Opened{' '}
        {r.createdAt ? formatInstant(r.createdAt.toDate(), tz) : ''}.
      </p>
    </Drawer>
  );
}
