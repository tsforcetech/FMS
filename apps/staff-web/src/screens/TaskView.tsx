import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Megaphone,
  Pause,
  Play,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Undo2,
} from 'lucide-react';
import {
  evaluateAnswer,
  evaluateSubmission,
  visibleQuestions,
  deferredAnswerTypes,
} from '@facilityos/shared';
import {
  getTask,
  reviewTask,
  saveProgress,
  submitTask,
  transitionTask,
  type Task,
} from '@admin/management/tasksStore';
import {
  staffApproval,
  staffSubmission,
  staffTaskEvents,
} from '@admin/management/staffStore';
import { ChecklistForm } from '@admin/management/Checklist';
import { Pill, useToast } from '@admin/ui/kit';
import { useStaff } from '../App';
import { useT } from '../i18n';
import {
  ErrorBox,
  Label,
  Loading,
  StatusPill,
  fmtDateTime,
  friendlyError,
  startOf,
} from './common';

type Mode = 'details' | 'run' | 'review';
export function TaskView() {
  const { id = '' } = useParams();
  const staff = useStaff();
  const { t } = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const db = staff.context.services.db,
    c = staff.companyId,
    tz = staff.timeZone;
  const [task, setTask] = useState<Task | null>(),
    [mode, setMode] = useState<Mode>('details'),
    [step, setStep] = useState(0),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [dirty, setDirty] = useState(false),
    [remarks, setRemarks] = useState(''),
    [showErrors, setShowErrors] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [events, setEvents] = useState<
      (Record<string, unknown> & { id: string })[]
    >([]),
    [decision, setDecision] = useState<{
      decision: string;
      reason: string;
    } | null>(null),
    [previous, setPrevious] = useState<Record<string, string> | null>(null),
    [reviewReason, setReviewReason] = useState('');
  const reload = useCallback(async () => {
    try {
      const x = await getTask(db, c, id);
      setTask(x);
      if (x) {
        setAnswers(x.draftAnswers || {});
        setDirty(false);
        staffTaskEvents(db, c, x)
          .then(setEvents)
          .catch(() => setEvents([]));
        const decided =
          x.status === 'rework_required' || x.status === 'rejected'
            ? x.attempt
            : x.attempt - 1;
        if (decided >= 1) {
          staffApproval(db, c, x.id, decided)
            .then(setDecision)
            .catch(() => setDecision(null));
          staffSubmission(db, c, x.id, decided)
            .then((s) =>
              setPrevious((s?.answers as Record<string, string>) || null),
            )
            .catch(() => setPrevious(null));
        }
      }
    } catch (e) {
      setError(friendlyError(e, t));
      setTask(null);
    }
  }, [db, c, id, t]);
  useEffect(() => {
    void reload();
  }, [reload]);
  // Warn before closing the tab with unsaved answers.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
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
  if (task === undefined) return <Loading />;
  if (!task || !content)
    return (
      <div className="s-page">
        <ErrorBox error={error || t('permissionError')} />
        <Link to="/tasks" className="btn btn-outline btn-lg">
          {t('back')}
        </Link>
      </div>
    );
  const mine = task.assigneeIds.includes(staff.employee.id);
  const inScope =
    staff.link.allSites || staff.link.siteIds.includes(task.siteId);
  const canWork = mine && inScope;
  const canReview =
    staff.supervisor && inScope && task.status === 'awaiting_approval';
  async function act(fn: () => Promise<unknown>, done?: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
      if (done) toast(done);
      await reload();
      return true;
    } catch (e) {
      setError(friendlyError(e, t));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const leave = (to: () => void) => {
    if (dirty && !window.confirm(t('leaveWarning'))) return;
    to();
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
  const evaluation = evaluateSubmission(content, answers);

  /* ---------------------------------------------------------- run mode */
  if (mode !== 'details' && task.status === 'in_progress' && canWork) {
    const reviewStep = mode === 'review';
    return (
      <div className="s-page s-run">
        <div className="s-run-head">
          <button
            type="button"
            className="icon-btn"
            aria-label={t('back')}
            onClick={() => leave(() => setMode('details'))}
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
          {dirty && <Pill tone="amber">{t('unsaved')}</Pill>}
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
              onChange={(a) => {
                setAnswers(a);
                setDirty(true);
              }}
            />
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
                disabled={busy || !dirty}
                onClick={() =>
                  void act(
                    () => saveProgress(db, c, staff.uid, task, answers),
                    t('saved'),
                  )
                }
              >
                <Save /> {t('saveProgress')}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => {
                  if (stepErrors(step).length) {
                    setShowErrors(true);
                    setError(t('fixErrors'));
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
                error={`${t('fixErrors')} (${Object.keys(evaluation.errors).length})`}
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
                      {deferredAnswerTypes.includes(q.type)
                        ? 'Pending (mobile app)'
                        : (answers[q.id] || '—').replaceAll('|', ', ')}
                    </strong>
                    {r.exception && <em>{r.exception.reason}</em>}
                    {r.error && <em>{r.error}</em>}
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
              <p className="small muted">{t('evidencePending')}</p>
            )}
            <label htmlFor="s-remarks">{t('remarks')}</label>
            <textarea
              id="s-remarks"
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
                  const ok = await act(
                    () => submitTask(db, c, staff.uid, task, answers, remarks),
                    task.approvalRequired ? t('submitted') : t('completedMsg'),
                  );
                  if (ok) {
                    setMode('details');
                    setDirty(false);
                  }
                }}
              >
                <Send />{' '}
                {busy
                  ? '…'
                  : task.approvalRequired
                    ? t('submitForApproval')
                    : t('markCompleted')}
              </button>
            </div>
          </section>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------- details */
  return (
    <div className="s-page">
      <button
        type="button"
        className="link-btn s-back"
        onClick={() => leave(() => navigate(-1))}
      >
        <ArrowLeft size={16} /> {t('back')}
      </button>
      <header className="s-task-head">
        <div className="s-card-top">
          <StatusPill s={task.status} />
          <Pill
            tone={
              task.priority === 'critical'
                ? 'red'
                : task.priority === 'high'
                  ? 'amber'
                  : 'gray'
            }
          >
            {task.priority[0].toUpperCase() + task.priority.slice(1)}
          </Pill>
          <span className="code-chip">{task.reference}</span>
        </div>
        <h1>{task.title}</h1>
      </header>
      {error && <ErrorBox error={error} onRetry={() => void reload()} />}
      {task.status === 'rework_required' && (
        <section className="s-banner rework" role="status">
          <strong>
            <RotateCcw size={16} /> {t('workReturned')}
          </strong>
          {decision?.reason && (
            <p>
              {t('reworkReason')}: <em>{decision.reason}</em>
            </p>
          )}
        </section>
      )}
      {task.status === 'rejected' && decision?.reason && (
        <section className="s-banner rework" role="status">
          <strong>Rejected</strong>
          <p>{decision.reason}</p>
        </section>
      )}
      <div className="s-actions">
        {canWork && task.status === 'assigned' && (
          <button
            className="btn btn-primary btn-lg"
            disabled={busy}
            onClick={() =>
              void act(() =>
                transitionTask(db, c, staff.uid, task, 'start'),
              ).then((ok) => ok && setMode('run'))
            }
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
              onClick={() =>
                leave(
                  () =>
                    void act(() =>
                      transitionTask(db, c, staff.uid, task, 'pause'),
                    ),
                )
              }
            >
              <Pause /> {t('pause')}
            </button>
          </>
        )}
        {canWork && task.status === 'paused' && (
          <button
            className="btn btn-primary btn-lg"
            disabled={busy}
            onClick={() =>
              void act(() =>
                transitionTask(db, c, staff.uid, task, 'resume'),
              ).then((ok) => ok && setMode('run'))
            }
          >
            <Play /> {t('resume')}
          </button>
        )}
        {canWork && task.status === 'rework_required' && (
          <button
            className="btn btn-primary btn-lg"
            disabled={busy}
            onClick={() =>
              void act(() =>
                transitionTask(db, c, staff.uid, task, 'restart'),
              ).then((ok) => ok && setMode('run'))
            }
          >
            <Undo2 /> {t('restart')}
          </button>
        )}
        {canWork &&
          ['assigned', 'in_progress', 'paused', 'rework_required'].includes(
            task.status,
          ) && (
            <Link
              className="btn btn-outline btn-lg"
              to={`/report?task=${task.id}`}
            >
              <Megaphone /> {t('reportProblem')}
            </Link>
          )}
        {mine && !inScope && (
          <p className="small muted">{t('permissionError')}</p>
        )}
      </div>
      {canReview && (
        <section className="s-panel">
          <h2>
            <ShieldCheck size={18} /> {t('approvals')}
          </h2>
          <label htmlFor="s-review-reason">{t('reason')}</label>
          <textarea
            id="s-review-reason"
            className="input"
            rows={3}
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
          />
          <div className="s-actions">
            <button
              className="btn btn-primary btn-lg"
              disabled={busy}
              onClick={() =>
                void act(
                  () =>
                    reviewTask(db, c, staff.uid, task, 'approve', reviewReason),
                  t('approve'),
                )
              }
            >
              <ThumbsUp /> {t('approve')}
            </button>
            <button
              className="btn btn-outline btn-lg"
              disabled={busy}
              onClick={() =>
                void act(
                  () =>
                    reviewTask(
                      db,
                      c,
                      staff.uid,
                      task,
                      'request_rework',
                      reviewReason,
                    ),
                  t('requestRework'),
                )
              }
            >
              <RotateCcw /> {t('requestRework')}
            </button>
            <button
              className="btn btn-danger btn-lg"
              disabled={busy}
              onClick={() =>
                void act(
                  () =>
                    reviewTask(db, c, staff.uid, task, 'reject', reviewReason),
                  t('reject'),
                )
              }
            >
              <ThumbsDown /> {t('reject')}
            </button>
          </div>
        </section>
      )}
      <dl className="s-facts">
        <Fact label={t('site')}>
          <Label context={staff.context} kind="sites" id={task.siteId} />
        </Fact>
        {task.locationId && (
          <Fact label={t('location')}>
            <Label
              context={staff.context}
              kind="locations"
              id={task.locationId}
            />
          </Fact>
        )}
        {(task.assetId || task.facilityId) && (
          <Fact label={t('asset')}>
            <Label
              context={staff.context}
              kind={task.assetId ? 'assets' : 'facilities'}
              id={task.assetId || task.facilityId}
            />
          </Fact>
        )}
        <Fact label={t('scheduled')}>{fmtDateTime(startOf(task), tz)}</Fact>
        <Fact label={t('due')}>{fmtDateTime(task.dueAt.toDate(), tz)}</Fact>
        <Fact label={t('responsible')}>
          {mine ? (
            staff.employee.name
          ) : task.assigneeIds.length ? (
            <Label
              context={staff.context}
              kind="employees"
              id={task.assigneeIds[0]}
            />
          ) : (
            '—'
          )}
        </Fact>
        <Fact label={t('checklist')}>
          {t('questions', { n: content.questions.length })} ·{' '}
          {t('duration', { n: content.estimatedMinutes })}
        </Fact>
      </dl>
      {content.instructions && (
        <section className="s-panel">
          <h2>{t('instructions')}</h2>
          <p className="s-pre">{content.instructions}</p>
        </section>
      )}
      <section className="s-panel">
        <h2>
          {task.status === 'rework_required' && previous
            ? t('previousAnswers')
            : t('checklist')}
        </h2>
        <ChecklistForm
          content={content}
          answers={
            task.status === 'in_progress'
              ? answers
              : previous || task.draftAnswers || {}
          }
          disabled
        />
      </section>
      <section className="s-panel">
        <h2>{t('timeline')}</h2>
        <ol className="s-timeline">
          {events.map((e) => (
            <li key={e.id}>
              <strong>{String(e.action).replaceAll('_', ' ')}</strong>
              <span className="small muted">
                {' '}
                {e.at
                  ? fmtDateTime((e.at as { toDate: () => Date }).toDate(), tz)
                  : ''}{' '}
                · {e.actorUid === staff.uid ? 'You' : 'Supervisor'}
              </span>
              {e.note ? <div className="small">{String(e.note)}</div> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="s-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
