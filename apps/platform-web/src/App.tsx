import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  HashRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  Activity,
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  Layers,
  LogOut,
  Plus,
  ScrollText,
  Settings,
  ShieldAlert,
  CircleHelp,
} from 'lucide-react';
import type { FirebaseServices } from '@admin/firebase';
import {
  examplePlans,
  featureKeys,
  featureLabels,
  limitKeys,
  limitLabels,
  platformRoleLabels,
  recurringRevenue,
  statusOf,
  subscriptionStatuses,
  timeZones,
  type LifecycleAction,
  type PlanTerms,
  type PlatformRole,
  helpScreenUrl,
} from '@facilityos/shared';
import {
  Banner,
  Drawer,
  Empty,
  Pill,
  Skeleton,
  StatusPill,
  friendly,
  humanize,
  useToast,
} from '@admin/ui/kit';
import {
  assignPlan,
  can,
  getSub,
  getUsageOf,
  lifecycle,
  listCompanies,
  listEvents,
  listInvoices,
  listPlans,
  listSubs,
  listVersions,
  myGrant,
  paymentAdapter,
  platformRoleOf,
  registerCompany,
  requestSupport,
  saveInvoice,
  savePlan,
  supportSummary,
  type CompanyRow,
  type PlanRow,
  type VersionRow,
} from './store';

type Session = {
  services: FirebaseServices;
  user: User;
  role: PlatformRole;
  mfa: boolean;
};
const err = (e: unknown) =>
  e instanceof Error && !(e as { code?: string }).code
    ? e.message
    : friendly(e);
const fmt = (d: Date | null | undefined) =>
  d
    ? d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [v, setV] = useState(0);
  useEffect(() => {
    let live = true;
    setError('');
    fn()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(err(e)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, v]);
  return { data, error, reload: () => setV((x) => x + 1) };
}

export default function App({ services }: { services: FirebaseServices }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [state, setState] = useState<{
    role: PlatformRole | null;
    verified: boolean;
    mfa: boolean;
  }>();
  useEffect(
    () =>
      onAuthStateChanged(services.auth, async (u) => {
        setUser(u);
        setState(
          u
            ? await platformRoleOf(u).catch(() => ({
                role: null,
                verified: false,
                mfa: false,
              }))
            : undefined,
        );
      }),
    [services],
  );
  if (user === undefined || (user && !state))
    return <div className="center-state">Checking access…</div>;
  if (!user) return <Login services={services} />;
  if (!state?.role || !state.verified)
    return (
      <div className="center-state">
        <section className="card card-pad" style={{ maxWidth: 480 }}>
          <ShieldAlert size={40} />
          <h1>Not a Sharaco platform account</h1>
          <p>
            {state?.role && !state.verified
              ? 'Your platform role needs a verified email address.'
              : 'This console is for Sharaco platform staff. Company administrators sign in to the FacilityOS admin app instead — a company admin role never grants platform access.'}
          </p>
          <p className="muted small">{user.email}</p>
          <button
            className="btn btn-outline"
            onClick={() => void signOut(services.auth)}
          >
            <LogOut /> Sign out
          </button>
        </section>
      </div>
    );
  return (
    <HashRouter>
      <Shell s={{ services, user, role: state.role, mfa: state.mfa }} />
    </HashRouter>
  );
}
function Login({ services }: { services: FirebaseServices }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(services.auth, email.trim(), password);
    } catch (x) {
      setError(friendly(x));
      setBusy(false);
    }
  }
  return (
    <div className="center-state">
      <form
        className="card card-pad auth-form"
        style={{ maxWidth: 400, width: '100%' }}
        onSubmit={submit}
        noValidate
      >
        <p className="eyebrow">Sharaco Technologies</p>
        <h1>FacilityOS platform console</h1>
        <div className="field">
          <label htmlFor="p-email">Email</label>
          <input
            id="p-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label htmlFor="p-password">Password</label>
          <input
            id="p-password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && (
          <Banner tone="red" role="alert">
            {error}
          </Banner>
        )}
        <button
          className="btn btn-primary btn-block"
          disabled={busy || !email || !password}
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

const nav: [string, string, ReactNode][] = [
  ['/', 'Overview', <LayoutDashboard key="d" />],
  ['/companies', 'Companies', <Building2 key="c" />],
  ['/plans', 'Plans', <Layers key="p" />],
  ['/subscriptions', 'Subscriptions', <CreditCard key="s" />],
  ['/billing', 'Billing records', <FileText key="b" />],
  ['/audit', 'Platform audit log', <ScrollText key="a" />],
  ['/health', 'Operational health', <Activity key="h" />],
  ['/settings', 'Configuration', <Settings key="g" />],
];
function Shell({ s }: { s: Session }) {
  const location = useLocation();
  return (
    <div className="p-shell">
      <aside className="p-side">
        <div className="p-brand">
          FacilityOS <span>Platform</span>
        </div>
        <nav aria-label="Platform">
          {nav.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'} className="p-link">
              {icon}
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-who">
          <strong>{s.user.email}</strong>
          <span>{platformRoleLabels[s.role]}</span>
          <a
            className="link-btn"
            href={helpScreenUrl(
              'platform',
              location.pathname,
              import.meta.env.VITE_HELP_URL,
            )}
            target="_blank"
            rel="noopener"
            data-help-link
          >
            <CircleHelp size={14} /> Help (Sharaco platform manual)
          </a>
          <button
            className="link-btn"
            onClick={() => void signOut(s.services.auth)}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="p-main">
        {!s.mfa && (
          <div className="banner tone-amber" role="status">
            <div>
              <strong>Multi-factor sign-in is not active.</strong> The console
              is MFA-ready; enforcing it needs Firebase Identity Platform MFA to
              be enabled (pending approval).
            </div>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Overview s={s} />} />
          <Route path="/companies" element={<Companies s={s} />} />
          <Route path="/companies/:id" element={<CompanyDetail s={s} />} />
          <Route path="/plans" element={<Plans s={s} />} />
          <Route path="/subscriptions" element={<Subscriptions s={s} />} />
          <Route path="/billing" element={<Billing s={s} />} />
          <Route path="/audit" element={<Audit s={s} />} />
          <Route path="/health" element={<Health />} />
          <Route path="/settings" element={<Config s={s} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
function Head({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`stat${tone ? ' stat-' + tone : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ overview */
function Overview({ s }: { s: Session }) {
  const db = s.services.db;
  const { data, error } = useLoad(async () => {
    const [companies, subs, invoices, events] = await Promise.all([
      listCompanies(db),
      listSubs(db),
      listInvoices(db).catch(() => []),
      listEvents(db, 10),
    ]);
    const usage = await Promise.all(
      companies
        .slice(0, 200)
        .map((c) => getUsageOf(db, c.id).catch(() => null)),
    );
    return { companies, subs, invoices, events, usage };
  }, [db]);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={6} />;
  const now = new Date();
  const status = data.subs.map((x) => statusOf(x, now));
  const by = (k: string) => status.filter((x) => x === k).length;
  const in30 = data.subs.filter((x) => {
    const end = x.periodEnd || x.trialEndsAt;
    return end && end > now && end.getTime() - now.getTime() < 30 * 86400000;
  }).length;
  const sum = (k: (typeof limitKeys)[number]) =>
    data.usage.reduce((t, u) => t + (u?.[k] || 0), 0);
  const plans = new Map<string, number>();
  for (const x of data.subs)
    plans.set(x.planName, (plans.get(x.planName) || 0) + 1);
  const rev = recurringRevenue(data.invoices, now);
  return (
    <>
      <Head
        title="Platform overview"
        sub="Live figures from company, subscription and invoice records."
      />
      <section className="card card-pad">
        <div className="stat-grid">
          <Stat label="Registered companies" value={data.companies.length} />
          <Stat
            label="Active subscriptions"
            value={by('active') + by('renewal_due') + by('grace')}
            tone="green"
          />
          <Stat label="Trials" value={by('trial')} tone="violet" />
          <Stat
            label="Read-only (suspended/expired)"
            value={
              data.companies.filter((c) => c.status === 'read_only').length
            }
            tone="amber"
          />
          <Stat
            label="Expiring in 30 days"
            value={in30}
            tone={in30 ? 'amber' : undefined}
          />
          <Stat
            label="Companies without a plan"
            value={data.companies.filter((c) => !c.plan).length}
          />
          <Stat label="Sites (all tenants)" value={sum('sites')} />
          <Stat label="Staff logins (all tenants)" value={sum('staffLinks')} />
        </div>
      </section>
      <div className="dash-grid">
        <section className="card card-pad">
          <div className="card-head">
            <h2>Plan distribution</h2>
          </div>
          {!plans.size ? (
            <Empty title="No subscriptions yet" />
          ) : (
            <ul className="health-list">
              {[...plans.entries()].map(([p, n]) => (
                <li key={p}>
                  <Pill tone="blue">{n}</Pill>
                  <strong>{p}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card card-pad">
          <div className="card-head">
            <h2>Recurring revenue</h2>
          </div>
          {Object.keys(rev.mrr).length ? (
            Object.entries(rev.mrr).map(([cur, v]) => (
              <p key={cur}>
                <strong>
                  {cur} {v.toLocaleString('en-GB')}
                </strong>{' '}
                MRR · {cur} {rev.arr[cur].toLocaleString('en-GB')} ARR
              </p>
            ))
          ) : (
            <p className="muted">
              No paid invoices cover today, so recurring revenue is zero.
            </p>
          )}
          <p className="muted small">
            Only invoices marked paid whose service period covers today count,
            normalised to a month. Trials and unpaid invoices never count.
            Currencies are not converted.
          </p>
        </section>
      </div>
      <section className="card card-pad">
        <div className="card-head">
          <h2>Recent platform events</h2>
        </div>
        <EventTable rows={data.events} />
      </section>
    </>
  );
}
function EventTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof listEvents>>;
}) {
  if (!rows.length) return <Empty title="No events yet" />;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>When</th>
            <th>Event</th>
            <th>Subject</th>
            <th>Detail</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>{e.at ? e.at.toDate().toLocaleString('en-GB') : '—'}</td>
              <td>{humanize(e.type.replaceAll('.', ' '))}</td>
              <td className="cell-ref">{e.subject}</td>
              <td>{e.detail}</td>
              <td className="cell-ref">{e.actorUid.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ companies */
function Companies({ s }: { s: Session }) {
  const db = s.services.db;
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [registering, setRegistering] = useState(false);
  const { data, error, reload } = useLoad(
    async () => ({
      companies: await listCompanies(db),
      subs: await listSubs(db),
    }),
    [db],
  );
  const rows = (data?.companies || []).filter(
    (c) => !q || `${c.name} ${c.id}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <Head
        title="Companies"
        sub="Tenant directory. Operational data stays inside each tenant and is not visible here."
        actions={
          can(s.role, 'register') && (
            <button
              className="btn btn-primary"
              onClick={() => setRegistering(true)}
            >
              <Plus /> Register company
            </button>
          )
        }
      />
      <section className="card card-pad">
        <div className="toolbar">
          <input
            className="input"
            aria-label="Search companies"
            placeholder="Search by name or ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>
        {error && <Banner tone="red">{error}</Banner>}
        {!data && !error && <Skeleton rows={4} />}
        {data && !rows.length && <Empty title="No companies" />}
        {!!rows.length && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>ID</th>
                  <th>Plan</th>
                  <th>Subscription</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const sub = data!.subs.find((x) => x.id === c.id);
                  return (
                    <tr
                      key={c.id}
                      className="row-link"
                      onClick={() => navigate(`/companies/${c.id}`)}
                    >
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td className="cell-ref">{c.id}</td>
                      <td>
                        {c.plan?.planName || (
                          <span className="muted">No plan</span>
                        )}
                      </td>
                      <td>
                        {sub ? <StatusPill value={statusOf(sub)} /> : '—'}
                      </td>
                      <td>
                        <StatusPill value={c.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {registering && (
        <RegisterDrawer
          s={s}
          onClose={() => setRegistering(false)}
          onDone={reload}
        />
      )}
    </>
  );
}
function useVersions(s: Session) {
  return useLoad(async () => {
    const plans = (await listPlans(s.services.db)).filter(
      (p) => p.status === 'active',
    );
    const out: (VersionRow & { planName: string })[] = [];
    for (const p of plans) {
      const v = (await listVersions(s.services.db, p.id))[0];
      if (v) out.push({ ...v, planName: p.name });
    }
    return out;
  }, [s.services.db]);
}
function RegisterDrawer({
  s,
  onClose,
  onDone,
}: {
  s: Session;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const versions = useVersions(s);
  const [v, setV] = useState({
    id: '',
    name: '',
    timeZone: 'Asia/Dubai',
    ownerEmail: '',
    versionId: '',
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [link, setLink] = useState('');
  const adminBase = useMemo(
    () => new URL('../', window.location.href.split('#')[0]).href,
    [],
  );
  return (
    <Drawer
      title="Register a company"
      subtitle="Creates the tenant, zeroed usage counters, the optional plan and a 14-day owner invitation in one audited step."
      onClose={onClose}
      footer={
        !link && (
          <>
            <button className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const r = await registerCompany(
                    s.services.db,
                    s.user.uid,
                    v,
                    adminBase,
                  );
                  setLink(r.link);
                  toast('Company registered');
                  onDone();
                } catch (e) {
                  setError(err(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Register
            </button>
          </>
        )
      }
    >
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      {link ? (
        <Banner tone="green" title="Send this invitation to the owner">
          <code style={{ wordBreak: 'break-all' }}>{link}</code>
          <p className="small">
            They sign in or create an account with {v.ownerEmail}, verify it and
            accept. Email delivery is not automated yet.
          </p>
        </Banner>
      ) : (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="r-id">Company ID</label>
            <input
              id="r-id"
              className="input"
              value={v.id}
              onChange={(e) => setV({ ...v, id: e.target.value })}
              placeholder="e.g. gulf-facilities"
            />
          </div>
          <div className="field">
            <label htmlFor="r-name">Company name</label>
            <input
              id="r-name"
              className="input"
              value={v.name}
              onChange={(e) => setV({ ...v, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="r-tz">Time zone</label>
            <select
              id="r-tz"
              className="select"
              value={v.timeZone}
              onChange={(e) => setV({ ...v, timeZone: e.target.value })}
            >
              {timeZones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="r-owner">Owner email</label>
            <input
              id="r-owner"
              className="input"
              type="email"
              value={v.ownerEmail}
              onChange={(e) => setV({ ...v, ownerEmail: e.target.value })}
            />
          </div>
          <div className="field wide">
            <label htmlFor="r-plan">Plan (optional)</label>
            <select
              id="r-plan"
              className="select"
              value={v.versionId}
              onChange={(e) => setV({ ...v, versionId: e.target.value })}
            >
              <option value="">No plan yet</option>
              {(versions.data || []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.planName} v{x.version}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </Drawer>
  );
}
function CompanyDetail({ s }: { s: Session }) {
  const { id = '' } = useParams();
  const db = s.services.db;
  const toast = useToast();
  const versions = useVersions(s);
  const { data, error, reload } = useLoad(async () => {
    const companies = await listCompanies(db);
    const company = companies.find((c) => c.id === id) || null;
    return {
      company,
      sub: await getSub(db, id),
      usage: await getUsageOf(db, id).catch(() => null),
      grant: await myGrant(db, s.user.uid, id),
    };
  }, [db, id]);
  const [pick, setPick] = useState('');
  const [days, setDays] = useState(14);
  const [reason, setReason] = useState('');
  const [summary, setSummary] = useState<{
    steps?: Record<string, boolean>;
    pack?: string;
  } | null>(null);
  if (error) return <Banner tone="red">{error}</Banner>;
  if (!data) return <Skeleton rows={6} />;
  if (!data.company) return <Empty title="Company not found" />;
  const c: CompanyRow = data.company;
  const st = data.sub ? statusOf(data.sub) : null;
  const act = async (
    a: LifecycleAction,
    extra: { days?: number; versionId?: string } = {},
  ) => {
    try {
      await lifecycle(db, s.user.uid, c.id, a, extra);
      toast(`${humanize(a)} recorded`);
      reload();
    } catch (e) {
      toast(err(e), 'red');
    }
  };
  const billing = can(s.role, 'billing');
  const grantOk =
    data.grant?.status === 'approved' &&
    data.grant.expiresAt &&
    data.grant.expiresAt.toMillis() > Date.now();
  return (
    <>
      <Head
        title={c.name}
        sub={`${c.id} · ${c.timeZone}`}
        actions={<StatusPill value={c.status} />}
      />
      <div className="dash-grid">
        <section className="card card-pad">
          <div className="card-head">
            <h2>Subscription</h2>
            {st && <StatusPill value={st} />}
          </div>
          {!data.sub ? (
            <>
              <p className="muted">
                No plan assigned. Existing data is unaffected; no limits apply.
              </p>
              {billing && (
                <div className="toolbar">
                  <select
                    className="select"
                    aria-label="Plan"
                    value={pick}
                    onChange={(e) => setPick(e.target.value)}
                  >
                    <option value="">Choose plan…</option>
                    {(versions.data || []).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.planName} v{x.version}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary"
                    disabled={!pick}
                    onClick={() =>
                      assignPlan(db, s.user.uid, c, pick)
                        .then(() => (toast('Plan assigned'), reload()))
                        .catch((e) => toast(err(e), 'red'))
                    }
                  >
                    Assign plan
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <dl className="facts">
                <dt>Plan</dt>
                <dd>
                  {data.sub.planName} ({data.sub.versionId})
                </dd>
                <dt>Trial ends</dt>
                <dd>{fmt(data.sub.trialEndsAt)}</dd>
                <dt>Current period</dt>
                <dd>
                  {fmt(data.sub.periodStart)} – {fmt(data.sub.periodEnd)}
                </dd>
                <dt>Grace</dt>
                <dd>{data.sub.graceDays} days</dd>
              </dl>
              {billing && (
                <div className="toolbar" style={{ flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => void act('renew')}
                  >
                    Renew
                  </button>
                  <input
                    className="input"
                    type="number"
                    aria-label="Trial days"
                    min={1}
                    max={90}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    style={{ width: 80 }}
                  />
                  <button
                    className="btn btn-outline"
                    onClick={() => void act('extend_trial', { days })}
                  >
                    Extend trial
                  </button>
                  <select
                    className="select"
                    aria-label="Change plan"
                    value={pick}
                    onChange={(e) => setPick(e.target.value)}
                  >
                    <option value="">Change plan…</option>
                    {(versions.data || []).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.planName} v{x.version}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-outline"
                    disabled={!pick}
                    onClick={() => void act('change_plan', { versionId: pick })}
                  >
                    Upgrade / downgrade
                  </button>
                  {data.sub.state === 'running' ? (
                    <button
                      className="btn btn-outline"
                      onClick={() => void act('suspend')}
                    >
                      Suspend (read-only)
                    </button>
                  ) : (
                    <button
                      className="btn btn-outline"
                      onClick={() => void act('reactivate')}
                    >
                      Reactivate
                    </button>
                  )}
                  {data.sub.state !== 'cancelled' && (
                    <button
                      className="btn btn-outline"
                      onClick={() =>
                        confirm(
                          'Cancel this subscription? The company keeps read-only access to its data.',
                        ) && void act('cancel')
                      }
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
              <p className="muted small">
                Suspending, cancelling or expiry makes the company read-only.
                Its data is never deleted or overwritten.
              </p>
            </>
          )}
        </section>
        <section className="card card-pad">
          <div className="card-head">
            <h2>Usage</h2>
          </div>
          {!data.usage ? (
            <p className="muted">
              No usage counters. Run scripts/usage-reconcile.ts for this company
              before assigning a plan.
            </p>
          ) : (
            <table className="data">
              <tbody>
                {limitKeys.map((k) => (
                  <tr key={k}>
                    <td>{limitLabels[k]}</td>
                    <td>{data.usage![k] ?? 0}</td>
                    <td className="muted">
                      {c.plan
                        ? c.plan.limits[k] < 0
                          ? 'Unlimited'
                          : `of ${c.plan.limits[k]}`
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
      <section className="card card-pad">
        <div className="card-head">
          <h2>
            <LifeBuoy size={18} /> Support access
          </h2>
        </div>
        <p className="muted small">
          Platform staff cannot read tenant operational data. A tenant
          administrator can approve time-limited (≤72 h) access to the setup
          summary only.
        </p>
        {data.grant ? (
          <p>
            Your request: <StatusPill value={data.grant.status} />{' '}
            {data.grant.expiresAt
              ? `until ${data.grant.expiresAt.toDate().toLocaleString('en-GB')}`
              : ''}
          </p>
        ) : null}
        {can(s.role, 'support') && !grantOk && (
          <div className="toolbar">
            <input
              className="input"
              aria-label="Reason"
              placeholder="Reason for access (shown to the tenant)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <button
              className="btn btn-outline"
              onClick={() =>
                requestSupport(db, s.user.uid, c.id, reason)
                  .then(() => (toast('Request sent to the tenant'), reload()))
                  .catch((e) => toast(err(e), 'red'))
              }
            >
              Request access
            </button>
          </div>
        )}
        {grantOk && (
          <>
            <button
              className="btn btn-outline"
              onClick={() =>
                supportSummary(db, c.id)
                  .then(setSummary)
                  .catch((e) => toast(err(e), 'red'))
              }
            >
              View setup summary
            </button>
            {summary && (
              <p className="small">
                Starter pack: {summary.pack || 'none'} · Steps marked:{' '}
                {Object.keys(summary.steps || {})
                  .filter((k) => summary.steps![k])
                  .join(', ') || 'none'}
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ plans */
function Plans({ s }: { s: Session }) {
  const db = s.services.db;
  const [editing, setEditing] = useState<PlanRow | 'new' | null>(null);
  const { data, error, reload } = useLoad(async () => {
    const plans = await listPlans(db);
    return Promise.all(
      plans.map(async (p) => ({ p, v: (await listVersions(db, p.id))[0] })),
    );
  }, [db]);
  return (
    <>
      <Head
        title="Plans"
        sub="Plan versions are immutable; existing subscriptions keep the terms they were sold on. No prices are assumed."
        actions={
          can(s.role, 'billing') && (
            <button
              className="btn btn-primary"
              onClick={() => setEditing('new')}
            >
              <Plus /> New plan
            </button>
          )
        }
      />
      {error && <Banner tone="red">{error}</Banner>}
      {!data && !error && <Skeleton rows={4} />}
      {data && !data.length && (
        <Empty title="No plans yet">
          Create Trial, Starter, Professional and Enterprise from the editable
          examples.
        </Empty>
      )}
      <div className="plan-grid">
        {(data || []).map(({ p, v }) => (
          <section key={p.id} className="card card-pad">
            <div className="card-head">
              <h2>{p.name}</h2>
              <StatusPill value={p.status} />
            </div>
            <p className="muted small">
              {p.code} · version {p.currentVersion} · {p.description}
            </p>
            {v && (
              <>
                <ul className="plan-limits">
                  {limitKeys.map((k) => (
                    <li key={k}>
                      {limitLabels[k]}:{' '}
                      <strong>
                        {v.terms.limits[k] < 0
                          ? 'Unlimited'
                          : v.terms.limits[k]}
                      </strong>
                    </li>
                  ))}
                </ul>
                <div className="toolbar" style={{ flexWrap: 'wrap' }}>
                  {featureKeys.map((f) => (
                    <Pill key={f} tone={v.terms.features[f] ? 'green' : 'gray'}>
                      {featureLabels[f]}
                    </Pill>
                  ))}
                </div>
                <p className="small">
                  Trial {v.terms.trialDays} days · {v.terms.billingPeriod} ·
                  support {v.terms.supportLevel} · price{' '}
                  {v.terms.price
                    ? `${v.terms.price.currency} ${v.terms.price.amount}`
                    : 'not set'}
                </p>
              </>
            )}
            {can(s.role, 'billing') && (
              <button className="btn btn-outline" onClick={() => setEditing(p)}>
                Publish new version
              </button>
            )}
          </section>
        ))}
      </div>
      {editing && (
        <PlanDrawer
          s={s}
          plan={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={reload}
        />
      )}
    </>
  );
}
function PlanDrawer({
  s,
  plan,
  onClose,
  onDone,
}: {
  s: Session;
  plan: PlanRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [base, setBase] = useState(0);
  const [v, setV] = useState({
    code: plan?.code || examplePlans[0].code,
    name: plan?.name || examplePlans[0].name,
    description: plan?.description || '',
    status: plan?.status || 'active',
  });
  const [terms, setTerms] = useState<PlanTerms>(examplePlans[0].terms);
  const [price, setPrice] = useState({ amount: '', currency: 'AED' });
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (plan)
      listVersions(s.services.db, plan.id).then(
        (x) =>
          x[0] &&
          (setTerms(x[0].terms),
          x[0].terms.price &&
            setPrice({
              amount: String(x[0].terms.price.amount),
              currency: x[0].terms.price.currency,
            })),
      );
  }, [plan, s.services.db]);
  return (
    <Drawer
      title={plan ? `New version of ${plan.name}` : 'New plan'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                const t: PlanTerms = {
                  ...terms,
                  price:
                    price.amount === ''
                      ? null
                      : {
                          amount: Number(price.amount),
                          currency: price.currency.toUpperCase(),
                        },
                };
                const r = await savePlan(s.services.db, s.user.uid, {
                  id: plan?.id,
                  ...v,
                  status: v.status as 'active' | 'retired',
                  terms: t,
                });
                toast(`Published ${v.name} v${r.version}`);
                onDone();
                onClose();
              } catch (e) {
                setError(err(e));
                setBusy(false);
              }
            }}
          >
            Publish version
          </button>
        </>
      }
    >
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      {!plan && (
        <div className="field">
          <label htmlFor="pl-ex">Start from example</label>
          <select
            id="pl-ex"
            className="select"
            value={base}
            onChange={(e) => {
              const i = Number(e.target.value);
              setBase(i);
              setTerms(examplePlans[i].terms);
              setV({
                ...v,
                code: examplePlans[i].code,
                name: examplePlans[i].name,
              });
            }}
          >
            {examplePlans.map((x, i) => (
              <option key={x.code} value={i}>
                {x.name}
              </option>
            ))}
          </select>
          <span className="help">
            Examples are editable starting points, not commercial offers.
          </span>
        </div>
      )}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="pl-code">Code</label>
          <input
            id="pl-code"
            className="input"
            value={v.code}
            disabled={!!plan}
            onChange={(e) => setV({ ...v, code: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="pl-name">Name</label>
          <input
            id="pl-name"
            className="input"
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </div>
        <div className="field wide">
          <label htmlFor="pl-desc">Description</label>
          <input
            id="pl-desc"
            className="input"
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
        </div>
        {limitKeys.map((k) => (
          <div className="field" key={k}>
            <label htmlFor={`pl-${k}`}>{limitLabels[k]} (−1 = unlimited)</label>
            <input
              id={`pl-${k}`}
              className="input"
              type="number"
              min={-1}
              value={terms.limits[k]}
              onChange={(e) =>
                setTerms({
                  ...terms,
                  limits: { ...terms.limits, [k]: Number(e.target.value) },
                })
              }
            />
          </div>
        ))}
        <fieldset className="field wide">
          <legend className="field-label">Features</legend>
          {featureKeys.map((f) => (
            <label key={f} className="check">
              <input
                type="checkbox"
                checked={terms.features[f]}
                onChange={(e) =>
                  setTerms({
                    ...terms,
                    features: { ...terms.features, [f]: e.target.checked },
                  })
                }
              />{' '}
              {featureLabels[f]}
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor="pl-trial">Trial days</label>
          <input
            id="pl-trial"
            className="input"
            type="number"
            min={0}
            max={90}
            value={terms.trialDays}
            onChange={(e) =>
              setTerms({ ...terms, trialDays: Number(e.target.value) })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="pl-period">Billing period</label>
          <select
            id="pl-period"
            className="select"
            value={terms.billingPeriod}
            onChange={(e) =>
              setTerms({
                ...terms,
                billingPeriod: e.target.value as PlanTerms['billingPeriod'],
              })
            }
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="pl-support">Support level</label>
          <select
            id="pl-support"
            className="select"
            value={terms.supportLevel}
            onChange={(e) =>
              setTerms({
                ...terms,
                supportLevel: e.target.value as PlanTerms['supportLevel'],
              })
            }
          >
            <option value="standard">Standard</option>
            <option value="priority">Priority</option>
            <option value="dedicated">Dedicated</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="pl-price">List price (optional)</label>
          <input
            id="pl-price"
            className="input"
            inputMode="decimal"
            value={price.amount}
            onChange={(e) => setPrice({ ...price, amount: e.target.value })}
            placeholder="Leave empty"
          />
        </div>
        <div className="field">
          <label htmlFor="pl-cur">Currency</label>
          <input
            id="pl-cur"
            className="input"
            maxLength={3}
            value={price.currency}
            onChange={(e) => setPrice({ ...price, currency: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="pl-status">Status</label>
          <select
            id="pl-status"
            className="select"
            value={v.status}
            onChange={(e) =>
              setV({ ...v, status: e.target.value as 'active' | 'retired' })
            }
          >
            <option value="active">
              Active (available for new subscriptions)
            </option>
            <option value="retired">Retired</option>
          </select>
        </div>
      </div>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ subscriptions */
function Subscriptions({ s }: { s: Session }) {
  const [filter, setFilter] = useState('');
  const { data, error } = useLoad(
    () => listSubs(s.services.db),
    [s.services.db],
  );
  const navigate = useNavigate();
  const rows = (data || [])
    .map((x) => ({ x, st: statusOf(x) }))
    .filter((r) => !filter || r.st === filter);
  return (
    <>
      <Head
        title="Subscriptions"
        sub="Status is computed from the subscription dates; the trusted sweep applies read-only access when a subscription lapses."
      />
      <section className="card card-pad">
        <div className="toolbar">
          <select
            className="select"
            aria-label="Status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {subscriptionStatuses.map((x) => (
              <option key={x} value={x}>
                {humanize(x)}
              </option>
            ))}
          </select>
        </div>
        {error && <Banner tone="red">{error}</Banner>}
        {!data && !error && <Skeleton rows={4} />}
        {data && !rows.length && <Empty title="No subscriptions" />}
        {!!rows.length && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Trial ends</th>
                  <th>Period ends</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ x, st }) => (
                  <tr
                    key={x.id}
                    className="row-link"
                    onClick={() => navigate(`/companies/${x.id}`)}
                  >
                    <td>{x.companyName}</td>
                    <td>{x.planName}</td>
                    <td>
                      <StatusPill value={st} />
                    </td>
                    <td>{fmt(x.trialEndsAt)}</td>
                    <td>{fmt(x.periodEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ billing */
function Billing({ s }: { s: Session }) {
  const db = s.services.db;
  const toast = useToast();
  const { data, error, reload } = useLoad(
    async () => ({
      invoices: await listInvoices(db),
      companies: await listCompanies(db),
    }),
    [db],
  );
  const [v, setV] = useState({
    companyId: '',
    number: '',
    amount: '',
    currency: 'AED',
    periodStart: '',
    periodEnd: '',
    status: 'issued' as 'issued' | 'paid' | 'draft' | 'void',
  });
  const [open, setOpen] = useState(false);
  return (
    <>
      <Head
        title="Billing records"
        sub="Manual invoice records. Online payments are not active."
        actions={
          can(s.role, 'billing') && (
            <button className="btn btn-primary" onClick={() => setOpen(true)}>
              <Plus /> Record invoice
            </button>
          )
        }
      />
      <Banner tone="amber" title="Payment integration pending">
        {paymentAdapter.reason} Card numbers and CVV are never stored. A browser
        can never mark a subscription paid on the strength of a payment result —
        paid status here is a manual administrative record.
      </Banner>
      {error && <Banner tone="red">{error}</Banner>}
      <section className="card card-pad">
        {!data ? (
          <Skeleton rows={3} />
        ) : !data.invoices.length ? (
          <Empty title="No invoice records" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Company</th>
                  <th>Period</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="cell-ref">{i.number}</td>
                    <td>
                      {data.companies.find((c) => c.id === i.companyId)?.name ||
                        i.companyId}
                    </td>
                    <td>
                      {fmt(i.periodStart)} – {fmt(i.periodEnd)}
                    </td>
                    <td>
                      {i.currency}{' '}
                      {i.amount.toLocaleString('en-GB', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td>
                      <StatusPill value={i.status} />
                    </td>
                    <td>{humanize(i.source)}</td>
                    <td>
                      {can(s.role, 'billing') && i.status === 'issued' && (
                        <button
                          className="link-btn"
                          onClick={() =>
                            saveInvoice(db, s.user.uid, {
                              ...i,
                              periodStart: i.periodStart
                                .toISOString()
                                .slice(0, 10),
                              periodEnd: i.periodEnd.toISOString().slice(0, 10),
                              status: 'paid',
                            })
                              .then(
                                () => (
                                  toast('Recorded as paid (manual)'),
                                  reload()
                                ),
                              )
                              .catch((e) => toast(err(e), 'red'))
                          }
                        >
                          Record payment received
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
        <Drawer
          title="Record invoice"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button
                className="btn btn-outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() =>
                  saveInvoice(db, s.user.uid, {
                    ...v,
                    amount: Number(v.amount),
                    currency: v.currency.toUpperCase(),
                  })
                    .then(
                      () => (
                        toast('Invoice recorded'),
                        setOpen(false),
                        reload()
                      ),
                    )
                    .catch((e) => toast(err(e), 'red'))
                }
              >
                Save
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="field wide">
              <label htmlFor="i-co">Company</label>
              <select
                id="i-co"
                className="select"
                value={v.companyId}
                onChange={(e) => setV({ ...v, companyId: e.target.value })}
              >
                <option value="">Choose…</option>
                {(data?.companies || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {(
              [
                ['number', 'Invoice number', 'text'],
                ['amount', 'Amount', 'text'],
                ['currency', 'Currency', 'text'],
                ['periodStart', 'Service period start', 'date'],
                ['periodEnd', 'Service period end', 'date'],
              ] as const
            ).map(([k, l, t]) => (
              <div className="field" key={k}>
                <label htmlFor={`i-${k}`}>{l}</label>
                <input
                  id={`i-${k}`}
                  className="input"
                  type={t}
                  value={v[k]}
                  onChange={(e) => setV({ ...v, [k]: e.target.value })}
                />
              </div>
            ))}
            <div className="field">
              <label htmlFor="i-st">Status</label>
              <select
                id="i-st"
                className="select"
                value={v.status}
                onChange={(e) =>
                  setV({ ...v, status: e.target.value as typeof v.status })
                }
              >
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="paid">Paid (manual)</option>
                <option value="void">Void</option>
              </select>
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ audit, health, config */
function Audit({ s }: { s: Session }) {
  const { data, error } = useLoad(
    () => listEvents(s.services.db, 300),
    [s.services.db],
  );
  return (
    <>
      <Head
        title="Platform audit log"
        sub="Every privileged platform change is written in the same batch as the change itself and cannot be edited or deleted from the apps."
      />
      {error && <Banner tone="red">{error}</Banner>}
      <section className="card card-pad">
        {data ? <EventTable rows={data} /> : <Skeleton rows={5} />}
      </section>
    </>
  );
}
function Health() {
  const items: [string, 'green' | 'amber' | 'red', string][] = [
    [
      'Firestore security rules',
      'green',
      'Platform roles, plan quotas, read-only suspension and invitations are enforced by the rules.',
    ],
    [
      'Usage reconciliation',
      'amber',
      'Operator-run (scripts/usage-reconcile.ts). Automatic runs need a trusted scheduled backend — pending approval.',
    ],
    [
      'Subscription expiry sweep',
      'amber',
      'Operator-run (scripts/subscription-sweep.ts). Until automated, lapsed subscriptions become read-only when the sweep runs.',
    ],
    [
      'Online payments',
      'red',
      'Not active. Needs a trusted backend for provider webhooks.',
    ],
    [
      'Email delivery (invitations, renewals)',
      'red',
      'Not active. Invitation links are shared manually.',
    ],
    [
      'Backups',
      'red',
      'No automatic backups on the Spark plan. Use scripts/backup-export.ts.',
    ],
  ];
  return (
    <>
      <Head
        title="Operational health"
        sub="What runs automatically today and what still needs an approved backend."
      />
      <section className="card card-pad">
        <ul className="health-list">
          {items.map(([l, t, d]) => (
            <li key={l}>
              <Pill tone={t} dot>
                {t === 'green'
                  ? 'Active'
                  : t === 'amber'
                    ? 'Manual'
                    : 'Pending'}
              </Pill>
              <strong>{l}</strong>
              <span className="muted small">{d}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
function Config({ s }: { s: Session }) {
  return (
    <>
      <Head title="Configuration" />
      <section className="card card-pad">
        <dl className="facts">
          <dt>Your platform role</dt>
          <dd>{platformRoleLabels[s.role]}</dd>
          <dt>Multi-factor sign-in</dt>
          <dd>
            {s.mfa
              ? 'Used for this session'
              : 'Not used (enforcement pending Identity Platform MFA)'}
          </dd>
          <dt>Payment provider</dt>
          <dd>
            {paymentAdapter.active
              ? paymentAdapter.provider
              : 'Disabled — pending integration'}
          </dd>
          <dt>How roles are granted</dt>
          <dd>
            Only by the trusted operator script scripts/grant-platform-role.mjs
            (Admin SDK custom claim). Tenant roles never grant platform access.
          </dd>
        </dl>
      </section>
    </>
  );
}
