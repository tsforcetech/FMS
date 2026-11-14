import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  HandHelping,
  MessageSquarePlus,
} from 'lucide-react';
import {
  availableActions,
  caseDefinitions,
  slaState,
} from '@facilityos/shared';
import {
  getCase,
  transitionCase,
  type CaseRecord,
} from '@admin/management/casesStore';
import {
  myWorkOrders,
  reviewerUids,
  staffCaseEvents,
} from '@admin/management/staffStore';
import { notifySafely } from '@admin/management/notifyStore';
import { Pill, useToast } from '@admin/ui/kit';
import { useStaff } from '../App';
import { useT } from '../i18n';
import {
  Empty,
  ErrorBox,
  Label,
  Loading,
  fmtDateTime,
  friendlyError,
} from './common';

const staffActions = ['start', 'hold', 'resume', 'resolve', 'note'];
function WoStatus({ s }: { s: string }) {
  const tone =
    s === 'in_progress'
      ? 'violet'
      : s === 'on_hold'
        ? 'amber'
        : ['resolved', 'verified', 'closed'].includes(s)
          ? 'green'
          : s === 'cancelled'
            ? 'gray'
            : 'blue';
  return (
    <Pill tone={tone} dot>
      {s.replaceAll('_', ' ')}
    </Pill>
  );
}
export function WorkOrderList() {
  const staff = useStaff();
  const { t } = useT();
  const [rows, setRows] = useState<CaseRecord[]>(),
    [error, setError] = useState(''),
    [open, setOpen] = useState(true);
  useEffect(() => {
    let live = true;
    myWorkOrders(staff.context.services.db, staff.companyId, staff, staff.uid)
      .then((r) => live && setRows(r))
      .catch((e) => live && setError(friendlyError(e, t)));
    return () => {
      live = false;
    };
  }, [staff, t]);
  const shown = (rows || []).filter(
    (w) =>
      !open ||
      caseDefinitions.workOrders.open.includes(w.status) ||
      w.status === 'resolved',
  );
  return (
    <div className="s-page">
      <h1 className="s-title">{t('myWorkOrders')}</h1>
      <label className="toggle">
        <input
          type="checkbox"
          checked={open}
          onChange={(e) => setOpen(e.target.checked)}
        />{' '}
        {t('inProgress')} / {t('pending')}
      </label>
      {error && <ErrorBox error={error} />}
      {!rows && !error && <Loading />}
      {rows && !shown.length && (
        <Empty icon={<ClipboardList />} title={t('noWorkOrders')} />
      )}
      <div className="s-list">
        {shown.map((w) => (
          <Link
            key={w.id}
            to={`/work-orders/${w.id}`}
            className="s-card simple"
          >
            <div className="s-card-top">
              <span className="code-chip">{w.number}</span>
              <WoStatus s={w.status} />
              {w.priority === 'high' || w.priority === 'critical' ? (
                <Pill tone="red">{w.priority}</Pill>
              ) : null}
            </div>
            <h3>{w.title}</h3>
            <p className="s-meta">
              <Label context={staff.context} kind="sites" id={w.siteId} />
              {w.resolutionDueAt &&
                ` · ${t('due')} ${fmtDateTime(w.resolutionDueAt.toDate(), staff.timeZone)}`}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
export function WorkOrderView() {
  const { id = '' } = useParams();
  const staff = useStaff();
  const { t } = useT();
  const toast = useToast();
  const db = staff.context.services.db,
    c = staff.companyId;
  const [w, setW] = useState<CaseRecord | null>(),
    [events, setEvents] = useState<
      (Record<string, unknown> & { id: string })[]
    >([]),
    [action, setAction] = useState(''),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const x = await getCase(db, c, 'workOrders', id);
      setW(x);
      if (x) setEvents(await staffCaseEvents(db, c, x));
    } catch (e) {
      setError(friendlyError(e, t));
      setW(null);
    }
  }, [db, c, id, t]);
  useEffect(() => {
    void load();
  }, [load]);
  if (w === undefined) return <Loading />;
  if (!w)
    return (
      <div className="s-page">
        <ErrorBox error={error || t('permissionError')} />
      </div>
    );
  const assigned = w.assigneeIds.includes(staff.employee.id);
  const inScope = staff.link.allSites || staff.link.siteIds.includes(w.siteId);
  const actions = availableActions('workOrders', w.status).filter(
    (a) =>
      inScope &&
      (staff.supervisor || (assigned && staffActions.includes(a.id))),
  );
  const def =
    action === 'assist'
      ? caseDefinitions.workOrders.actions.note
      : caseDefinitions.workOrders.actions[action];
  async function run() {
    if (!action || busy) return;
    setBusy(true);
    setError('');
    try {
      const real = action === 'assist' ? 'note' : action;
      const text =
        action === 'assist' ? `Assistance requested: ${note.trim()}` : note;
      await transitionCase(db, c, staff.uid, w!, real, { note: text });
      if (action === 'assist' || action === 'resolve')
        await notifySafely(db, c, staff.uid, reviewerUids(db, c), {
          type: 'issue_updated',
          recordKind: 'workOrders',
          recordId: w!.id,
          eventKey: `r${w!.revision + 1}`,
          body: `${w!.number}: ${text}`.slice(0, 300),
        });
      toast(`${def?.label || action} — ${t('done')}`);
      setAction('');
      setNote('');
      await load();
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  }
  const sla = w.resolutionDueAt
    ? slaState(w.resolutionDueAt.toDate(), w.resolvedAt?.toDate() || null)
    : null;
  return (
    <div className="s-page">
      <Link to="/work-orders" className="link-btn s-back">
        <ArrowLeft size={16} /> {t('back')}
      </Link>
      <header className="s-task-head">
        <div className="s-card-top">
          <span className="code-chip">{w.number}</span>
          <WoStatus s={w.status} />
          {sla?.breached && <Pill tone="red">SLA</Pill>}
        </div>
        <h1>{w.title}</h1>
      </header>
      {error && <ErrorBox error={error} />}
      <div className="s-actions">
        {actions
          .filter((a) => a.id !== 'note')
          .map((a) => (
            <button
              key={a.id}
              className={
                'btn btn-lg ' +
                (a.id === 'resolve' || a.id === 'start'
                  ? 'btn-primary'
                  : 'btn-outline')
              }
              onClick={() => setAction(a.id)}
            >
              {a.label}
            </button>
          ))}
        {actions.some((a) => a.id === 'note') && (
          <>
            <button
              className="btn btn-outline btn-lg"
              onClick={() => setAction('note')}
            >
              <MessageSquarePlus /> {t('addUpdate')}
            </button>
            <button
              className="btn btn-outline btn-lg"
              onClick={() => setAction('assist')}
            >
              <HandHelping /> {t('requestAssistance')}
            </button>
          </>
        )}
      </div>
      {action && def && (
        <section className="s-panel" aria-live="polite">
          <h2>{action === 'assist' ? t('requestAssistance') : def.label}</h2>
          <label htmlFor="wo-note">
            {def.reason ? t('reason') : t('note')}
          </label>
          <textarea
            id="wo-note"
            className="input"
            rows={3}
            maxLength={900}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="s-actions">
            <button
              className="btn btn-outline btn-lg"
              onClick={() => setAction('')}
            >
              {t('cancel')}
            </button>
            <button
              className="btn btn-primary btn-lg"
              disabled={busy || (!!def.reason && !note.trim())}
              onClick={() => void run()}
            >
              {busy ? '…' : t('send')}
            </button>
          </div>
        </section>
      )}
      <dl className="s-facts">
        <div className="s-fact">
          <dt>{t('site')}</dt>
          <dd>
            <Label context={staff.context} kind="sites" id={w.siteId} />
          </dd>
        </div>
        {w.locationId && (
          <div className="s-fact">
            <dt>{t('location')}</dt>
            <dd>
              <Label
                context={staff.context}
                kind="locations"
                id={w.locationId}
              />
            </dd>
          </div>
        )}
        {w.assetId && (
          <div className="s-fact">
            <dt>{t('asset')}</dt>
            <dd>
              <Label context={staff.context} kind="assets" id={w.assetId} />
            </dd>
          </div>
        )}
        <div className="s-fact">
          <dt>{t('due')}</dt>
          <dd>
            {w.resolutionDueAt
              ? fmtDateTime(w.resolutionDueAt.toDate(), staff.timeZone)
              : '—'}
          </dd>
        </div>
        {w.description && (
          <div className="s-fact wide">
            <dt>{t('description')}</dt>
            <dd className="s-pre">{w.description}</dd>
          </div>
        )}
        {w.resolution && (
          <div className="s-fact wide">
            <dt>Resolution</dt>
            <dd className="s-pre">{w.resolution}</dd>
          </div>
        )}
      </dl>
      <p className="small muted">
        Materials are issued by the store/supervisor through the inventory
        ledger.
      </p>
      <section className="s-panel">
        <h2>{t('timeline')}</h2>
        <ol className="s-timeline">
          {events.map((e) => (
            <li key={e.id}>
              <strong>
                {caseDefinitions.workOrders.actions[String(e.action)]?.label ||
                  String(e.action)}
              </strong>
              <span className="small muted">
                {' '}
                {e.at
                  ? fmtDateTime(
                      (e.at as { toDate: () => Date }).toDate(),
                      staff.timeZone,
                    )
                  : ''}{' '}
                · {e.actorUid === staff.uid ? 'You' : 'Team'}
              </span>
              {e.note ? <div className="small">{String(e.note)}</div> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
