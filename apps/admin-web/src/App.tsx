import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type FormEvent,
} from 'react';
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
} from 'react-router-dom';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import {
  doc,
  onSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  Layers,
  LayoutDashboard,
  ClipboardCheck,
  CalendarDays,
  Wrench,
  MessageSquare,
  ShieldCheck,
  Zap,
  Building2,
  Users,
  Boxes,
  Package,
  BarChart3,
  Settings,
  Bell,
  Menu,
  LogOut,
  ArrowRight,
  LockKeyhole,
} from 'lucide-react';
import { Field, Message } from '@facilityos/ui';
import {
  canOpenAdmin,
  companySchema,
  memberSchema,
  loginSchema,
  friendlyError,
  type Company,
  type Membership,
  type UserProfile,
} from '@facilityos/shared';
import type { FirebaseServices } from './firebase';
import { loadAccess, loadProfile } from './data';

type Access = { company: Company; member: Membership };
type Session = {
  user: User | null;
  profile: UserProfile | null;
  companies: Access[];
  loading: boolean;
  error: string;
  refresh: () => void;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
};
const SessionContext = createContext<Session | null>(null);
function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('Session missing');
  return value;
}
function SessionProvider({
  services,
  children,
}: {
  services: FirebaseServices;
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null),
    [profile, setProfile] = useState<UserProfile | null>(null),
    [companies, setCompanies] = useState<Access[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [loadingMore, setLoadingMore] = useState(false);
  const cursor = useRef<QueryDocumentSnapshot | undefined>(undefined),
    generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(services.auth, async (next) => {
      const run = ++generation.current;
      setLoading(true);
      setError('');
      setUser(next);
      setProfile(null);
      setCompanies([]);
      setHasMore(false);
      setLoadingMore(false);
      cursor.current = undefined;
      if (!next) {
        setLoading(false);
        return;
      }
      try {
        const [p, a] = await Promise.all([
          loadProfile(services.db, next.uid),
          loadAccess(services.db, next.uid),
        ]);
        if (!active || run !== generation.current) return;
        setProfile(p);
        setCompanies(a.items);
        cursor.current = a.cursor;
        setHasMore(a.hasMore);
      } catch (e) {
        if (active && run === generation.current) setError(friendlyError(e));
      } finally {
        if (active && run === generation.current) setLoading(false);
      }
    });
    return () => {
      active = false;
      invalidate();
      unsubscribe();
    };
  }, [services, revision, invalidate]);
  async function loadMore() {
    if (!user || !hasMore || loadingMore) return;
    const run = generation.current;
    setLoadingMore(true);
    try {
      const a = await loadAccess(services.db, user.uid, cursor.current);
      if (run !== generation.current) return;
      setCompanies((prev) => [
        ...prev,
        ...a.items.filter(
          (v) => !prev.some((p) => p.company.companyId === v.company.companyId),
        ),
      ]);
      cursor.current = a.cursor;
      setHasMore(a.hasMore);
    } catch (e) {
      if (run === generation.current) setError(friendlyError(e));
    } finally {
      if (run === generation.current) setLoadingMore(false);
    }
  }
  return (
    <SessionContext.Provider
      value={{
        user,
        profile,
        companies,
        loading,
        error,
        refresh: () => setRevision((v) => v + 1),
        loadMore,
        hasMore,
        loadingMore,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
function Brand() {
  return (
    <div className="brand-row">
      <div className="brand-mark">
        <Layers size={24} />
      </div>
      <div>
        <div className="brand-name">
          Facility<span style={{ color: 'var(--brand)' }}>OS</span>
        </div>
        <span className="brand-caption">BY SHARACO</span>
      </div>
    </div>
  );
}
function Login({ services }: { services: FirebaseServices }) {
  const { user, loading } = useSession();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  if (loading)
    return (
      <div className="center-state">
        <Message title="Checking your session…" />
      </div>
    );
  if (user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setError('Enter a valid email address and your password.');
      return;
    }
    setBusy(true);
    try {
      await services.ready;
      await signInWithEmailAndPassword(
        services.auth,
        result.data.email,
        result.data.password,
      );
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    setError('');
    setNotice('');
    if (!loginSchema.shape.email.safeParse(email).success) {
      setError('Enter your email address first.');
      return;
    }
    setBusy(true);
    try {
      await services.ready;
      await sendPasswordResetEmail(services.auth, email);
      setNotice(
        'If this email is eligible, you will receive password reset instructions.',
      );
    } catch (e) {
      if ((e as { code?: string }).code === 'auth/user-not-found')
        setNotice(
          'If this email is eligible, you will receive password reset instructions.',
        );
      else setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-wrap">
      <section className="login-story">
        <Layers size={44} />
        <span className="eyebrow">YOUR OPERATIONS, CONNECTED</span>
        <h1>
          Simple. Clear.
          <br />
          Connected.
        </h1>
        <p>
          A focused workspace for the people who keep your facilities running.
        </p>
        <div>
          <span className="badge teal">FACILITYOS · ADMIN PORTAL</span>
        </div>
      </section>
      <main className="login-panel">
        <Brand />
        <span className="eyebrow">WELCOME BACK</span>
        <h1>Sign in to your workspace</h1>
        <p>Use the account provided by your company administrator.</p>
        <form onSubmit={submit}>
          <Field
            label="Email address"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
          <Field
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
          />
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="status-text" role="status">
              {notice}
            </p>
          )}
          <button className="btn full" disabled={busy} type="submit">
            {busy ? 'Please wait…' : 'Sign in'}
            <ArrowRight size={18} />
          </button>
          <button
            className="link"
            type="button"
            disabled={busy}
            onClick={() => void reset()}
          >
            Forgot your password?
          </button>
        </form>
        <div className="notice small">
          <LockKeyhole
            size={16}
            style={{ display: 'inline', marginRight: 8 }}
          />
          Access is limited to authorized company accounts. Need access? Contact
          your company owner.
        </div>
        <p className="footer-note">Sharaco Technologies · FacilityOS</p>
      </main>
    </div>
  );
}
function Gate({ services }: { services: FirebaseServices }) {
  const session = useSession();
  const [logoutError, setLogoutError] = useState('');
  if (session.loading)
    return (
      <div className="center-state">
        <Message title="Loading your company access…" />
      </div>
    );
  if (!session.user) return <Navigate to="/login" replace />;
  if (session.error || !session.companies.length)
    return (
      <div className="center-state">
        <Brand />
        <Message
          title={
            session.error ? 'Unable to load your workspace' : 'Access denied'
          }
          error
        >
          <p>
            {session.error ||
              'This account has no active administrator membership. Contact your company owner to arrange access.'}
          </p>
          {logoutError && <p>{logoutError}</p>}
          <div className="button-row">
            <button className="btn" onClick={session.refresh}>
              Refresh access
            </button>
            {session.hasMore && (
              <button
                className="btn secondary"
                disabled={session.loadingMore}
                onClick={() => void session.loadMore()}
              >
                Check more memberships
              </button>
            )}
            <button
              className="btn secondary"
              onClick={() =>
                void signOut(services.auth).catch((e) =>
                  setLogoutError(friendlyError(e)),
                )
              }
            >
              Sign out
            </button>
          </div>
        </Message>
      </div>
    );
  return <Workspace key={session.user.uid} services={services} />;
}
const modules = [
  {
    id: 'tasks',
    title: 'Task operations',
    icon: ClipboardCheck,
    phase: 3,
    group: 'OPERATIONS',
  },
  {
    id: 'templates',
    title: 'Task templates',
    icon: Layers,
    phase: 3,
    group: 'OPERATIONS',
  },
  {
    id: 'scheduler',
    title: 'Task scheduler',
    icon: CalendarDays,
    phase: 4,
    group: 'OPERATIONS',
  },
  {
    id: 'maintenance',
    title: 'Maintenance',
    icon: Wrench,
    phase: 4,
    group: 'OPERATIONS',
  },
  {
    id: 'work-orders',
    title: 'Work orders',
    icon: Wrench,
    phase: 4,
    group: 'OPERATIONS',
  },
  {
    id: 'complaints',
    title: 'Complaints',
    icon: MessageSquare,
    phase: 4,
    group: 'OPERATIONS',
  },
  {
    id: 'approvals',
    title: 'Approvals & RACI',
    icon: ShieldCheck,
    phase: 3,
    group: 'OPERATIONS',
  },
  {
    id: 'escalations',
    title: 'Escalations',
    icon: Zap,
    phase: 4,
    group: 'OPERATIONS',
  },
  {
    id: 'companies-sites',
    title: 'Companies & sites',
    icon: Building2,
    phase: 1,
    group: 'MANAGEMENT',
  },
  {
    id: 'facilities',
    title: 'Facilities & locations',
    icon: Building2,
    phase: 1,
    group: 'MANAGEMENT',
  },
  {
    id: 'assets',
    title: 'Assets & furniture',
    icon: Boxes,
    phase: 2,
    group: 'MANAGEMENT',
  },
  {
    id: 'inventory',
    title: 'Materials & inventory',
    icon: Package,
    phase: 2,
    group: 'MANAGEMENT',
  },
  {
    id: 'employees',
    title: 'Employees',
    icon: Users,
    phase: 2,
    group: 'MANAGEMENT',
  },
  {
    id: 'roles',
    title: 'Departments & roles',
    icon: ShieldCheck,
    phase: 2,
    group: 'MANAGEMENT',
  },
  {
    id: 'reports',
    title: 'Reports',
    icon: BarChart3,
    phase: 7,
    group: 'MANAGEMENT',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: Bell,
    phase: 4,
    group: 'MANAGEMENT',
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    phase: 1,
    group: 'MANAGEMENT',
  },
];
function Workspace({ services }: { services: FirebaseServices }) {
  const session = useSession();
  const [companyId, setCompanyId] = useState(
      session.companies[0].company.companyId,
    ),
    [navOpen, setNavOpen] = useState(false),
    [logoutError, setLogoutError] = useState('');
  const location = useLocation();
  const currentModule = modules.find((v) => location.pathname === '/' + v.id);
  async function logout() {
    try {
      await signOut(services.auth);
    } catch (e) {
      setLogoutError(friendlyError(e));
    }
  }
  function navigation() {
    setNavOpen(false);
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside
        className={'sidebar ' + (navOpen ? 'open' : '')}
        aria-label="Main navigation"
      >
        <Brand />
        <button
          className="btn secondary mobile-menu"
          onClick={() => setNavOpen(false)}
        >
          Close navigation
        </button>
        <div className="nav-caption">OPERATIONS</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')}
          onClick={navigation}
        >
          <LayoutDashboard />
          Dashboard
        </NavLink>
        {['OPERATIONS', 'MANAGEMENT'].map((group) => (
          <div key={group}>
            {group === 'MANAGEMENT' && (
              <div className="nav-caption">{group}</div>
            )}
            {modules
              .filter((v) => v.group === group)
              .map((m) => (
                <NavLink
                  key={m.id}
                  to={'/' + m.id}
                  className={({ isActive }) =>
                    'nav-link ' + (isActive ? 'active' : '')
                  }
                  onClick={navigation}
                >
                  <m.icon />
                  <span>{m.title}</span>
                  <small>P{m.phase}</small>
                </NavLink>
              ))}
          </div>
        ))}
        <div className="sidebar-foot">
          <div className="help-card">
            <strong>Simple. Clear. Connected.</strong>
            <p>Every check, repair and request in one place.</p>
            <span className="badge teal">Phase 0 · Foundation</span>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="top-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
            >
              <Menu size={20} />
            </button>
            <div className="top-context">
              <small>Sharaco FacilityOS / Operations workspace</small>
              <strong>Admin portal</strong>
            </div>
          </div>
          <div className="company-control">
            <label className="company-picker-label" htmlFor="company-select">
              Current company
            </label>
            <select
              className="select company-picker"
              id="company-select"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              {session.companies.map((a) => (
                <option key={a.company.companyId} value={a.company.companyId}>
                  {a.company.name}
                </option>
              ))}
            </select>
          </div>
          <details className="profile-menu">
            <summary aria-label="Profile menu">
              <span className="avatar">
                {session.profile?.displayName.slice(0, 2).toUpperCase()}
              </span>
              <span className="profile-name">
                {session.profile?.displayName}
              </span>
            </summary>
            <div>
              <strong>{session.profile?.displayName}</strong>
              <p className="small muted">{session.user?.email}</p>
              <button className="btn secondary" onClick={() => void logout()}>
                <LogOut size={16} />
                Sign out
              </button>
              {logoutError && <p role="alert">{logoutError}</p>}
            </div>
          </details>
        </header>
        {services.mode === 'emulator' && (
          <div className="environment">Local emulator · isolated test data</div>
        )}
        <main id="main-content" tabIndex={-1} className="content">
          <TenantView key={companyId} companyId={companyId} services={services}>
            {(access) => (
              <>
                <div className="page-heading">
                  <div>
                    <h1>{currentModule?.title || 'Your company workspace'}</h1>
                    <p>
                      {access.company.name} · {access.company.timeZone}
                    </p>
                  </div>
                  <span className="role-pill">
                    {access.member.role === 'owner'
                      ? 'Company owner'
                      : 'Company admin'}
                  </span>
                </div>
                {location.pathname === '/' ? (
                  <Dashboard access={access} />
                ) : currentModule ? (
                  <Message title={'Coming in Phase ' + currentModule.phase}>
                    <p>
                      {currentModule.title} will become available after its
                      implementation and review. This module is not active yet.
                    </p>
                    <NavLink className="btn secondary section-gap" to="/">
                      Back to dashboard
                    </NavLink>
                  </Message>
                ) : (
                  <Message title="Page not found">
                    <NavLink className="btn secondary" to="/">
                      Back to dashboard
                    </NavLink>
                  </Message>
                )}
                {session.hasMore && (
                  <button
                    className="btn secondary section-gap"
                    disabled={session.loadingMore}
                    onClick={() => void session.loadMore()}
                  >
                    {session.loadingMore ? 'Loading…' : 'Load more companies'}
                  </button>
                )}
                <p className="footer-note">
                  FacilityOS · Phase 0 admin foundation
                </p>
              </>
            )}
          </TenantView>
        </main>
      </div>
    </div>
  );
}
function TenantView({
  companyId,
  services,
  children,
}: {
  companyId: string;
  services: FirebaseServices;
  children: (access: Access) => ReactNode;
}) {
  const { user, refresh } = useSession();
  const [member, setMember] = useState<Membership | null>(null),
    [company, setCompany] = useState<Company | null>(null),
    [pending, setPending] = useState(2),
    [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    let active = true;
    const seen = new Set<string>();
    function received(key: string) {
      if (!seen.has(key)) {
        seen.add(key);
        setPending(2 - seen.size);
      }
    }
    function fail(e: unknown) {
      if (active) {
        setError(friendlyError(e));
        setMember(null);
        setCompany(null);
      }
    }
    const stopMember = onSnapshot(
      doc(services.db, 'companies', companyId, 'members', user.uid),
      { includeMetadataChanges: true },
      (snap) => {
        if (!active || snap.metadata.fromCache) return;
        try {
          setMember(snap.exists() ? memberSchema.parse(snap.data()) : null);
          received('member');
        } catch (e) {
          fail(e);
        }
      },
      fail,
    );
    const stopCompany = onSnapshot(
      doc(services.db, 'companies', companyId),
      { includeMetadataChanges: true },
      (snap) => {
        if (!active || snap.metadata.fromCache) return;
        try {
          setCompany(snap.exists() ? companySchema.parse(snap.data()) : null);
          received('company');
        } catch (e) {
          fail(e);
        }
      },
      fail,
    );
    const timeout = setTimeout(() => {
      if (active && seen.size < 2)
        setError(
          'Unable to verify company access. Check your connection and refresh.',
        );
    }, 15000);
    return () => {
      active = false;
      clearTimeout(timeout);
      stopMember();
      stopCompany();
    };
  }, [companyId, services, user]);
  if (error)
    return (
      <Message title="Company access unavailable" error>
        <p>{error}</p>
        <button className="btn section-gap" onClick={refresh}>
          Refresh access
        </button>
      </Message>
    );
  if (pending) return <Message title="Verifying company access…" />;
  if (!user || !canOpenAdmin(member, company, user.uid) || !member || !company)
    return (
      <Message title="Access denied" error>
        <p>
          Your company membership is no longer active or does not allow admin
          access.
        </p>
        <button className="btn section-gap" onClick={refresh}>
          Refresh access
        </button>
      </Message>
    );
  return children({ member, company });
}
function Dashboard({ access }: { access: Access }) {
  return (
    <>
      <section className="summary-banner">
        <div>
          <span className="eyebrow" style={{ color: '#c2e9e2' }}>
            YOUR COMPANY · CONNECTED
          </span>
          <h2 className="section-gap">
            A clear foundation for your facilities.
          </h2>
          <p>
            Your company information is connected. Facility setup and daily
            operations will be introduced in the next development phases.
          </p>
        </div>
        <ShieldCheck size={42} />
      </section>
      <div className="foundation-grid">
        <article className="card">
          <span className="eyebrow">COMPANY PROFILE</span>
          <h2 className="section-gap">{access.company.name}</h2>
          <dl className="company-detail">
            <div>
              <dt>Company ID</dt>
              <dd>{access.company.companyId}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Active</dd>
            </div>
            <div>
              <dt>Time zone</dt>
              <dd>{access.company.timeZone}</dd>
            </div>
            <div>
              <dt>Your access</dt>
              <dd>
                {access.member.role === 'owner'
                  ? 'Company owner'
                  : 'Company admin'}
              </dd>
            </div>
          </dl>
        </article>
        <article className="card">
          <h3>Ready for the next step</h3>
          <p>Company and facility setup is planned for Phase 1.</p>
          <ul className="section-gap">
            <li>Clients, contracts and sites</li>
            <li>Buildings, rooms and outdoor areas</li>
            <li>Facility types and locations</li>
          </ul>
          <NavLink to="/companies-sites" className="btn secondary section-gap">
            View planned module
            <ArrowRight size={16} />
          </NavLink>
        </article>
      </div>
      <section className="card empty section-gap">
        <ClipboardCheck size={32} />
        <strong>Operations reporting is not active yet</strong>
        <p>
          Task, asset and maintenance reports will appear as their modules
          become available.
        </p>
      </section>
    </>
  );
}
export default function App({ services }: { services: FirebaseServices }) {
  const Router =
    import.meta.env.VITE_ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter;
  return (
    <Router>
      <SessionProvider services={services}>
        <Routes>
          <Route path="/login" element={<Login services={services} />} />
          <Route path="*" element={<Gate services={services} />} />
        </Routes>
      </SessionProvider>
    </Router>
  );
}
