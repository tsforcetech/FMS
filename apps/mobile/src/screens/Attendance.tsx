import { useCallback, useEffect, useState } from 'react';
import { LogIn, LogOut, MapPin, UserCheck } from 'lucide-react';
import {
  accuracyLevel,
  attendanceId,
  lateMinutes,
  toLocal,
} from '@facilityos/shared';
import {
  checkIn,
  checkOut,
  getAttendance,
  myAttendance,
  type Attendance as Rec,
  type GeoReading,
} from '@admin/management/fieldStore';
import { myShiftContext } from '@admin/management/staffStore';
import { Pill, useToast } from '@admin/ui/kit';
import { useStaff } from '@staff/App';
import { useT } from '@staff/i18n';
import {
  ErrorBox,
  Label,
  Loading,
  fmtDateTime,
  friendlyError,
  todayIn,
} from '@staff/screens/common';
import { useMobile } from '../core';
import { getLocation, isNative } from '../platform';

/**
 * Check-in/out. The official time is the server's clock (request.time), so
 * attendance needs a connection; location is captured once per action with
 * its accuracy and only if the person allows it.
 */
export function Attendance() {
  const staff = useStaff();
  const m = useMobile();
  const { t } = useT();
  const toast = useToast();
  const db = staff.context.services.db,
    c = staff.companyId,
    tz = staff.timeZone;
  const date = todayIn(tz);
  const id = attendanceId(staff.employee.id, date);
  const [today, setToday] = useState<Rec | null>(),
    [history, setHistory] = useState<Rec[]>([]),
    [shift, setShift] = useState<{
      id: string;
      start: string;
      site: string;
    } | null>(null),
    [reading, setReading] = useState<GeoReading | null>(null),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const [a, h, ctx] = await Promise.all([
        getAttendance(db, c, id),
        myAttendance(db, c, staff.employee.id, 14),
        myShiftContext(db, c, staff.employee.id),
      ]);
      setToday(a);
      setHistory(h);
      const asg = ctx.assignments.find(
        (x) =>
          (!x.startDate || x.startDate <= date) &&
          (!x.endDate || x.endDate >= date),
      );
      const sh = asg && ctx.shifts.find((s) => s.id === asg.shiftId);
      setShift(sh ? { id: sh.id, start: sh.startTime, site: sh.siteId } : null);
    } catch (e) {
      setError(friendlyError(e, t));
      setToday(null);
    }
  }, [db, c, id, staff.employee.id, date, t]);
  useEffect(() => {
    if (m.state.online) void load();
  }, [m.state.online, load]);
  async function locate() {
    const r = await getLocation();
    if (r.ok) {
      setReading(r.reading);
      setNote('');
      return r.reading;
    }
    setNote(
      r.reason === 'denied'
        ? t('locationDenied')
        : 'Location could not be determined; continuing without it.',
    );
    return null;
  }
  async function act(kind: 'in' | 'out') {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const loc = await locate();
      if (kind === 'in') {
        const site =
          shift?.site &&
          (staff.link.allSites || staff.link.siteIds.includes(shift.site))
            ? shift.site
            : staff.employee.primarySiteId || staff.link.siteIds[0] || '';
        await checkIn(db, c, staff.uid, {
          employeeId: staff.employee.id,
          date,
          siteId: site,
          shiftId: shift?.id || '',
          lateMinutes: lateMinutes(
            shift?.start,
            toLocal(new Date(), tz).time,
            5,
          ),
          location: loc,
          source: isNative ? 'mobile' : 'web',
        });
        toast(t('checkIn'));
      } else {
        await checkOut(db, c, staff.uid, id, loc);
        toast(t('checkOut'));
      }
      await load();
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="s-page">
      <h1 className="s-title">
        <UserCheck /> {t('attendance')}
      </h1>
      {!m.state.online && <ErrorBox error={t('needsConnection')} />}
      {error && <ErrorBox error={error} />}
      {m.state.online && today === undefined && <Loading />}
      {today !== undefined && (
        <section className="s-panel m-att-panel">
          <p className="muted">
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: tz,
            })}
            {shift && ` · ${t('shiftToday')} ${shift.start}`}
          </p>
          {today ? (
            <>
              <p>
                <strong>{t('checkedInAt')}</strong>{' '}
                {fmtDateTime(today.checkInAt.toDate(), tz)}
                {today.lateMinutes > 0 && (
                  <Pill tone="amber">
                    {t('late', { n: today.lateMinutes })}
                  </Pill>
                )}
              </p>
              {today.checkOutAt && (
                <p>
                  <strong>{t('checkedOutAt')}</strong>{' '}
                  {fmtDateTime(today.checkOutAt.toDate(), tz)}
                </p>
              )}
              {today.correction && (
                <p className="small muted">
                  Corrected by a supervisor: {today.correction.reason}
                </p>
              )}
            </>
          ) : (
            <p className="muted">{t('checkIn')}?</p>
          )}
          {!today && (
            <button
              className="btn btn-primary btn-lg btn-block m-big"
              disabled={busy || !m.state.online}
              onClick={() => void act('in')}
            >
              <LogIn /> {busy ? '…' : t('checkIn')}
            </button>
          )}
          {today?.status === 'checked_in' && (
            <button
              className="btn btn-primary btn-lg btn-block m-big"
              disabled={busy || !m.state.online}
              onClick={() => void act('out')}
            >
              <LogOut /> {busy ? '…' : t('checkOut')}
            </button>
          )}
          {reading && (
            <p className="small" aria-live="polite">
              <MapPin size={14} /> {reading.lat.toFixed(5)},{' '}
              {reading.lng.toFixed(5)} ·{' '}
              {t('accuracy', { m: Math.round(reading.accuracy) })} (
              {accuracyLevel(reading.accuracy)})
            </p>
          )}
          {note && <p className="small muted">{note}</p>}
          <p className="small muted">
            {t('needsConnection')} GPS is approximate and is recorded only when
            you check in or out.
          </p>
        </section>
      )}
      {!!history.length && (
        <section className="s-panel">
          <h2>{t('history')}</h2>
          <ul className="m-att-list">
            {history.map((h) => (
              <li key={h.id}>
                <strong>{h.date}</strong>
                <span>
                  {toLocal(h.checkInAt.toDate(), tz).time} –{' '}
                  {h.checkOutAt ? toLocal(h.checkOutAt.toDate(), tz).time : '…'}
                </span>
                <Label context={staff.context} kind="sites" id={h.siteId} />
                <Pill
                  tone={
                    h.status === 'corrected'
                      ? 'violet'
                      : h.status === 'checked_in'
                        ? 'blue'
                        : 'green'
                  }
                >
                  {h.status.replace('_', ' ')}
                </Pill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
