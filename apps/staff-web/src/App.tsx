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
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
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
  ClipboardCheck,
  Home,
  LogOut,
  Megaphone,
  UserRound,
  WifiOff,
  ShieldCheck,
} from 'lucide-react';
import type { Company } from '@facilityos/shared';
import type { FirebaseServices } from '@admin/firebase';
import type { Context } from '@admin/management/context';
import { clearLabelCache } from '@admin/management/context';
import {
  resolveStaff,
  staffCompanies,
  type StaffAccess,
  type StaffDenied,
} from '@admin/management/staffStore';
import { unreadCount } from '@admin/management/notifyStore';
import { useT, type Key } from './i18n';
import { MyDay } from './screens/MyDay';
import { MyTasks, History } from './screens/MyTasks';
import { TaskView } from './screens/TaskView';
import { ReportIssue, MyIssues } from './screens/Issues';
import { WorkOrderList, WorkOrderView } from './screens/WorkOrders';
import { StaffCalendar } from './screens/StaffCalendar';
import { StaffNotifications, Profile } from './screens/Profile';
import { Approvals } from './screens/Approvals';

/* ================================================================ session */
export type Staff = StaffAccess & {
  uid: string;
  context: Context;
  companies: string[];
  switchTo: (c: string) => void;
};
const StaffCtx = createContext<Staff | null>(null);
export function useStaff() {
  const s = useContext(StaffCtx);
  if (!s) throw new Error('Staff session missing');
  return s;
}
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export default function App({ services }: { services: FirebaseServices }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(services.auth, setUser), [services]);
  if (user === undefined) return <Splash />;
  if (!user) return <Login services={services} />;
  return (
    <HashRouter>
      <Session key={user.uid} services={services} user={user} />
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
function Session({
  services,
  user,
}: {
  services: FirebaseServices;
  user: User;
}) {
  const { t } = useT();
  const [state, setState] = useState<{
    access?: StaffAccess;
    denied?: StaffDenied;
    companies: string[];
  }>();
  const [pick, setPick] = useState<string>(() => {
    try {
      return sessionStorage.getItem('fos-staff-company') || '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    let live = true;
    (async () => {
      const companies = await staffCompanies(services.db, user.uid).catch(
        () => [] as string[],
      );
      const order =
        pick && companies.includes(pick)
          ? [pick, ...companies.filter((c) => c !== pick)]
          : companies;
      let denied: StaffDenied | undefined;
      for (const c of order) {
        const r = await resolveStaff(services.db, c, user.uid);
        if ('link' in r) {
          if (live) setState({ access: r, companies });
          return;
        }
        denied ??= r;
      }
      if (live)
        setState({
          denied: denied || { companyId: '', reason: 'no-link' },
          companies,
        });
    })();
    return () => {
      live = false;
    };
  }, [services, user.uid, pick]);
  const switchTo = useCallback((c: string) => {
    try {
      sessionStorage.setItem('fos-staff-company', c);
    } catch {
      /* preference only */
    }
    clearLabelCache();
    setState(undefined);
    setPick(c);
  }, []);
  const staff = useMemo<Staff | null>(() => {
    const a = state?.access;
    if (!a) return null;
    const company = {
      companyId: a.companyId,
      name: a.companyName,
      timeZone: a.timeZone,
      status: 'active',
    } as unknown as Company;
    return {
      ...a,
      uid: user.uid,
      companies: state!.companies,
      switchTo,
      context: { services, company, uid: user.uid, role: a.role },
    };
  }, [state, services, user.uid, switchTo]);
  if (!state) return <Splash />;
  if (!staff) {
    const reason = state.denied?.reason || 'no-link';
    const title: Key =
      reason === 'revoked'
        ? 'revoked'
        : reason === 'inactive-employee'
          ? 'inactiveEmployee'
          : reason === 'inactive-member'
            ? 'inactiveMember'
            : 'notLinked';
    return (
      <div className="s-center s-denied" role="alert">
        <ShieldCheck size={44} />
        <h1>{t(title)}</h1>
        <p>{t('notLinkedHelp')}</p>
        <p className="small muted">{user.email}</p>
        <button
          className="btn btn-outline btn-lg"
          onClick={() => void signOut(services.auth)}
        >
          <LogOut /> {t('signOut')}
        </button>
      </div>
    );
  }
  return (
    <StaffCtx.Provider value={staff}>
      <Shell />
    </StaffCtx.Provider>
  );
}

/* ================================================================ login */
function Login({ services }: { services: FirebaseServices }) {
  const { t } = useT();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [info, setInfo] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await signInWithEmailAndPassword(services.auth, email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      setError(code.includes('network') ? t('offline') : t('badLogin'));
      setBusy(false);
    }
  }
  return (
    <main className="s-login">
      <div className="s-login-card">
        <div className="s-logo">F</div>
        <p className="s-brand">{t('appName')}</p>
        <h1>{t('signInTitle')}</h1>
        <p className="muted">{t('signInHelp')}</p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="s-email">{t('email')}</label>
          <input
            id="s-email"
            className="input"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="s-password">{t('password')}</label>
          <input
            id="s-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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
            {busy ? t('signingIn') : t('signIn')}
          </button>
        </form>
        <button
          type="button"
          className="link-btn"
          onClick={async () => {
            if (!email.trim()) return setError(t('email'));
            try {
              await sendPasswordResetEmail(services.auth, email.trim());
            } catch {
              /* same message either way (no account enumeration) */
            }
            setInfo(t('resetSent'));
          }}
        >
          {t('forgot')}
        </button>
      </div>
    </main>
  );
}

/* ================================================================ shell */
function Shell() {
  const staff = useStaff();
  const { t } = useT();
  const online = useOnline();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let live = true;
    const load = () =>
      unreadCount(staff.context.services.db, staff.companyId, staff.uid)
        .then((n) => live && setUnread(n))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener('fos-notifications', load);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('fos-notifications', load);
    };
  }, [staff, location.pathname]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const nav: { to: string; label: Key; icon: ReactNode; badge?: number }[] = [
    { to: '/', label: 'home', icon: <Home /> },
    { to: '/tasks', label: 'myTasks', icon: <ClipboardCheck /> },
    { to: '/report', label: 'report', icon: <Megaphone /> },
    { to: '/notifications', label: 'alerts', icon: <Bell />, badge: unread },
    { to: '/profile', label: 'profile', icon: <UserRound /> },
  ];
  const more: { to: string; label: Key }[] = [
    { to: '/calendar', label: 'calendar' },
    { to: '/work-orders', label: 'myWorkOrders' },
    { to: '/issues', label: 'myIssues' },
    { to: '/history', label: 'history' },
    ...(staff.supervisor
      ? [{ to: '/approvals', label: 'approvals' as Key }]
      : []),
  ];
  return (
    <div className="s-shell">
      <header className="s-top">
        <div className="s-top-brand">
          <span className="s-logo sm">F</span>
          <div>
            <strong>{staff.companyName}</strong>
            <span>{staff.employee.name}</span>
          </div>
        </div>
        <NavLink
          to="/notifications"
          className="s-bell"
          aria-label={
            unread ? `${t('notifications')}, ${unread}` : t('notifications')
          }
        >
          <Bell />
          {unread > 0 && (
            <span className="badge">{unread > 99 ? '99+' : unread}</span>
          )}
        </NavLink>
      </header>
      {!online && (
        <div className="s-offline" role="status">
          <WifiOff size={18} /> {t('offline')}
        </div>
      )}
      <nav className="s-rail" aria-label="Main">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className="s-rail-link"
          >
            {n.icon}
            <span>{t(n.label)}</span>
            {!!n.badge && <span className="count-chip">{n.badge}</span>}
          </NavLink>
        ))}
        <div className="s-rail-sep" />
        {more.map((n) => (
          <NavLink key={n.to} to={n.to} className="s-rail-link sub">
            <span>{t(n.label)}</span>
          </NavLink>
        ))}
      </nav>
      <main className="s-main" id="main">
        <Routes>
          <Route path="/" element={<MyDay />} />
          <Route path="/tasks" element={<MyTasks />} />
          <Route path="/task/:id" element={<TaskRoute />} />
          <Route path="/report" element={<ReportIssue />} />
          <Route path="/issues" element={<MyIssues />} />
          <Route path="/work-orders" element={<WorkOrderList />} />
          <Route path="/work-orders/:id" element={<WorkOrderRoute />} />
          <Route path="/calendar" element={<StaffCalendar />} />
          <Route path="/history" element={<History />} />
          <Route path="/notifications" element={<StaffNotifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route
            path="/approvals"
            element={
              staff.supervisor ? <Approvals /> : <Navigate to="/" replace />
            }
          />
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
            <span>{t(n.label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
/** Remount per record so checklist step and draft state never leak between tasks. */
function TaskRoute() {
  const { id = '' } = useParams();
  return <TaskView key={id} />;
}
function WorkOrderRoute() {
  const { id = '' } = useParams();
  return <WorkOrderView key={id} />;
}
