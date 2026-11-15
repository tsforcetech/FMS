import { useEffect, useRef } from 'react';
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
  Link,
} from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Bell,
  ClipboardCheck,
  CloudOff,
  Home as HomeIcon,
  Megaphone,
  QrCode,
  RefreshCw,
  UserRound,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { FirebaseServices } from '@admin/firebase';
import { StaffApp, useStaff } from '@staff/App';
import { useT, type Key } from '@staff/i18n';
import { MyIssues, ReportIssue } from '@staff/screens/Issues';
import { WorkOrderList, WorkOrderView } from '@staff/screens/WorkOrders';
import { StaffCalendar } from '@staff/screens/StaffCalendar';
import { StaffNotifications, Profile } from '@staff/screens/Profile';
import { Approvals } from '@staff/screens/Approvals';
import { History } from '@staff/screens/MyTasks';
import { MobileProvider, mobileResolver, useMobile, wipe } from './core';
import { Home, Tasks, SyncCenter, ReportFromTask } from './screens/Main';
import { TaskRun } from './screens/TaskRun';
import { Scan } from './screens/Scan';
import { Attendance } from './screens/Attendance';
import { platformName } from './platform';

export default function MobileApp({
  services,
}: {
  services: FirebaseServices;
}) {
  // Signing out (from any screen) destroys the signed-out user's device data and key.
  const last = useRef<string | null>(null);
  useEffect(
    () =>
      onAuthStateChanged(services.auth, (u) => {
        if (!u && last.current) void wipe(last.current);
        last.current = u?.uid || null;
      }),
    [services],
  );
  return (
    <StaffApp
      services={services}
      Shell={MobileShell}
      resolver={mobileResolver}
    />
  );
}
function MobileShell() {
  return (
    <MobileProvider>
      <Frame />
    </MobileProvider>
  );
}
function SyncPill() {
  const m = useMobile();
  const { t } = useT();
  const s = m.state;
  const cls = !s.online
    ? 'off'
    : s.conflicts
      ? 'bad'
      : s.pending || s.running
        ? 'busy'
        : 'ok';
  return (
    <Link to="/sync" className={'m-sync ' + cls} aria-label={t('syncCenter')}>
      {!s.online ? (
        <CloudOff size={16} />
      ) : s.conflicts ? (
        <AlertTriangle size={16} />
      ) : s.pending || s.running ? (
        <RefreshCw size={16} className={s.running ? 'spin' : ''} />
      ) : (
        <CheckCircle2 size={16} />
      )}
      <span>
        {!s.online
          ? 'Offline'
          : s.conflicts
            ? `${s.conflicts} ${t('conflicts')}`
            : s.pending
              ? `${s.pending} ${t('syncPending')}`
              : t('synced')}
      </span>
    </Link>
  );
}
function Frame() {
  const staff = useStaff();
  const m = useMobile();
  const { t } = useT();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const nav: { to: string; label: Key; icon: React.ReactNode }[] = [
    { to: '/', label: 'home', icon: <HomeIcon /> },
    { to: '/tasks', label: 'myTasks', icon: <ClipboardCheck /> },
    { to: '/scan', label: 'scan', icon: <QrCode /> },
    { to: '/issues', label: 'issues', icon: <Megaphone /> },
    { to: '/profile', label: 'profile', icon: <UserRound /> },
  ];
  return (
    <div className={'s-shell m-shell platform-' + platformName}>
      <header className="s-top">
        <div className="s-top-brand">
          <span className="s-logo sm">F</span>
          <div>
            <strong>{staff.companyName}</strong>
            <span>{staff.employee.name}</span>
          </div>
        </div>
        <SyncPill />
        <NavLink
          to="/notifications"
          className="s-bell"
          aria-label={t('notifications')}
        >
          <Bell />
        </NavLink>
      </header>
      {!m.state.online && (
        <div className="s-offline" role="status">
          <CloudOff size={18} /> {t('offlineMode')}
        </div>
      )}
      <main className="s-main" id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/task/:id" element={<Keyed />} />
          <Route path="/report-task/:id" element={<ReportFromTask />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/issues" element={<MyIssues />} />
          <Route
            path="/report"
            element={
              <Online>
                <ReportIssue />
              </Online>
            }
          />
          <Route
            path="/work-orders"
            element={
              <Online>
                <WorkOrderList />
              </Online>
            }
          />
          <Route
            path="/work-orders/:id"
            element={
              <Online>
                <WorkOrderView />
              </Online>
            }
          />
          <Route
            path="/calendar"
            element={
              <Online>
                <StaffCalendar />
              </Online>
            }
          />
          <Route
            path="/history"
            element={
              <Online>
                <History />
              </Online>
            }
          />
          <Route
            path="/notifications"
            element={
              <Online>
                <StaffNotifications />
              </Online>
            }
          />
          <Route
            path="/approvals"
            element={
              staff.supervisor ? (
                <Online>
                  <Approvals />
                </Online>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/sync" element={<SyncCenter />} />
          <Route path="/profile" element={<More />} />
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
            <span className="s-bottom-icon">{n.icon}</span>
            <span>{t(n.label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
function Keyed() {
  const { id = '' } = useParams();
  return <TaskRun key={id} />;
}
/** Screens that read live data show a clear message instead of failing offline. */
function Online({ children }: { children: React.ReactNode }) {
  const m = useMobile();
  const { t } = useT();
  return m.state.online ? (
    <>{children}</>
  ) : (
    <div className="s-page">
      <div className="s-offline in-page">
        <CloudOff size={18} /> {t('offlineMode')}
      </div>
    </div>
  );
}
function More() {
  const staff = useStaff();
  const { t } = useT();
  const links: [string, Key][] = [
    ['/attendance', 'attendance'],
    ['/sync', 'syncCenter'],
    ['/work-orders', 'myWorkOrders'],
    ['/calendar', 'calendar'],
    ['/history', 'history'],
    ['/notifications', 'notifications'],
    ...(staff.supervisor
      ? ([['/approvals', 'approvals']] as [string, Key][])
      : []),
  ];
  return (
    <>
      <nav className="m-more" aria-label={t('more')}>
        {links.map(([to, k]) => (
          <Link key={to} to={to} className="m-more-link">
            {t(k)}
          </Link>
        ))}
      </nav>
      <Online>
        <Profile />
      </Online>
    </>
  );
}
