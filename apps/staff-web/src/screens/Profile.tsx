import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  Bell,
  BellOff,
  CheckCheck,
  Globe,
  LogOut,
  CalendarOff,
  Clock3,
  Building2,
} from 'lucide-react';
import { notificationLabels, type NotificationType } from '@facilityos/shared';
import {
  listNotifications,
  loadPreferences,
  markAllRead,
  markRead,
  savePreferences,
  type AppNotification,
  type Preferences,
} from '@admin/management/notifyStore';
import { myShiftContext, staffRoleLabels } from '@admin/management/staffStore';
import { Pill, useToast } from '@admin/ui/kit';
import { useStaff } from '../App';
import { coverage, languages, useT } from '../i18n';
import {
  Empty,
  ErrorBox,
  Label,
  Loading,
  fmtDateTime,
  friendlyError,
  todayIn,
} from './common';

const staffTypes: NotificationType[] = [
  'task_assigned',
  'task_reassigned',
  'task_due_soon',
  'task_overdue',
  'task_rework',
  'task_rejected',
  'task_approved',
  'work_order_assigned',
  'issue_updated',
];
function pathFor(n: AppNotification) {
  if (n.recordKind === 'tasks') return `/task/${n.recordId}`;
  if (n.recordKind === 'workOrders') return `/work-orders/${n.recordId}`;
  return '/';
}
export function StaffNotifications() {
  const staff = useStaff();
  const { t } = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const db = staff.context.services.db;
  const [rows, setRows] = useState<AppNotification[]>(),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    listNotifications(db, staff.companyId, staff.uid, false, 60)
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(friendlyError(e, t)));
    return () => {
      live = false;
    };
  }, [db, staff, version, t]);
  return (
    <div className="s-page">
      <div className="s-title-row">
        <h1 className="s-title">{t('notifications')}</h1>
        <button
          className="btn btn-outline"
          onClick={async () => {
            const n = await markAllRead(db, staff.companyId, staff.uid).catch(
              () => 0,
            );
            if (n) toast(`${n} ✓`);
            window.dispatchEvent(new Event('fos-notifications'));
            setVersion((v) => v + 1);
          }}
        >
          <CheckCheck /> {t('markAllRead')}
        </button>
      </div>
      {error && <ErrorBox error={error} />}
      {!rows && !error && <Loading />}
      {rows && !rows.length && (
        <Empty icon={<BellOff />} title={t('noNotifications')} />
      )}
      <div className="s-list">
        {rows?.map((n) => (
          <button
            key={n.id}
            className={'s-card simple s-note' + (n.readAt ? '' : ' unread')}
            onClick={async () => {
              if (!n.readAt)
                await markRead(db, staff.companyId, n.id).catch(
                  () => undefined,
                );
              window.dispatchEvent(new Event('fos-notifications'));
              navigate(pathFor(n));
            }}
          >
            <div className="s-card-top">
              <Bell size={16} />
              <strong>{n.title}</strong>
              {!n.readAt && (
                <Pill tone="blue" dot>
                  New
                </Pill>
              )}
            </div>
            <p>{n.body}</p>
            <p className="s-meta">
              {n.createdAt
                ? fmtDateTime(n.createdAt.toDate(), staff.timeZone)
                : ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Profile() {
  const staff = useStaff();
  const { t, lang, setLang } = useT();
  const toast = useToast();
  const db = staff.context.services.db;
  const [shift, setShift] =
      useState<Awaited<ReturnType<typeof myShiftContext>>>(),
    [prefs, setPrefs] = useState<Preferences>(),
    [error, setError] = useState('');
  useEffect(() => {
    myShiftContext(db, staff.companyId, staff.employee.id)
      .then(setShift)
      .catch((e) => setError(friendlyError(e, t)));
    loadPreferences(db, staff.companyId, staff.uid)
      .then(setPrefs)
      .catch(() => undefined);
  }, [db, staff, t]);
  const today = todayIn(staff.timeZone);
  return (
    <div className="s-page">
      <section className="s-hero small">
        <div className="s-avatar">{staff.employee.name.slice(0, 1)}</div>
        <h1>{staff.employee.name}</h1>
        <p className="s-hero-sub">
          {staffRoleLabels[staff.role] || staff.role}
        </p>
      </section>
      {error && <ErrorBox error={error} />}
      <dl className="s-facts">
        <div className="s-fact">
          <dt>{t('employeeId')}</dt>
          <dd>{staff.employee.code}</dd>
        </div>
        <div className="s-fact">
          <dt>{t('company')}</dt>
          <dd>{staff.companyName}</dd>
        </div>
        <div className="s-fact wide">
          <dt>{t('sites')}</dt>
          <dd>
            {staff.link.allSites
              ? t('allSites')
              : staff.link.siteIds.map((s, i) => (
                  <span key={s}>
                    {i ? ', ' : ''}
                    <Label context={staff.context} kind="sites" id={s} />
                  </span>
                ))}
          </dd>
        </div>
      </dl>
      <section className="s-panel">
        <h2>
          <Clock3 size={18} /> {t('myShift')}
        </h2>
        {!shift ? (
          <Loading />
        ) : !shift.shifts.length ? (
          <p className="muted">{t('noShift')}</p>
        ) : (
          shift.shifts.map((s) => {
            const a = shift.assignments.find((x) => x.shiftId === s.id);
            return (
              <div key={s.id} className="s-shift-card">
                <strong>{s.name}</strong>
                <span>
                  {s.startTime}–{s.endTime}{' '}
                  {s.breakMinutes ? `· break ${s.breakMinutes} min` : ''}
                </span>
                <span>
                  {t('workingDays')}: {s.workingDays || 'Every day'}
                </span>
                {s.siteId && (
                  <span>
                    <Building2 size={14} />{' '}
                    <Label context={staff.context} kind="sites" id={s.siteId} />
                  </span>
                )}
                {a && (
                  <span className="small muted">
                    {a.startDate || '—'} → {a.endDate || 'ongoing'}
                  </span>
                )}
              </div>
            );
          })
        )}
        {shift && (
          <>
            <h3>
              <CalendarOff size={16} /> {t('upcomingLeave')}
            </h3>
            {shift.leave.filter((l) => (l.endDate || l.startDate) >= today)
              .length ? (
              <ul className="s-plain">
                {shift.leave
                  .filter((l) => (l.endDate || l.startDate) >= today)
                  .map((l, i) => (
                    <li key={i}>
                      {l.leaveType}: {l.startDate} → {l.endDate || l.startDate}{' '}
                      <Pill tone={l.status === 'planned' ? 'gray' : 'green'}>
                        {l.status}
                      </Pill>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="small muted">—</p>
            )}
          </>
        )}
        <p className="small muted">{t('attendanceNote')}</p>
      </section>
      <section className="s-panel">
        <h2>
          <Globe size={18} /> {t('language')}
        </h2>
        <div className="s-langs" role="radiogroup" aria-label={t('language')}>
          {languages.map((l) => (
            <button
              key={l.code}
              role="radio"
              aria-checked={lang === l.code}
              className="s-lang"
              onClick={() => setLang(l.code)}
              lang={l.code}
            >
              <strong>{l.label}</strong>
              {!l.complete && (
                <span className="small muted">
                  {t('preview')} · {coverage(l.code)}%
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
      {prefs && (
        <section className="s-panel">
          <h2>
            <Bell size={18} /> {t('notifications')}
          </h2>
          <div className="s-toggles">
            {staffTypes.map((k) => (
              <label key={k} className="toggle">
                <input
                  type="checkbox"
                  role="switch"
                  checked={prefs.inApp[k] !== false}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      inApp: { ...prefs.inApp, [k]: e.target.checked },
                    })
                  }
                />
                {notificationLabels[k]}
              </label>
            ))}
          </div>
          <button
            className="btn btn-outline btn-lg"
            onClick={async () => {
              try {
                await savePreferences(db, staff.companyId, staff.uid, prefs);
                toast(t('saved'));
              } catch (e) {
                setError(friendlyError(e, t));
              }
            }}
          >
            {t('saveProgress').split(' ')[0]}
          </button>
          <p className="small muted">
            Email and push delivery are not connected yet; notifications appear
            here in the app.
          </p>
        </section>
      )}
      {staff.companies.length > 1 && (
        <section className="s-panel">
          <h2>{t('company')}</h2>
          <select
            className="select"
            aria-label={t('company')}
            value={staff.companyId}
            onChange={(e) => staff.switchTo(e.target.value)}
          >
            {staff.companies.map((c) => (
              <option key={c} value={c}>
                {c === staff.companyId ? staff.companyName : c}
              </option>
            ))}
          </select>
        </section>
      )}
      <button
        className="btn btn-outline btn-lg btn-block"
        onClick={() => void signOut(staff.context.services.auth)}
      >
        <LogOut /> {t('signOut')}
      </button>
    </div>
  );
}
