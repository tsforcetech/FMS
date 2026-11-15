import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Megaphone,
} from 'lucide-react';
import { problemCategories } from '@facilityos/shared';
import {
  getTask,
  reportException,
  type Task,
  type TaskException,
} from '@admin/management/tasksStore';
import {
  createCase,
  emptyCase,
  getCase,
  type CaseRecord,
} from '@admin/management/casesStore';
import { myReportedIssues, myWorkOrders } from '@admin/management/staffStore';
import { Pill } from '@admin/ui/kit';
import { useStaff, useOnline } from '../App';
import { useT } from '../i18n';
import {
  Empty,
  ErrorBox,
  Label,
  Loading,
  fmtDateTime,
  friendlyError,
} from './common';

type Option = { id: string; name: string };
/** Sites the staff member may use, from their trusted scope. */
export function useScopeSites() {
  const staff = useStaff();
  const [sites, setSites] = useState<Option[]>([]);
  useEffect(() => {
    let live = true;
    const db = staff.context.services.db,
      c = staff.companyId;
    const load = staff.link.allSites
      ? getDocs(
          query(
            collection(db, 'companies', c, 'sites'),
            where('status', '==', 'active'),
            limit(100),
          ),
        ).then((r) =>
          r.docs.map((d) => ({ id: d.id, name: d.data().name as string })),
        )
      : Promise.all(
          staff.link.siteIds.map((id) =>
            getDoc(doc(db, 'companies', c, 'sites', id)).then((s) =>
              s.exists() ? { id, name: s.data().name as string } : null,
            ),
          ),
        ).then((x) => x.filter(Boolean) as Option[]);
    load.then((x) => live && setSites(x)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [staff]);
  return sites;
}
function useChildren(kind: 'locations' | 'assets', siteId: string) {
  const staff = useStaff();
  const [rows, setRows] = useState<Option[]>([]);
  useEffect(() => {
    let live = true;
    if (!siteId) return;
    getDocs(
      query(
        collection(
          staff.context.services.db,
          'companies',
          staff.companyId,
          kind,
        ),
        where('siteId', '==', siteId),
        limit(200),
      ),
    )
      .then(
        (r) =>
          live &&
          setRows(
            r.docs
              .filter((d) => d.data().status !== 'archived')
              .map((d) => ({ id: d.id, name: d.data().name as string })),
          ),
      )
      .catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [staff, kind, siteId]);
  return siteId ? rows : [];
}

export function ReportIssue() {
  const staff = useStaff();
  const { t } = useT();
  const online = useOnline();
  const [params] = useSearchParams();
  const taskId = params.get('task') || '';
  const db = staff.context.services.db,
    c = staff.companyId;
  // Generated once per form: a retried send reuses the same IDs, so nothing is duplicated.
  const formId = useMemo(
    () => doc(collection(db, 'companies', c, 'taskExceptions')).id,
    [db, c],
  );
  const [task, setTask] = useState<Task | null>(),
    [v, setV] = useState({
      category: '',
      severity: 'warning' as 'warning' | 'critical',
      description: '',
      questionId: '',
      siteId: '',
      locationId: '',
      assetId: '',
      workOrder: true,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState<{ ref: string; wo?: string } | null>(null);
  useEffect(() => {
    if (!taskId) return setTask(null);
    getTask(db, c, taskId)
      .then((x) => setTask(x))
      .catch(() => setTask(null));
  }, [db, c, taskId]);
  const sites = useScopeSites();
  const siteId = task
    ? task.siteId
    : v.siteId || (sites.length === 1 ? sites[0].id : '');
  const locations = useChildren('locations', task ? '' : siteId);
  const assets = useChildren('assets', task ? '' : siteId);
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  async function send() {
    if (busy) return;
    if (!v.category) return setError(t('category'));
    if (!v.description.trim()) return setError(t('description'));
    if (!siteId) return setError(t('site'));
    setBusy(true);
    setError('');
    try {
      const title = `${v.category}: ${v.description.trim()}`.slice(0, 160);
      if (task) {
        const exId = await reportException(
          db,
          c,
          staff.uid,
          task,
          {
            type: v.category,
            severity: v.severity,
            description: v.description,
            questionId: v.questionId,
          },
          formId,
        );
        let wo: string | undefined;
        if (v.workOrder) {
          const r = await createCase(db, c, staff.uid, 'workOrders', {
            ...emptyCase('workOrders'),
            title,
            description: v.description.trim(),
            priority: v.severity === 'critical' ? 'high' : 'medium',
            severity: v.severity === 'critical' ? 'high' : 'medium',
            category: v.category,
            siteId: task.siteId,
            locationId: task.locationId,
            facilityId: task.facilityId,
            assetId: task.assetId,
            departmentId: task.departmentId,
            sourceType: 'task_exception',
            sourceId: exId,
            reportedBy: staff.employee.name,
          });
          wo = (await getCase(db, c, 'workOrders', r.id))?.number;
        }
        setDone({ ref: exId.slice(0, 8).toUpperCase(), wo });
      } else {
        const r = await createCase(db, c, staff.uid, 'workOrders', {
          ...emptyCase('workOrders'),
          title,
          description: v.description.trim(),
          priority: v.severity === 'critical' ? 'high' : 'medium',
          severity: v.severity === 'critical' ? 'high' : 'medium',
          category: v.category,
          siteId,
          locationId: v.locationId,
          assetId: v.assetId,
          sourceType: 'staff',
          sourceId: formId,
          reportedBy: staff.employee.name,
        });
        const number =
          (await getCase(db, c, 'workOrders', r.id))?.number ||
          r.id.slice(0, 8);
        setDone({ ref: number, wo: number });
      }
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="s-page s-done" role="status">
        <CheckCircle2 size={56} />
        <h1>{t('reported')}</h1>
        <p>
          {t('referenceNo')}:{' '}
          <strong className="code-chip">{done.wo || done.ref}</strong>
        </p>
        <div className="s-actions">
          {task && (
            <Link className="btn btn-primary btn-lg" to={`/task/${task.id}`}>
              {t('continueTask')}
            </Link>
          )}
          <Link className="btn btn-outline btn-lg" to="/issues">
            {t('myIssues')}
          </Link>
        </div>
      </div>
    );
  if (taskId && task === undefined) return <Loading />;
  return (
    <div className="s-page">
      <h1 className="s-title">
        <Megaphone /> {t('issueTitle')}
      </h1>
      <p className="muted">{t('issueHelp')}</p>
      {error && <ErrorBox error={error} />}
      <form
        className="s-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {task ? (
          <div className="s-carry">
            <span>{t('relatedTask')}</span>
            <strong>{task.title}</strong>
            <span className="small muted">
              <Label context={staff.context} kind="sites" id={task.siteId} />
              {task.locationId && (
                <>
                  {' · '}
                  <Label
                    context={staff.context}
                    kind="locations"
                    id={task.locationId}
                  />
                </>
              )}
            </span>
          </div>
        ) : (
          <>
            <label htmlFor="r-site">{t('site')}</label>
            <select
              id="r-site"
              className="select"
              value={siteId}
              onChange={(e) =>
                set({ siteId: e.target.value, locationId: '', assetId: '' })
              }
            >
              <option value="">—</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label htmlFor="r-location">{t('location')}</label>
            <select
              id="r-location"
              className="select"
              value={v.locationId}
              disabled={!siteId}
              onChange={(e) => set({ locationId: e.target.value })}
            >
              <option value="">—</option>
              {locations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label htmlFor="r-asset">{t('asset')}</label>
            <select
              id="r-asset"
              className="select"
              value={v.assetId}
              disabled={!siteId}
              onChange={(e) => set({ assetId: e.target.value })}
            >
              <option value="">—</option>
              {assets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </>
        )}
        <fieldset className="s-choice">
          <legend>{t('category')}</legend>
          <div className="s-chips">
            {problemCategories.map((p) => (
              <button
                type="button"
                key={p}
                className="chip-toggle"
                aria-pressed={v.category === p}
                onClick={() => set({ category: p })}
              >
                {p}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="s-choice">
          <legend>{t('severity')}</legend>
          <div className="s-seg">
            <button
              type="button"
              aria-pressed={v.severity === 'warning'}
              onClick={() => set({ severity: 'warning' })}
            >
              {t('warning')}
            </button>
            <button
              type="button"
              className="danger"
              aria-pressed={v.severity === 'critical'}
              onClick={() => set({ severity: 'critical' })}
            >
              <AlertTriangle size={16} /> {t('critical')}
            </button>
          </div>
        </fieldset>
        <label htmlFor="r-desc">{t('description')}</label>
        <textarea
          id="r-desc"
          className="input"
          rows={4}
          maxLength={1000}
          value={v.description}
          onChange={(e) => set({ description: e.target.value })}
        />
        {task && task.content.questions.length > 0 && (
          <>
            <label htmlFor="r-q">{t('checklist')}</label>
            <select
              id="r-q"
              className="select"
              value={v.questionId}
              onChange={(e) => set({ questionId: e.target.value })}
            >
              <option value="">—</option>
              {task.content.questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
            <label className="toggle">
              <input
                type="checkbox"
                checked={v.workOrder}
                onChange={(e) => set({ workOrder: e.target.checked })}
              />
              {t('alsoWorkOrder')}
            </label>
          </>
        )}
        <p className="small muted">{t('evidencePending')}</p>
        <button
          className="btn btn-primary btn-lg btn-block"
          disabled={busy || !online}
        >
          {busy ? t('sending') : t('send')}
        </button>
      </form>
    </div>
  );
}

export function MyIssues() {
  const staff = useStaff();
  const { t } = useT();
  const [data, setData] = useState<{
      issues: TaskException[];
      wos: CaseRecord[];
    }>(),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const db = staff.context.services.db;
    Promise.all([
      myReportedIssues(db, staff.companyId, staff.uid),
      myWorkOrders(db, staff.companyId, staff, staff.uid),
    ])
      .then(
        ([issues, wos]) =>
          live &&
          setData({
            issues,
            wos: wos.filter((w) => w.createdBy === staff.uid),
          }),
      )
      .catch((e) => live && setError(friendlyError(e, t)));
    return () => {
      live = false;
    };
  }, [staff, t]);
  return (
    <div className="s-page">
      <h1 className="s-title">{t('myIssues')}</h1>
      <Link to="/report" className="btn btn-primary btn-lg btn-block">
        <Megaphone /> {t('reportProblem')}
      </Link>
      {error && <ErrorBox error={error} />}
      {!data && !error && <Loading />}
      {data && !data.issues.length && !data.wos.length && (
        <Empty icon={<CheckCircle2 />} title={t('noTasks')} />
      )}
      <div className="s-list">
        {data?.wos.map((w) => (
          <Link
            key={w.id}
            to={`/work-orders/${w.id}`}
            className="s-card simple"
          >
            <div className="s-card-top">
              <ClipboardList size={16} />{' '}
              <span className="code-chip">{w.number}</span>
              <Pill
                tone={
                  ['resolved', 'verified', 'closed'].includes(w.status)
                    ? 'green'
                    : 'blue'
                }
                dot
              >
                {w.status.replaceAll('_', ' ')}
              </Pill>
            </div>
            <h3>{w.title}</h3>
            <p className="s-meta">
              {w.createdAt
                ? fmtDateTime(w.createdAt.toDate(), staff.timeZone)
                : ''}
            </p>
          </Link>
        ))}
        {data?.issues.map((x) => (
          <Link key={x.id} to={`/task/${x.taskId}`} className="s-card simple">
            <div className="s-card-top">
              <AlertTriangle size={16} />{' '}
              <span className="code-chip">
                {x.id.slice(0, 8).toUpperCase()}
              </span>
              <Pill
                tone={
                  x.status === 'open'
                    ? 'red'
                    : x.status === 'acknowledged'
                      ? 'amber'
                      : 'green'
                }
                dot
              >
                {x.status}
              </Pill>
            </div>
            <h3>{x.type}</h3>
            <p className="s-meta">
              {x.description} ·{' '}
              {fmtDateTime(x.detectedAt.toDate(), staff.timeZone)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
