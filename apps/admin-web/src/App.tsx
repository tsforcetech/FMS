import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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
  useNavigate,
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
  Menu,
  LogOut,
  ArrowRight,
  LockKeyhole,
  Bell,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  Home,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  FlaskConical,
  Mail,
  Eye,
  EyeOff,
  Hourglass,
  type LucideIcon,
} from 'lucide-react';
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
import { groups, pageForPath } from './nav';
import { Overview } from './management/Overview';
import { RecordPage } from './management/Records';
import {
  BalancesPage,
  MovementsPage,
  TransfersPage,
} from './management/Assets';
import { AccessPage, CompanySettings, RolesPage } from './management/Admin';
import { clearLabelCache, type Context } from './management/context';
import {
  Avatar,
  IconCircle,
  PageHead,
  Pill,
  ToastProvider,
  type Tone,
} from './ui/kit';

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
function Logo() {
  return (
    <span className="logo" aria-hidden>
      <Layers />
    </span>
  );
}
function Wordmark() {
  return (
    <div className="wordmark">
      Facility<span>OS</span>
      <small>BY SHARACO</small>
    </div>
  );
}
function StateCard({
  title,
  icon,
  tone = 'blue',
  children,
}: {
  title: string;
  icon: LucideIcon;
  tone?: Tone;
  children?: ReactNode;
}) {
  return (
    <section
      className="card state-card"
      role={tone === 'red' ? 'alert' : 'status'}
    >
      <IconCircle icon={icon} tone={tone} size="lg" />
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Login({ services }: { services: FirebaseServices }) {
  const { user, loading } = useSession();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  if (loading)
    return (
      <div className="center-state">
        <StateCard title="Checking your session…" icon={ShieldCheck}>
          <div className="spinner" aria-hidden />
        </StateCard>
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
  const preview: [string, string, Tone][] = [
    ['Marina Campus · 3 floors mapped', 'Active', 'green'],
    ['Chiller AC-01 transferred to Tower B', 'Recorded', 'blue'],
    ['Cleaning liquid below reorder level', 'Reorder', 'red'],
  ];
  return (
    <div className="auth">
      <section className="auth-story">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo />
          <div className="wordmark" style={{ color: '#fff' }}>
            Facility<span style={{ color: '#bcd2ff' }}>OS</span>
            <small style={{ color: 'rgba(255,255,255,.7)' }}>BY SHARACO</small>
          </div>
        </div>
        <div>
          <h1>Every site, asset and team. One calm workspace.</h1>
          <p>
            Manage properties, people, equipment and stock for every company you
            serve, with security built into every record.
          </p>
        </div>
        <div className="auth-preview" aria-hidden>
          {preview.map(([t, p, tone], i) => (
            <div className="row" key={t} style={{ ['--i' as string]: i }}>
              <span
                className={`icon-circle tone-${tone}`}
                style={{ width: 30, height: 30 }}
              />
              {t}
              <Pill tone={tone}>{p}</Pill>
            </div>
          ))}
        </div>
      </section>
      <main className="auth-panel">
        <form className="auth-form" onSubmit={submit} noValidate>
          <Logo />
          <div>
            <h1>Sign in to your workspace</h1>
          </div>
          <p className="lead">
            Use the account provided by your company administrator.
          </p>
          <div className="field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              className="input"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <div className="input-suffix">
              <input
                id="login-password"
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
              <span>
                <button
                  type="button"
                  className="icon-btn sm"
                  style={{ border: 0 }}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff /> : <Eye />}
                </button>
              </span>
            </div>
          </div>
          {error && (
            <div className="banner tone-red" role="alert">
              <AlertTriangle />
              <div>{error}</div>
            </div>
          )}
          {notice && (
            <div className="banner tone-green" role="status">
              <Mail />
              <div>{notice}</div>
            </div>
          )}
          <button
            className="btn btn-primary btn-lg btn-block"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Please wait…' : 'Sign in'}
            <ArrowRight />
          </button>
          <button
            className="link-btn"
            style={{ alignSelf: 'center' }}
            type="button"
            disabled={busy}
            onClick={() => void reset()}
          >
            Forgot your password?
          </button>
          <div className="auth-note">
            <LockKeyhole />
            Access is limited to authorized company accounts. Need access?
            Contact your company owner.
          </div>
          <p className="footer-note">Sharaco Technologies · FacilityOS</p>
        </form>
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
        <StateCard title="Loading your company access…" icon={ShieldCheck}>
          <div className="spinner" aria-hidden />
        </StateCard>
      </div>
    );
  if (!session.user) return <Navigate to="/login" replace />;
  if (session.error || !session.companies.length)
    return (
      <div className="center-state">
        <StateCard
          title={
            session.error ? 'Unable to load your workspace' : 'Access denied'
          }
          tone="red"
          icon={session.error ? AlertTriangle : LockKeyhole}
        >
          <p>
            {session.error ||
              'This account has no active administrator membership. Contact your company owner to arrange access.'}
          </p>
          {logoutError && <p>{logoutError}</p>}
          <div className="actions">
            <button className="btn btn-primary" onClick={session.refresh}>
              <RefreshCw />
              Refresh access
            </button>
            {session.hasMore && (
              <button
                className="btn btn-outline"
                disabled={session.loadingMore}
                onClick={() => void session.loadMore()}
              >
                Check more memberships
              </button>
            )}
            <button
              className="btn btn-outline"
              onClick={() =>
                void signOut(services.auth).catch((e) =>
                  setLogoutError(friendlyError(e)),
                )
              }
            >
              <LogOut />
              Sign out
            </button>
          </div>
        </StateCard>
      </div>
    );
  return <Workspace key={session.user.uid} services={services} />;
}
function Sidebar({
  open,
  onNavigate,
  collapsed,
  onCollapse,
}: {
  open: boolean;
  onNavigate: () => void;
  collapsed: boolean;
  onCollapse: () => void;
}) {
  const location = useLocation();
  const current = pageForPath(location.pathname);
  const [closed, setClosed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('fos-nav-closed') || '[]');
    } catch {
      return [];
    }
  });
  function toggle(id: string) {
    const next = closed.includes(id)
      ? closed.filter((x) => x !== id)
      : [...closed, id];
    setClosed(next);
    try {
      localStorage.setItem('fos-nav-closed', JSON.stringify(next));
    } catch {
      /* preference only */
    }
  }
  return (
    <aside
      className={'sidebar ' + (open ? 'open' : '')}
      aria-label="Main navigation"
    >
      <div className="sidebar-top">
        <Logo />
        <Wordmark />
      </div>
      <nav className="nav-scroll">
        {groups.map((g) => {
          const isOpen =
            collapsed ||
            !closed.includes(g.id) ||
            g.pages.some((p) => p.id === current?.id);
          return (
            <div className="nav-group" key={g.id}>
              <button
                type="button"
                className="nav-caption"
                aria-expanded={isOpen}
                onClick={() => toggle(g.id)}
              >
                {g.label}
                <ChevronDown />
              </button>
              {isOpen &&
                g.pages.map((p) => (
                  <NavLink
                    key={p.id}
                    to={'/' + p.id}
                    end
                    data-label={p.label}
                    className={({ isActive }) =>
                      'nav-link ' +
                      (isActive ? 'active ' : '') +
                      (p.phase ? 'future' : '')
                    }
                    onClick={onNavigate}
                  >
                    <p.icon />
                    <span className="label">{p.label}</span>
                    {p.phase && (
                      <span className="soon-chip">Phase {p.phase}</span>
                    )}
                  </NavLink>
                ))}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <button
          type="button"
          className="btn btn-ghost collapse-btn"
          onClick={onCollapse}
        >
          <ChevronsLeft />
          <span className="label">Collapse sidebar</span>
        </button>
      </div>
    </aside>
  );
}
function Workspace({ services }: { services: FirebaseServices }) {
  const session = useSession();
  const [companyId, setCompanyId] = useState(
      session.companies[0].company.companyId,
    ),
    [navOpen, setNavOpen] = useState(false),
    [collapsed, setCollapsed] = useState(() => {
      try {
        return localStorage.getItem('fos-collapsed') === '1';
      } catch {
        return false;
      }
    }),
    [logoutError, setLogoutError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const page = pageForPath(location.pathname);
  const profileRef = useRef<HTMLDetailsElement>(null);
  async function logout() {
    try {
      await signOut(services.auth);
    } catch (e) {
      setLogoutError(friendlyError(e));
    }
  }
  useEffect(() => {
    setNavOpen(false);
    if (profileRef.current) profileRef.current.open = false;
  }, [location.pathname]);
  useEffect(() => {
    clearLabelCache();
  }, [companyId]);
  const name = session.profile?.displayName || 'there';
  return (
    <div className={'shell ' + (collapsed ? 'collapsed' : '')}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar
        open={navOpen}
        collapsed={collapsed}
        onNavigate={() => setNavOpen(false)}
        onCollapse={() => {
          setCollapsed(!collapsed);
          try {
            localStorage.setItem('fos-collapsed', collapsed ? '0' : '1');
          } catch {
            /* preference only */
          }
        }}
      />
      {navOpen && (
        <div
          className="overlay"
          style={{ zIndex: 84 }}
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}
      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <Menu />
          </button>
          <nav className="crumbs" aria-label="Breadcrumb">
            <span className="hide-sm">{session.profile?.displayName}</span>
            <ChevronRight className="sep hide-sm" />
            {page && page.id ? (
              <>
                <span className="hide-sm">{page.group.label}</span>
                <ChevronRight className="sep hide-sm" />
                <strong>
                  <page.icon />
                  {page.label}
                </strong>
              </>
            ) : (
              <strong>
                <Home />
                Home
              </strong>
            )}
          </nav>
          <div className="top-actions">
            <button
              className="icon-btn hide-sm"
              aria-label="Search modules"
              onClick={() => navigate('/')}
            >
              <Search />
            </button>
            <button
              className="icon-btn hide-sm"
              aria-label="Notifications (coming in a later phase)"
              title="Notifications arrive in a later phase"
            >
              <Bell />
            </button>
            <label className="sr-only" htmlFor="company-select">
              Current company
            </label>
            <select
              className="company-select"
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
            <details className="profile" ref={profileRef}>
              <summary aria-label="Profile menu">
                <Avatar name={name} />
                <span className="who">{name}</span>
                <ChevronDown size={16} />
              </summary>
              <div className="menu-pop">
                <strong>{name}</strong>
                <p className="email">{session.user?.email}</p>
                <button
                  className="btn btn-outline btn-block"
                  onClick={() => void logout()}
                >
                  <LogOut />
                  Sign out
                </button>
                {logoutError && <p role="alert">{logoutError}</p>}
              </div>
            </details>
          </div>
        </header>
        {services.mode === 'emulator' && (
          <div className="env-banner">
            <FlaskConical size={15} />
            Local emulator · isolated test data
          </div>
        )}
        <main id="main-content" tabIndex={-1} className="content">
          <TenantView key={companyId} companyId={companyId} services={services}>
            {(access) => (
              <Screen
                access={access}
                services={services}
                name={name}
                pathname={location.pathname}
              />
            )}
          </TenantView>
          {session.hasMore && (
            <button
              className="btn btn-outline"
              style={{ alignSelf: 'center' }}
              disabled={session.loadingMore}
              onClick={() => void session.loadMore()}
            >
              {session.loadingMore ? 'Loading…' : 'Load more companies'}
            </button>
          )}
          <p className="footer-note">FacilityOS by Sharaco Technologies</p>
        </main>
      </div>
    </div>
  );
}
function Screen({
  access,
  services,
  name,
  pathname,
}: {
  access: Access;
  services: FirebaseServices;
  name: string;
  pathname: string;
}) {
  const context: Context = useMemo(
    () => ({
      services,
      company: access.company,
      uid: access.member.uid,
      role: access.member.role,
    }),
    [services, access.company, access.member.uid, access.member.role],
  );
  const page = pageForPath(pathname);
  if (!page)
    return (
      <StateCard title="Page not found" icon={AlertTriangle} tone="amber">
        <NavLink className="btn btn-primary" to="/">
          Back to dashboard
        </NavLink>
      </StateCard>
    );
  if (page.screen === 'overview')
    return <Overview context={context} name={name} />;
  const head = (
    <PageHead
      title={page.label}
      subtitle={
        page.description ||
        (page.phase
          ? undefined
          : `${access.company.name} · ${access.company.timeZone}`)
      }
    />
  );
  if (page.phase)
    return (
      <>
        {head}
        <StateCard
          title={`${page.label} arrives in Phase ${page.phase}`}
          icon={Hourglass}
        >
          <p>
            This module is planned and not active yet. It will appear here after
            its implementation, testing and review.
          </p>
          <div className="actions">
            <NavLink className="btn btn-outline" to="/">
              Back to dashboard
            </NavLink>
          </div>
        </StateCard>
      </>
    );
  return (
    <>
      {head}
      {page.kinds ? (
        <RecordPage
          key={page.id}
          context={context}
          kinds={page.kinds}
          assetClasses={page.assetClasses}
        />
      ) : page.screen === 'balances' ? (
        <BalancesPage context={context} />
      ) : page.screen === 'movements' ? (
        <MovementsPage context={context} />
      ) : page.screen === 'transfers' ? (
        <TransfersPage context={context} />
      ) : page.screen === 'roles' ? (
        <RolesPage />
      ) : page.screen === 'access' ? (
        <AccessPage context={context} />
      ) : (
        <CompanySettings
          key={access.company.updatedAt.toMillis()}
          context={context}
        />
      )}
    </>
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
      <StateCard
        title="Company access unavailable"
        tone="red"
        icon={AlertTriangle}
      >
        <p>{error}</p>
        <div className="actions">
          <button className="btn btn-primary" onClick={refresh}>
            <RefreshCw />
            Refresh access
          </button>
        </div>
      </StateCard>
    );
  if (pending)
    return (
      <StateCard title="Verifying company access…" icon={ShieldCheck}>
        <div className="spinner" aria-hidden />
      </StateCard>
    );
  if (!user || !canOpenAdmin(member, company, user.uid) || !member || !company)
    return (
      <StateCard title="Access denied" tone="red" icon={LockKeyhole}>
        <p>
          Your company membership is no longer active or does not allow admin
          access.
        </p>
        <div className="actions">
          <button className="btn btn-primary" onClick={refresh}>
            <RefreshCw />
            Refresh access
          </button>
        </div>
      </StateCard>
    );
  return children({ member, company });
}
export default function App({ services }: { services: FirebaseServices }) {
  const Router =
    import.meta.env.VITE_ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter;
  return (
    <Router>
      <ToastProvider>
        <SessionProvider services={services}>
          <Routes>
            <Route path="/login" element={<Login services={services} />} />
            <Route path="*" element={<Gate services={services} />} />
          </Routes>
        </SessionProvider>
      </ToastProvider>
    </Router>
  );
}
