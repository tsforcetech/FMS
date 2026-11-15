import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  HashRouter,
  Link,
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
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  Bell,
  Building2,
  ClipboardList,
  Home,
  LogOut,
  Plus,
  ShieldCheck,
  UserRound,
  CircleHelp,
} from 'lucide-react';
import { helpScreenUrl, toLocal } from '@facilityos/shared';
import type { FirebaseServices } from '@admin/firebase';
import {
  addRemark,
  confirmResolution,
  createServiceRequest,
  customerCompanies,
  getMyRequest,
  listMyRequests,
  newRequestId,
  placeActive,
  requestCategories,
  requestReopen,
  resolveCustomer,
  statusLabel,
  type CustomerAccess,
  type CustomerDenied,
  type CustomerPlace,
  type ServiceRequest,
} from '@admin/management/customerStore';
import { Pill, friendly, useToast, type Tone } from '@admin/ui/kit';
import { ExportMenu } from '@admin/ui/ExportMenu';
import type { Dataset } from '@admin/management/exportStore';

/** Customer-safe export: only fields the customer already sees in the portal. */
function historyDataset(
  s: Session,
  list: ServiceRequest[],
  place: string,
): Dataset {
  const rows = list.filter((r) => !place || r.allocationId === place);
  const placeOf = (r: ServiceRequest) =>
    placeName(s.link.places.find((p) => p.allocationId === r.allocationId));
  return {
    report: 'customer.history',
    title: 'Service history',
    audience: 'customer',
    columns: [
      { key: 'reference', label: 'Reference', type: 'text' },
      { key: 'createdAt', label: 'Raised', type: 'datetime' },
      { key: 'place', label: 'Location', type: 'text' },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'priority', label: 'Priority', type: 'text' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'resolutionSummary', label: 'Resolution', type: 'text' },
      {
        key: 'description',
        label: 'Description',
        type: 'text',
        optional: true,
      },
    ],
    filters: [
      {
        label: 'Location',
        value: place
          ? placeOf(rows[0] || ({ allocationId: place } as ServiceRequest))
          : 'All my locations',
      },
    ],
    pageRows: rows.map((r) => ({
      ...r,
      place: placeOf(r),
      status: statusLabel[r.status],
    })),
  };
}

/**
 * FacilityOS customer portal. A customer sees only the places listed on the
 * link an admin created for their login, and only their own client's service
 * requests — never internal notes, staff details or costs.
 */
type Session = CustomerAccess & {
  uid: string;
  email: string;
  services: FirebaseServices;
  today: string;
};
const Ctx = createContext<Session | null>(null);
const useSession = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('Customer session missing');
  return s;
};
const tone: Record<ServiceRequest['status'], Tone> = {
  submitted: 'blue',
  in_progress: 'violet',
  resolved: 'green',
  closed: 'gray',
  reopen_requested: 'amber',
  cancelled: 'gray',
};
const open = (r: ServiceRequest) =>
  ['submitted', 'in_progress', 'reopen_requested'].includes(r.status);
function fmt(d: Date, tz: string) {
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  });
}
function placeName(p: CustomerPlace | undefined) {
  if (!p) return 'Unknown location';
  return p.locationName ? `${p.locationName} · ${p.siteName}` : p.siteName;
}
function Status({ r }: { r: ServiceRequest }) {
  return (
    <Pill tone={tone[r.status]} dot>
      {statusLabel[r.status]}
    </Pill>
  );
}

export default function App({ services }: { services: FirebaseServices }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(services.auth, setUser), [services]);
  if (user === undefined) return <Splash />;
  if (!user) return <Login services={services} />;
  return (
    <HashRouter>
      <Gate key={user.uid} services={services} user={user} />
    </HashRouter>
  );
}
function Splash() {
  return (
    <div className="s-center" aria-busy="true">
      <div className="s-logo">F</div>
      <div className="spinner" />
    </div>
  );
}
function Gate({ services, user }: { services: FirebaseServices; user: User }) {
  const [state, setState] = useState<{
    access?: CustomerAccess;
    denied?: CustomerDenied;
  }>();
  useEffect(() => {
    let live = true;
    (async () => {
      const companies = await customerCompanies(services.db, user.uid).catch(
        () => [] as string[],
      );
      let denied: CustomerDenied | undefined;
      for (const c of companies) {
        const r = await resolveCustomer(services.db, c, user.uid);
        if ('link' in r) {
          if (live) setState({ access: r });
          return;
        }
        if (r.reason !== 'not-customer') denied ??= r;
      }
      if (live)
        setState({
          denied: denied || { companyId: '', reason: 'not-customer' },
        });
    })();
    return () => {
      live = false;
    };
  }, [services, user.uid]);
  const session = useMemo<Session | null>(
    () =>
      state?.access
        ? {
            ...state.access,
            uid: user.uid,
            email: user.email || '',
            services,
            today: toLocal(new Date(), state.access.timeZone).date,
          }
        : null,
    [state, user, services],
  );
  if (!state) return <Splash />;
  if (!session) {
    const reason = state.denied?.reason;
    return (
      <div className="s-center s-denied" role="alert">
        <ShieldCheck size={44} />
        <h1>
          {reason === 'revoked'
            ? 'Your portal access has been withdrawn'
            : reason === 'no-link'
              ? 'Your account is not set up yet'
              : 'This is not a customer account'}
        </h1>
        <p>
          Please contact your facility management team. Staff should use the
          staff portal.
        </p>
        <p className="small muted">{user.email}</p>
        <button
          className="btn btn-outline btn-lg"
          onClick={() => void signOut(services.auth)}
        >
          <LogOut /> Sign out
        </button>
      </div>
    );
  }
  return (
    <Ctx.Provider value={session}>
      <Shell />
    </Ctx.Provider>
  );
}

function Login({ services }: { services: FirebaseServices }) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [info, setInfo] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(services.auth, email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      setError(
        code.includes('network')
          ? 'You appear to be offline.'
          : 'Email or password is incorrect.',
      );
      setBusy(false);
    }
  }
  return (
    <main className="s-login">
      <div className="s-login-card">
        <div className="s-logo">F</div>
        <p className="s-brand">FacilityOS customer portal</p>
        <h1>Sign in</h1>
        <p className="muted">
          Raise service requests and follow their progress.
        </p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="c-email">Email</label>
          <input
            id="c-email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="c-password">Password</label>
          <input
            id="c-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="s-error" role="alert">
              {error}
            </p>
          )}
          {info && <p role="status">{info}</p>}
          <button
            className="btn btn-primary btn-lg btn-block"
            disabled={busy || !email || !password}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <button
          type="button"
          className="link-btn"
          onClick={async () => {
            if (!email.trim()) return setError('Enter your email first.');
            try {
              await sendPasswordResetEmail(services.auth, email.trim());
            } catch {
              /* same message either way (no account enumeration) */
            }
            setInfo(
              'If an account exists for this email, a reset link has been sent.',
            );
          }}
        >
          Forgot password?
        </button>
      </div>
    </main>
  );
}

/* ===================================================================== data */
type Requests = { list?: ServiceRequest[]; error: string; reload: () => void };
const ReqCtx = createContext<Requests>({ error: '', reload: () => undefined });
function useRequests() {
  return useContext(ReqCtx);
}
const seenKey = (uid: string) => `fos-customer-seen-${uid}`;

function Shell() {
  const s = useSession();
  const location = useLocation();
  const [list, setList] = useState<ServiceRequest[]>();
  const [error, setError] = useState('');
  const [v, setV] = useState(0);
  const reload = useCallback(() => setV((x) => x + 1), []);
  useEffect(() => {
    let live = true;
    listMyRequests(s.services.db, s.companyId, s.link)
      .then((l) => live && setList(l))
      .catch((e) => live && setError(friendly(e)));
    return () => {
      live = false;
    };
  }, [s, v, location.pathname]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const seen = Number(localStorageGet(seenKey(s.uid)) || 0);
  const unread = (list || []).filter(
    (r) => (r.updatedAt?.toMillis?.() || 0) > seen && r.updatedBy !== s.uid,
  ).length;
  const nav = [
    { to: '/', label: 'Overview', icon: <Home /> },
    { to: '/requests', label: 'Requests', icon: <ClipboardList /> },
    { to: '/new', label: 'New', icon: <Plus /> },
    { to: '/updates', label: 'Updates', icon: <Bell />, badge: unread },
    { to: '/profile', label: 'Profile', icon: <UserRound /> },
  ];
  return (
    <ReqCtx.Provider value={{ list, error, reload }}>
      <div className="s-shell">
        <header className="s-top">
          <div className="s-top-brand">
            <span className="s-logo sm">F</span>
            <div>
              <strong>{s.link.clientName}</strong>
              <span>{s.companyName}</span>
            </div>
          </div>
          <a
            className="s-bell s-help"
            href={helpScreenUrl(
              'customer',
              location.pathname,
              import.meta.env.VITE_HELP_URL,
            )}
            target="_blank"
            rel="noopener"
            aria-label="Help"
            title="Help"
            data-help-link
          >
            <CircleHelp />
          </a>
          <NavLink
            to="/updates"
            className="s-bell"
            aria-label={unread ? `Updates, ${unread} new` : 'Updates'}
          >
            <Bell />
            {unread > 0 && <span className="badge">{unread}</span>}
          </NavLink>
        </header>
        <nav className="s-rail" aria-label="Main">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className="s-rail-link"
            >
              {n.icon}
              <span>{n.label}</span>
              {!!n.badge && <span className="count-chip">{n.badge}</span>}
            </NavLink>
          ))}
          <div className="s-rail-sep" />
          <NavLink to="/locations" className="s-rail-link sub">
            <span>My locations</span>
          </NavLink>
          <NavLink to="/history" className="s-rail-link sub">
            <span>Service history</span>
          </NavLink>
        </nav>
        <main className="s-main" id="main">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/requests" element={<RequestList />} />
            <Route path="/requests/:id" element={<RequestRoute />} />
            <Route path="/new" element={<NewRequest />} />
            <Route path="/history" element={<History />} />
            <Route path="/updates" element={<Updates />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <nav className="s-bottom" aria-label="Main">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className="s-bottom-link"
            >
              <span className="s-bottom-icon">
                {n.icon}
                {!!n.badge && (
                  <span className="badge">{n.badge > 9 ? '9+' : n.badge}</span>
                )}
              </span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </ReqCtx.Provider>
  );
}
function localStorageGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function localStorageSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* preference only */
  }
}

function Loading({ error }: { error: string }) {
  return error ? (
    <div className="s-error-box" role="alert">
      {error}
    </div>
  ) : (
    <div className="s-loading" role="status">
      Loading…
    </div>
  );
}
function RequestCard({ r }: { r: ServiceRequest }) {
  const s = useSession();
  const place = s.link.places.find((p) => p.allocationId === r.allocationId);
  return (
    <Link to={`/requests/${r.id}`} className="s-card simple">
      <div className="s-card-top">
        <span className="code-chip">{r.reference}</span>
        <Status r={r} />
      </div>
      <h3>{r.category}</h3>
      <p className="s-meta">
        {placeName(place)} ·{' '}
        {r.createdAt ? fmt(r.createdAt.toDate(), s.timeZone) : 'Just now'}
      </p>
    </Link>
  );
}

/* ================================================================= overview */
function Overview() {
  const s = useSession();
  const { list, error } = useRequests();
  const active = s.link.places.filter((p) => placeActive(p, s.today));
  const toConfirm = (list || []).filter(
    (r) => r.status === 'resolved' && !r.confirmedAt,
  );
  return (
    <div className="s-page">
      <section className="s-hero">
        <p className="s-hero-date">{s.link.contactName || s.email}</p>
        <h1>{s.link.clientName}</h1>
        <p className="s-hero-sub">
          {active.length} active location{active.length === 1 ? '' : 's'} ·
          serviced by {s.companyName}
        </p>
      </section>
      {!list ? (
        <Loading error={error} />
      ) : (
        <>
          <section className="s-stats" aria-label="Requests">
            {(
              [
                ['Open', list.filter(open).length, 'blue'],
                [
                  'In progress',
                  list.filter((r) => r.status === 'in_progress').length,
                  'violet',
                ],
                ['To confirm', toConfirm.length, 'amber'],
                [
                  'Resolved',
                  list.filter((r) => ['resolved', 'closed'].includes(r.status))
                    .length,
                  'green',
                ],
              ] as const
            ).map(([k, n, t]) => (
              <Link
                key={k}
                to="/requests"
                className={`s-stat tone-${t}${n ? '' : ' zero'}`}
              >
                <strong>{n}</strong>
                <span>{k}</span>
              </Link>
            ))}
          </section>
          {!!toConfirm.length && (
            <div className="s-banner" role="status">
              <strong>{toConfirm.length} request(s) resolved</strong> — please
              check and confirm, or ask us to reopen.
            </div>
          )}
          <div className="s-actions">
            <Link to="/new" className="btn btn-primary btn-lg">
              <Plus /> New service request
            </Link>
          </div>
          <h2 className="s-section-title">Recent requests</h2>
          {!list.length ? (
            <div className="s-empty">
              <p>No requests yet. Raise one when something needs attention.</p>
            </div>
          ) : (
            <div className="s-list">
              {list.slice(0, 5).map((r) => (
                <RequestCard key={r.id} r={r} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ================================================================ locations */
function Locations() {
  const s = useSession();
  const { list } = useRequests();
  return (
    <div className="s-page">
      <h1 className="s-title">My locations</h1>
      <p className="muted">
        The premises your agreement covers. Contact your facility team if
        something is missing.
      </p>
      <div className="s-list">
        {s.link.places.map((p) => {
          const live = placeActive(p, s.today);
          const n = (list || []).filter(
            (r) => r.allocationId === p.allocationId && open(r),
          ).length;
          return (
            <div key={p.allocationId} className="s-card simple">
              <div className="c-place">
                <h3>
                  <Building2 size={16} /> {placeName(p)}
                </h3>
                <Pill tone={live ? 'green' : 'gray'} dot>
                  {live
                    ? 'Active'
                    : p.startDate > s.today
                      ? 'Starts later'
                      : 'Ended'}
                </Pill>
              </div>
              <p className="s-meta">
                {p.startDate} – {p.endDate || 'open'}
                {n ? ` · ${n} open request${n === 1 ? '' : 's'}` : ''}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================= requests */
function RequestList() {
  const { list, error } = useRequests();
  const [tab, setTab] = useState<'open' | 'all'>('open');
  const shown = (list || []).filter(
    (r) =>
      tab === 'all' || open(r) || (r.status === 'resolved' && !r.confirmedAt),
  );
  return (
    <div className="s-page">
      <div className="s-title-row">
        <h1 className="s-title">Service requests</h1>
        <Link to="/new" className="btn btn-primary">
          <Plus /> New
        </Link>
      </div>
      <div className="s-tabs" role="tablist">
        {(['open', 'all'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className="s-tab"
            onClick={() => setTab(t)}
          >
            {t === 'open' ? 'Needs attention' : 'All'}
          </button>
        ))}
      </div>
      {!list ? (
        <Loading error={error} />
      ) : !shown.length ? (
        <div className="s-empty">
          <p>Nothing here.</p>
        </div>
      ) : (
        <div className="s-list">
          {shown.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
function RequestRoute() {
  const { id = '' } = useParams();
  return <RequestView key={id} id={id} />;
}
function RequestView({ id }: { id: string }) {
  const s = useSession();
  const toast = useToast();
  const { reload } = useRequests();
  const [r, setR] = useState<ServiceRequest | null>();
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'message' | 'reopen'>('message');
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState(0);
  useEffect(() => {
    let live = true;
    getMyRequest(s.services.db, s.companyId, id)
      .then((x) => live && setR(x))
      .catch(() => live && setR(null));
    return () => {
      live = false;
    };
  }, [s, id, v]);
  // Pick up progress made by the service team while the page is open.
  useEffect(() => {
    const t = setInterval(() => setV((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  if (r === undefined) return <Loading error="" />;
  if (r === null)
    return (
      <div className="s-page">
        <div className="s-empty" role="alert">
          <p>This request is not available.</p>
          <Link to="/requests">Back to requests</Link>
        </div>
      </div>
    );
  const place = s.link.places.find((p) => p.allocationId === r.allocationId);
  async function act(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    setError('');
    try {
      await fn();
      toast(msg);
      setText('');
      setV((x) => x + 1);
      reload();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  const db = s.services.db,
    c = s.companyId;
  const resolved = ['resolved', 'closed'].includes(r.status);
  return (
    <div className="s-page">
      <Link className="s-back" to="/requests">
        ← Requests
      </Link>
      <div className="s-card-top">
        <span className="code-chip">{r.reference}</span>
        <Status r={r} />
      </div>
      <h1 className="s-title">{r.category}</h1>
      <dl className="s-facts">
        <div className="s-fact">
          <dt>Location</dt>
          <dd>{placeName(place)}</dd>
        </div>
        <div className="s-fact">
          <dt>Priority</dt>
          <dd>{r.priority}</dd>
        </div>
        <div className="s-fact wide">
          <dt>Description</dt>
          <dd>{r.description}</dd>
        </div>
        {r.resolutionSummary && (
          <div className="s-fact wide">
            <dt>Resolution</dt>
            <dd>{r.resolutionSummary}</dd>
          </div>
        )}
      </dl>
      {resolved && !r.confirmedAt && (
        <section className="s-panel">
          <h2 className="s-section-title">
            Is this resolved to your satisfaction?
          </h2>
          <div className="s-actions">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                void act(
                  () => confirmResolution(db, c, s.uid, r.id),
                  'Thank you for confirming',
                )
              }
            >
              Yes, confirm
            </button>
            <button
              className="btn btn-outline"
              disabled={busy}
              onClick={() => setMode('reopen')}
            >
              No, ask to reopen
            </button>
          </div>
        </section>
      )}
      {r.confirmedAt && (
        <p className="muted small">
          You confirmed the resolution on{' '}
          {fmt(r.confirmedAt.toDate(), s.timeZone)}.
        </p>
      )}
      <h2 className="s-section-title">Progress</h2>
      <ol className="c-steps">
        {r.timeline.map((t, i) => (
          <li key={i} className="done">
            <strong>{t.label}</strong>
            <div className="muted small">{fmt(t.at.toDate(), s.timeZone)}</div>
          </li>
        ))}
      </ol>
      <h2 className="s-section-title">Messages</h2>
      {!r.remarks.length && <p className="muted small">No messages yet.</p>}
      {r.remarks.map((m, i) => (
        <div key={i} className={'c-msg' + (m.by === 'customer' ? ' mine' : '')}>
          <strong>{m.by === 'customer' ? 'You' : 'Service team'}</strong>{' '}
          <span className="muted small">{fmt(m.at.toDate(), s.timeZone)}</span>
          <div>{m.text}</div>
        </div>
      ))}
      {r.status !== 'cancelled' && r.remarks.length < 30 && (
        <form
          className="c-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'reopen')
              void act(
                () => requestReopen(db, c, s.uid, r.id, text),
                'Reopen requested',
              );
            else
              void act(
                () => addRemark(db, c, s.uid, r.id, text),
                'Message sent',
              );
          }}
        >
          <label htmlFor="c-msg">
            {mode === 'reopen' ? 'What is still wrong?' : 'Add a message'}
          </label>
          <textarea
            id="c-msg"
            className="input"
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && (
            <p className="s-error" role="alert">
              {error}
            </p>
          )}
          <div className="s-actions">
            <button className="btn btn-primary" disabled={busy || !text.trim()}>
              {mode === 'reopen' ? 'Ask to reopen' : 'Send'}
            </button>
            {mode === 'reopen' && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setMode('message')}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

/* ============================================================== new request */
function NewRequest() {
  const s = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const { list, reload } = useRequests();
  const places = s.link.places.filter((p) => placeActive(p, s.today));
  // The ID is created once per form so a retried submission is idempotent.
  const [id] = useState(() => newRequestId(s.services.db, s.companyId));
  const [v, setV] = useState({
    allocationId: places.length === 1 ? places[0].allocationId : '',
    category: '',
    priority: 'medium' as ServiceRequest['priority'],
    description: '',
  });
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createServiceRequest(
        s.services.db,
        s.companyId,
        s.uid,
        s.link,
        { id, ...v },
        { todayLocal: s.today, existing: list },
      );
      toast('Request submitted');
      reload();
      navigate(`/requests/${id}`, { replace: true });
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  }
  if (!places.length)
    return (
      <div className="s-page">
        <h1 className="s-title">New service request</h1>
        <div className="s-empty">
          <p>
            None of your locations is currently active. Contact your facility
            team.
          </p>
        </div>
      </div>
    );
  return (
    <div className="s-page">
      <h1 className="s-title">New service request</h1>
      <form className="c-form" onSubmit={submit} noValidate>
        <label htmlFor="n-place">Location</label>
        <select
          id="n-place"
          className="input"
          value={v.allocationId}
          onChange={(e) => setV({ ...v, allocationId: e.target.value })}
        >
          <option value="">Choose…</option>
          {places.map((p) => (
            <option key={p.allocationId} value={p.allocationId}>
              {placeName(p)}
            </option>
          ))}
        </select>
        <label htmlFor="n-cat">What is it about?</label>
        <select
          id="n-cat"
          className="input"
          value={v.category}
          onChange={(e) => setV({ ...v, category: e.target.value })}
        >
          <option value="">Choose…</option>
          {requestCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label htmlFor="n-prio">How urgent?</label>
        <select
          id="n-prio"
          className="input"
          value={v.priority}
          onChange={(e) =>
            setV({
              ...v,
              priority: e.target.value as ServiceRequest['priority'],
            })
          }
        >
          <option value="low">Low — when convenient</option>
          <option value="medium">Normal</option>
          <option value="high">Urgent — affects our work</option>
          <option value="critical">Emergency — safety risk or flooding</option>
        </select>
        <label htmlFor="n-desc">Describe the problem</label>
        <textarea
          id="n-desc"
          className="input"
          maxLength={2000}
          placeholder="What is happening and where exactly?"
          value={v.description}
          onChange={(e) => setV({ ...v, description: e.target.value })}
        />
        {error && (
          <p className="s-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="btn btn-primary btn-lg btn-block"
          disabled={
            busy || !v.allocationId || !v.category || !v.description.trim()
          }
        >
          {busy ? 'Submitting…' : 'Submit request'}
        </button>
        <p className="muted small">
          For emergencies involving danger to people, also call your building’s
          emergency number.
        </p>
      </form>
    </div>
  );
}

/* ================================================================== history */
function History() {
  const s = useSession();
  const { list, error } = useRequests();
  const [place, setPlace] = useState('');
  const done = (list || []).filter(
    (r) => !open(r) && (!place || r.allocationId === place),
  );
  return (
    <div className="s-page">
      <div className="s-title-row">
        <h1 className="s-title">Service history</h1>
        <ExportMenu
          db={s.services.db}
          companyId={s.companyId}
          companyName={`${s.companyName} · ${s.link.clientName}`}
          timeZone={s.timeZone}
          uid={s.uid}
          dataset={() => historyDataset(s, list || [], place)}
        />
      </div>
      <label className="sr-only" htmlFor="h-place">
        Location
      </label>
      <select
        id="h-place"
        className="input"
        value={place}
        onChange={(e) => setPlace(e.target.value)}
      >
        <option value="">All my locations</option>
        {s.link.places.map((p) => (
          <option key={p.allocationId} value={p.allocationId}>
            {placeName(p)}
          </option>
        ))}
      </select>
      {!list ? (
        <Loading error={error} />
      ) : !done.length ? (
        <div className="s-empty">
          <p>No completed requests yet.</p>
        </div>
      ) : (
        <div className="s-list">
          {done.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== updates */
function Updates() {
  const s = useSession();
  const { list, error } = useRequests();
  const [seen] = useState(() => Number(localStorageGet(seenKey(s.uid)) || 0));
  useEffect(() => {
    localStorageSet(seenKey(s.uid), String(Date.now()));
  }, [s.uid]);
  const events = (list || [])
    .flatMap((r) => [
      ...r.timeline.map((t) => ({ r, at: t.at.toDate(), text: t.label })),
      ...r.remarks
        .filter((m) => m.by === 'team')
        .map((m) => ({
          r,
          at: m.at.toDate(),
          text: `Service team: ${m.text}`,
        })),
    ])
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 50);
  return (
    <div className="s-page">
      <h1 className="s-title">Updates</h1>
      {!list ? (
        <Loading error={error} />
      ) : !events.length ? (
        <div className="s-empty">
          <p>No updates yet.</p>
        </div>
      ) : (
        <div className="s-list">
          {events.map((e, i) => (
            <Link
              key={i}
              to={`/requests/${e.r.id}`}
              className={
                's-card simple s-note' +
                (e.at.getTime() > seen ? ' unread' : '')
              }
            >
              <div className="s-card-top">
                <span className="code-chip">{e.r.reference}</span>
                <span className="muted small">{fmt(e.at, s.timeZone)}</span>
              </div>
              <p>{e.text}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== profile */
function Profile() {
  const s = useSession();
  return (
    <div className="s-page">
      <h1 className="s-title">Profile</h1>
      <dl className="s-facts">
        <div className="s-fact wide">
          <dt>Signed in as</dt>
          <dd>{s.email}</dd>
        </div>
        <div className="s-fact">
          <dt>Organisation</dt>
          <dd>{s.link.clientName}</dd>
        </div>
        <div className="s-fact">
          <dt>Facility provider</dt>
          <dd>{s.companyName}</dd>
        </div>
        {s.link.contactName && (
          <div className="s-fact wide">
            <dt>Contact</dt>
            <dd>{s.link.contactName}</dd>
          </div>
        )}
      </dl>
      <p className="muted small">
        You can see only the locations your facility provider has shared with
        this login. To change them, contact your facility team.
      </p>
      <ProfileActions />
    </div>
  );
}
function ProfileActions(): ReactNode {
  const s = useSession();
  const [info, setInfo] = useState('');
  return (
    <div className="s-actions">
      <button
        className="btn btn-outline"
        onClick={async () => {
          try {
            await sendPasswordResetEmail(s.services.auth, s.email);
          } catch {
            /* same message either way */
          }
          setInfo('A password reset link has been sent to your email.');
        }}
      >
        Change password
      </button>
      <button
        className="btn btn-outline"
        onClick={() => void signOut(s.services.auth)}
      >
        <LogOut /> Sign out
      </button>
      {info && <p role="status">{info}</p>}
    </div>
  );
}
