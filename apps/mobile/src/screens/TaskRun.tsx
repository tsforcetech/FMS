import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardList,
  CloudOff,
  MapPin,
  Megaphone,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Undo2,
} from 'lucide-react';
import {
  accuracyLevel,
  deferredAnswerTypes,
  evaluateAnswer,
  evaluateSubmission,
  parseQr,
  visibleQuestions,
  type Question,
} from '@facilityos/shared';
import { getTask, reviewTask, type Task } from '@admin/management/tasksStore';
import { staffApproval } from '@admin/management/staffStore';
import { qrMatchesTask } from '@admin/management/fieldStore';
import { ChecklistForm } from '@admin/management/Checklist';
import { Pill, useToast } from '@admin/ui/kit';
import { useStaff } from '@staff/App';
import { useT } from '@staff/i18n';
import {
  ErrorBox,
  Label,
  Loading,
  StatusPill,
  fmtDateTime,
  friendlyError,
  startOf,
} from '@staff/screens/common';
import { newId, useMobile, vaultFor } from '../core';
import {
  getLocation,
  isNative,
  scanNative,
  takePhoto,
  uploader,
} from '../platform';
import { WebScanner } from './Scan';

type Mode = 'details' | 'run' | 'review';
type Ev = { qr?: string; gps?: string; photos?: string[] };
export function TaskRun() {
  const { id = '' } = useParams();
  const staff = useStaff();
  const m = useMobile();
  const { t } = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const tz = staff.timeZone;
  const cached = m.tasks.find((x) => x.id === id) || null;
  const [remote, setRemote] = useState<Task | null | undefined>(
    cached ? null : undefined,
  );
  const task = cached || remote || null;
  const [mode, setMode] = useState<Mode>('details'),
    [step, setStep] = useState(0),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [loadedDraft, setLoadedDraft] = useState(''),
    [remarks, setRemarks] = useState(''),
    [showErrors, setShowErrors] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ev, setEv] = useState<Record<string, Ev>>({}),
    [scanFor, setScanFor] = useState(''),
    [decision, setDecision] = useState<{ reason: string } | null>(null),
    [reviewReason, setReviewReason] = useState('');
  // Tasks not yet synchronized can be opened only online, straight from the server.
  useEffect(() => {
    if (cached || !m.state.online) return;
    getTask(staff.context.services.db, staff.companyId, id)
      .then((x) => setRemote(x))
      .catch(() => setRemote(null));
  }, [cached, m.state.online, staff, id]);
  // Local draft (encrypted on the device) takes precedence over the server draft.
  useEffect(() => {
    if (!task) return;
    const key = `${task.id}:${task.attempt}`;
    if (loadedDraft === key) return;
    void m.repo.draft(task.id, task.attempt).then((d) => {
      setAnswers(d || task.draftAnswers || {});
      setLoadedDraft(key);
    });
    if (task.status === 'rework_required' && m.state.online)
      staffApproval(
        staff.context.services.db,
        staff.companyId,
        task.id,
        task.attempt,
      )
        .then((x) => setDecision(x))
        .catch(() => undefined);
  }, [task, loadedDraft, m.repo, m.state.online, staff]);
  const save = useRef<ReturnType<typeof setTimeout>>(undefined);
  const change = (a: Record<string, string>) => {
    setAnswers(a);
    clearTimeout(save.current);
    if (task)
      save.current = setTimeout(
        () => void m.repo.saveDraft(task.id, task.attempt, a),
        300,
      );
  };
  const content = task?.content;
  const sections = useMemo(
    () =>
      content
        ? content.sections.filter((s) =>
            content.questions.some((q) => q.sectionId === s.id),
          )
        : [],
    [content],
  );
  if (task === null && (remote === undefined || (!cached && !m.state.online)))
    return remote === undefined && m.state.online ? (
      <Loading />
    ) : (
      <div className="s-page">
        <ErrorBox
          error={m.state.online ? t('permissionError') : t('offlineMode')}
        />
        <Link className="btn btn-outline btn-lg" to="/tasks">
          {t('back')}
        </Link>
      </div>
    );
  if (!task || !content) return <Loading />;
  const conflicts = m.ops.filter(
    (o) =>
      o.taskId === task.id &&
      ['conflict', 'failed', 'blocked'].includes(o.status),
  );
  const queued = m.ops.filter(
    (o) =>
      o.taskId === task.id &&
      (o.status === 'pending' || o.status === 'syncing'),
  ).length;
  const mine = task.assigneeIds.includes(staff.employee.id);
  const inScope =
    staff.link.allSites || staff.link.siteIds.includes(task.siteId);
  const canWork = mine && inScope && !conflicts.length;
  const act = async (type: 'start' | 'pause' | 'resume' | 'restart') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await m.enqueue({
        id: newId(),
        taskId: task.id,
        type,
        baseRevision: task.revision,
        payload: {},
      });
      if (!m.state.online) toast(t('queued'));
      if (type !== 'pause') setMode('run');
    } catch (e) {
      setError(friendlyError(e, t));
    } finally {
      setBusy(false);
    }
  };
  const sectionQs = (i: number) =>
    visibleQuestions({ ...content, sections: [sections[i]] }, answers).filter(
      (q) => q.sectionId === sections[i]?.id,
    );
  const stepErrors = (i: number) =>
    sectionQs(i).filter(
      (q) =>
        !deferredAnswerTypes.includes(q.type) &&
        evaluateAnswer(q, answers[q.id] ?? '').error,
    );
  const evidenceQs = (qs: Question[]) =>
    // Photo/QR/GPS question types render their controls inside the question;
    // other questions with an evidence requirement get a card below.
    qs.filter(
      (q) => !deferredAnswerTypes.includes(q.type) && q.evidence !== 'none',
    );
  const evaluation = evaluateSubmission(content, answers);

  /* ---------------------------------------------------------- evidence capture */
  async function capture(
    q: Question,
    kind: 'qr' | 'gps' | 'photo',
    phase: 'before' | 'after' = 'after',
    scanned?: string,
  ) {
    setError('');
    if (kind === 'qr') {
      let text = scanned;
      if (!text) {
        if (!isNative) return setScanFor(q.id);
        const r = await scanNative();
        if (!r.ok)
          return r.reason === 'cancelled'
            ? undefined
            : setError(
                r.reason === 'denied'
                  ? 'Camera permission is off.'
                  : 'QR scanning is not available on this device.',
              );
        text = r.text;
      }
      const target = parseQr(text);
      if (!target) return setError(t('invalidCode'));
      if (!qrMatchesTask(task!, target))
        return setError(
          'This code does not belong to this task’s asset or location.',
        );
      await m.enqueue({
        id: `ev_${task!.id}_${task!.attempt}_${q.id}`,
        taskId: task!.id,
        type: 'evidence',
        baseRevision: -1,
        payload: {
          kind: 'qr',
          questionId: q.id,
          attempt: task!.attempt,
          target,
          capturedAt: new Date().toISOString(),
        },
      });
      setEv((e) => ({ ...e, [q.id]: { ...e[q.id], qr: target.kind } }));
      if (q.type === 'qr')
        change({ ...answers, [q.id]: `verified:${target.kind}` });
      toast(t('verified'));
    } else if (kind === 'gps') {
      const r = await getLocation();
      if (!r.ok)
        return setError(
          r.reason === 'denied'
            ? t('locationDenied')
            : 'Location could not be determined. Try again in the open.',
        );
      const g = r.reading;
      await m.enqueue({
        id: `ev_${task!.id}_${task!.attempt}_${q.id}`,
        taskId: task!.id,
        type: 'evidence',
        baseRevision: -1,
        payload: {
          kind: 'gps',
          questionId: q.id,
          attempt: task!.attempt,
          location: { ...g, capturedAt: g.capturedAt.toISOString() },
        },
      });
      const text = `${g.lat.toFixed(5)},${g.lng.toFixed(5)} ±${Math.round(g.accuracy)}m`;
      setEv((e) => ({
        ...e,
        [q.id]: { ...e[q.id], gps: `${text} (${accuracyLevel(g.accuracy)})` },
      }));
      if (q.type === 'gps') change({ ...answers, [q.id]: text });
    } else {
      const r = await takePhoto();
      if (!r.ok)
        return r.reason === 'cancelled'
          ? undefined
          : setError(
              r.reason === 'denied'
                ? 'Camera permission is off.'
                : 'The camera is not available.',
            );
      const key = `c:${staff.companyId}:photo:${task!.id}:${task!.attempt}:${q.id}:${phase}`;
      await vaultFor(staff.uid).put(key, {
        ...r.photo,
        status: 'pending_activation',
      });
      setEv((e) => ({
        ...e,
        [q.id]: {
          ...e[q.id],
          photos: [...new Set([...(e[q.id]?.photos || []), phase])],
        },
      }));
      if (q.type === 'photo') change({ ...answers, [q.id]: 'photo:on-device' });
    }
  }
  const EvidenceCards = ({
    qs,
    inline,
  }: {
    qs: Question[];
    inline?: boolean;
  }) =>
    qs.length ? (
      <div className={'m-evidence' + (inline ? ' inline' : '')}>
        {qs.map((q) => {
          const kind =
            q.type === 'qr' || q.evidence === 'qr'
              ? 'qr'
              : q.type === 'gps' || q.evidence === 'gps'
                ? 'gps'
                : 'photo';
          const e = ev[q.id] || {};
          return (
            <div key={q.id} className="m-ev-card">
              <strong className="m-ev-title">
                {t('evidence')}: {q.label}
              </strong>
              {kind === 'qr' && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline btn-lg"
                    onClick={() => void capture(q, 'qr')}
                  >
                    <QrCode /> {t('scanQr')}
                  </button>
                  {(e.qr || answers[q.id]?.startsWith('verified')) && (
                    <Pill tone="green">
                      <CheckCircle2 size={14} /> {t('verified')}
                    </Pill>
                  )}
                </>
              )}
              {kind === 'gps' && (
                <>
                  <button
                    type="button"
                    className="btn btn-outline btn-lg"
                    onClick={() => void capture(q, 'gps')}
                  >
                    <MapPin /> {t('captureLocation')}
                  </button>
                  {(e.gps || (q.type === 'gps' && answers[q.id])) && (
                    <span className="small">{e.gps || answers[q.id]}</span>
                  )}
                </>
              )}
              {kind === 'photo' && (
                <>
                  <div className="m-ev-row">
                    <button
                      type="button"
                      className="btn btn-outline btn-lg"
                      onClick={() => void capture(q, 'photo', 'before')}
                    >
                      <Camera /> {t('before')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-lg"
                      onClick={() => void capture(q, 'photo', 'after')}
                    >
                      <Camera /> {t('after')}
                    </button>
                  </div>
                  {!!e.photos?.length && (
                    <span className="small">
                      {e.photos.join(' + ')} ·{' '}
                      {uploader.active ? t('syncPending') : t('photoPending')}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    ) : null;

  /* ---------------------------------------------------------- checklist */
  if (mode !== 'details' && task.status === 'in_progress' && canWork) {
    const reviewStep = mode === 'review';
    return (
      <div className="s-page s-run">
        <div className="s-run-head">
          <button
            type="button"
            className="icon-btn"
            aria-label={t('back')}
            onClick={() => setMode('details')}
          >
            <ArrowLeft />
          </button>
          <div>
            <strong>{task.title}</strong>
            <span>
              {reviewStep
                ? t('review')
                : t('stepOf', { a: step + 1, b: sections.length })}
            </span>
          </div>
          <Pill tone="gray">{t('savedOnDevice')}</Pill>
        </div>
        <div className="s-steps" aria-hidden>
          {sections.map((s, i) => (
            <span
              key={s.id}
              className={
                i < step || reviewStep ? 'done' : i === step ? 'on' : ''
              }
            />
          ))}
          <span className={reviewStep ? 'on' : ''} />
        </div>
        {error && <ErrorBox error={error} />}
        {!reviewStep ? (
          <>
            <ChecklistForm
              content={{
                questions: content.questions,
                sections: [sections[step]],
              }}
              answers={answers}
              showErrors={showErrors}
              onChange={change}
              renderEvidence={(q) => <EvidenceCards qs={[q]} inline />}
            />
            <EvidenceCards qs={evidenceQs(sectionQs(step))} />
            <div className="s-run-bar">
              <button
                type="button"
                className="btn btn-outline btn-lg"
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
              >
                {t('back')}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-lg"
                disabled={busy}
                onClick={async () => {
                  await m.enqueue({
                    id: newId(),
                    taskId: task.id,
                    type: 'save_progress',
                    baseRevision: task.revision,
                    payload: { answers },
                  });
                  toast(m.state.online ? t('saved') : t('queued'));
                }}
              >
                <Save /> {t('saveProgress')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => {
                  const bad = stepErrors(step);
                  if (bad.length) {
                    setShowErrors(true);
                    setError(
                      `${t('fixErrors')} ${bad.map((q) => `“${q.label}”`).join(', ')}`,
                    );
                    return;
                  }
                  setShowErrors(false);
                  setError('');
                  if (step + 1 < sections.length) setStep(step + 1);
                  else setMode('review');
                }}
              >
                {step + 1 < sections.length ? t('next') : t('review')}
              </button>
            </div>
          </>
        ) : (
          <section className="s-review">
            <h2>{t('review')}</h2>
            {Object.keys(evaluation.errors).length > 0 && (
              <ErrorBox
                error={`${t('fixErrors')} ${Object.keys(evaluation.errors)
                  .map(
                    (qid) =>
                      `“${content.questions.find((q) => q.id === qid)?.label}”`,
                  )
                  .join(', ')}`}
              />
            )}
            <ul className="s-answers">
              {visibleQuestions(content, answers).map((q) => {
                const r = evaluateAnswer(q, answers[q.id] ?? '');
                return (
                  <li
                    key={q.id}
                    className={r.error ? 'bad' : r.exception ? 'warn' : ''}
                  >
                    <span>{q.label}</span>
                    <strong>
                      {(answers[q.id] || '—').replaceAll('|', ', ')}
                    </strong>
                    {r.exception && <em>{r.exception.reason}</em>}
                  </li>
                );
              })}
            </ul>
            <h3>{t('failedChecks')}</h3>
            {evaluation.exceptions.length ? (
              <ul className="s-failed">
                {evaluation.exceptions.map((x) => (
                  <li key={x.questionId} className={x.severity}>
                    {
                      content.questions.find((q) => q.id === x.questionId)
                        ?.label
                    }
                    : {x.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="s-ok">
                <CheckCircle2 size={16} /> {t('noFailed')}
              </p>
            )}
            {evaluation.evidencePending.length > 0 && (
              <p className="small muted">{t('photoPending')}</p>
            )}
            <label htmlFor="m-remarks">{t('remarks')}</label>
            <textarea
              id="m-remarks"
              className="input"
              rows={3}
              maxLength={2000}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <div className="s-run-bar">
              <button
                type="button"
                className="btn btn-outline btn-lg"
                onClick={() => setMode('run')}
              >
                {t('back')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={busy || Object.keys(evaluation.errors).length > 0}
                onClick={async () => {
                  setBusy(true);
                  await m.enqueue({
                    id: newId(),
                    taskId: task.id,
                    type: 'submit',
                    baseRevision: task.revision,
                    payload: { answers, remarks },
                  });
                  await m.repo.clearDraft(task.id, task.attempt);
                  toast(
                    m.state.online
                      ? task.approvalRequired
                        ? t('submitted')
                        : t('completedMsg')
                      : t('queued'),
                  );
                  setBusy(false);
                  setMode('details');
                }}
              >
                <Send />{' '}
                {task.approvalRequired
                  ? t('submitForApproval')
                  : t('markCompleted')}
              </button>
            </div>
          </section>
        )}
        {scanFor && (
          <WebScanner
            onClose={() => setScanFor('')}
            onResult={(text) => {
              const q = content.questions.find((x) => x.id === scanFor)!;
              setScanFor('');
              void capture(q, 'qr', 'after', text);
            }}
          />
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------- details */
  const canReview =
    staff.supervisor &&
    inScope &&
    task.status === 'awaiting_approval' &&
    m.state.online;
  return (
    <div className="s-page">
      <button
        type="button"
        className="link-btn s-back"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={16} /> {t('back')}
      </button>
      <header className="s-task-head">
        <div className="s-card-top">
          <StatusPill s={task.status} />
          <span className="code-chip">{task.reference}</span>
          {queued > 0 && (
            <Pill tone="amber">
              <CloudOff size={13} /> {t('syncPending')}
            </Pill>
          )}
        </div>
        <h1>{task.title}</h1>
      </header>
      {conflicts.map((o) => (
        <div key={o.id} className="s-banner rework" role="alert">
          <strong>{t('conflicts')}</strong>
          <p>{o.lastError}</p>
          <p className="small">{t('conflictHelp')}</p>
          <Link to="/sync" className="btn btn-outline btn-sm">
            {t('syncCenter')}
          </Link>
        </div>
      ))}
      {task.status === 'rework_required' && (
        <section className="s-banner rework" role="status">
          <strong>
            <RotateCcw size={16} /> {t('workReturned')}
          </strong>
          {decision?.reason && <p>{decision.reason}</p>}
        </section>
      )}
      {error && <ErrorBox error={error} />}
      <div className="s-actions">
        {canWork && task.status === 'assigned' && (
          <button
            className="btn btn-primary btn-lg"
            disabled={busy}
            onClick={() => void act('start')}
          >
            <Play /> {t('start')}
          </button>
        )}
        {canWork && task.status === 'in_progress' && (
          <>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => {
                setStep(0);
                setMode('run');
              }}
            >
              <ClipboardList /> {t('continueTask')}
            </button>
            <button
              className="btn btn-outline btn-lg"
              disabled={busy}
              onClick={() => void act('pause')}
            >
              <Pause /> {t('pause')}
            </button>
          </>
        )}
        {canWork && task.status === 'paused' && (
          <button
            className="btn btn-primary btn-lg"
            disabled={busy}
            onClick={() => void act('resume')}
          >
            <Play /> {t('resume')}
          </button>
        )}
        {canWork && task.status === 'rework_required' && (
          <button
            className="btn btn-primary btn-lg"
            disabled={busy}
            onClick={() => void act('restart')}
          >
            <Undo2 /> {t('restart')}
          </button>
        )}
        {canWork &&
          ['in_progress', 'paused', 'assigned', 'rework_required'].includes(
            task.status,
          ) && (
            <Link
              className="btn btn-outline btn-lg"
              to={`/report-task/${task.id}`}
            >
              <Megaphone /> {t('reportProblem')}
            </Link>
          )}
      </div>
      {canReview && (
        <section className="s-panel">
          <h2>
            <ShieldCheck size={18} /> {t('approvals')}
          </h2>
          <label htmlFor="m-review">{t('reason')}</label>
          <textarea
            id="m-review"
            className="input"
            rows={3}
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
          />
          <div className="s-actions">
            {(['approve', 'request_rework', 'reject'] as const).map((d) => (
              <button
                key={d}
                className={
                  'btn btn-lg ' +
                  (d === 'approve'
                    ? 'btn-primary'
                    : d === 'reject'
                      ? 'btn-danger'
                      : 'btn-outline')
                }
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await reviewTask(
                      staff.context.services.db,
                      staff.companyId,
                      staff.uid,
                      (await getTask(
                        staff.context.services.db,
                        staff.companyId,
                        task.id,
                      ))!,
                      d,
                      reviewReason,
                    );
                    toast(
                      t(
                        d === 'approve'
                          ? 'approve'
                          : d === 'reject'
                            ? 'reject'
                            : 'requestRework',
                      ),
                    );
                    await m.syncNow();
                    setRemote(
                      await getTask(
                        staff.context.services.db,
                        staff.companyId,
                        task.id,
                      ),
                    );
                  } catch (e) {
                    setError(friendlyError(e, t));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {d === 'approve' ? (
                  <ThumbsUp />
                ) : d === 'reject' ? (
                  <ThumbsDown />
                ) : (
                  <RotateCcw />
                )}{' '}
                {t(
                  d === 'approve'
                    ? 'approve'
                    : d === 'reject'
                      ? 'reject'
                      : 'requestRework',
                )}
              </button>
            ))}
          </div>
        </section>
      )}
      <dl className="s-facts">
        <div className="s-fact">
          <dt>{t('site')}</dt>
          <dd>
            <Label context={staff.context} kind="sites" id={task.siteId} />
          </dd>
        </div>
        {task.locationId && (
          <div className="s-fact">
            <dt>{t('location')}</dt>
            <dd>
              <Label
                context={staff.context}
                kind="locations"
                id={task.locationId}
              />
            </dd>
          </div>
        )}
        {task.assetId && (
          <div className="s-fact">
            <dt>{t('asset')}</dt>
            <dd>
              <Label context={staff.context} kind="assets" id={task.assetId} />
            </dd>
          </div>
        )}
        <div className="s-fact">
          <dt>{t('scheduled')}</dt>
          <dd>{fmtDateTime(startOf(task), tz)}</dd>
        </div>
        <div className="s-fact">
          <dt>{t('due')}</dt>
          <dd>{fmtDateTime(task.dueAt.toDate(), tz)}</dd>
        </div>
        <div className="s-fact">
          <dt>{t('checklist')}</dt>
          <dd>
            {t('questions', { n: content.questions.length })} ·{' '}
            {t('duration', { n: content.estimatedMinutes })}
          </dd>
        </div>
      </dl>
      {content.instructions && (
        <section className="s-panel">
          <h2>{t('instructions')}</h2>
          <p className="s-pre">{content.instructions}</p>
        </section>
      )}
      <section className="s-panel">
        <h2>{t('checklist')}</h2>
        <ChecklistForm content={content} answers={answers} disabled />
      </section>
    </div>
  );
}
