import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  contentIssues,
  evaluateSubmission,
  transitions,
  taskReference,
  versionContentSchema,
  openStatuses,
  type AnswerException,
  type TaskAction,
  type TaskStatus,
  type VersionContent,
  type VersionState,
  type Priority,
} from '@facilityos/shared';
import { UserError } from './store';
import { adminUids, linkedUids, notifySafely } from './notifyStore';

export type TemplateVersion = {
  id: string;
  templateId: string;
  version: number;
  state: VersionState;
  content: VersionContent;
  revision: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt: Timestamp | null;
  publishedBy: string;
};
export type Task = {
  id: string;
  reference: string;
  title: string;
  templateId: string;
  versionId: string;
  version: number;
  content: VersionContent;
  approvalRequired: boolean;
  priority: Priority;
  siteId: string;
  locationId: string;
  facilityId: string;
  assetId: string;
  departmentId: string;
  assigneeIds: string[];
  teamId: string;
  notes: string;
  plannedStart: Timestamp | null;
  dueAt: Timestamp;
  status: TaskStatus;
  attempt: number;
  draftAnswers: Record<string, string>;
  occurrenceKey: string;
  scheduleId?: string;
  origin?: 'manual' | 'schedule' | 'maintenance';
  cancelReason: string;
  exceptionCount: number;
  evidencePending: boolean;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  revision: number;
};
export type TaskEvent = {
  id: string;
  taskId: string;
  revision: number;
  action: TaskAction;
  fromStatus: string;
  toStatus: TaskStatus;
  actorUid: string;
  at: Timestamp;
  note: string;
  assigneeIds: string[];
  attempt: number;
};
export type Submission = {
  id: string;
  taskId: string;
  attempt: number;
  versionId: string;
  answers: Record<string, string>;
  exceptions: AnswerException[];
  evidencePending: string[];
  remarks: string;
  submittedBy: string;
  submittedAt: Timestamp;
};
export type Approval = {
  id: string;
  taskId: string;
  attempt: number;
  decision: 'approve' | 'request_rework' | 'reject';
  reason: string;
  reviewerUid: string;
  decidedAt: Timestamp;
};
export type TaskException = {
  id: string;
  taskId: string;
  attempt: number;
  questionId: string;
  siteId: string;
  locationId: string;
  assetId: string;
  facilityId: string;
  type: string;
  severity: 'warning' | 'critical';
  description: string;
  detectedBy: string;
  detectedAt: Timestamp;
  status: 'open' | 'acknowledged' | 'closed';
  resolutionNote: string;
  revision: number;
};
const col = (db: Firestore, c: string, name: string) =>
  collection(db, 'companies', c, name);
const ref = (db: Firestore, c: string, name: string, id: string) =>
  doc(db, 'companies', c, name, id);
export const PAGE = 20;

/* ================================================================ versions */
export async function listVersions(
  db: Firestore,
  c: string,
  templateId: string,
) {
  const r = await getDocs(
    query(
      col(db, c, 'templateVersions'),
      where('templateId', '==', templateId),
      orderBy('version', 'desc'),
      limit(50),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as TemplateVersion);
}
export async function latestPublished(
  db: Firestore,
  c: string,
  templateId: string,
) {
  const r = await getDocs(
    query(
      col(db, c, 'templateVersions'),
      where('templateId', '==', templateId),
      where('state', '==', 'published'),
      orderBy('version', 'desc'),
      limit(1),
    ),
  );
  return r.docs[0]
    ? ({ id: r.docs[0].id, ...r.docs[0].data() } as TemplateVersion)
    : null;
}
/** Creates the next draft version, optionally copying content from another version. */
export async function createDraft(
  db: Firestore,
  c: string,
  uid: string,
  templateId: string,
  content: VersionContent,
) {
  const existing = await listVersions(db, c, templateId);
  if (existing.some((v) => v.state === 'draft'))
    throw new UserError(
      'This template already has a draft. Edit or publish it first.',
    );
  const version = (existing[0]?.version || 0) + 1;
  const id = `${templateId}-v${version}`;
  const parsed = versionContentSchema.parse(content);
  await runTransaction(db, async (tx) => {
    const target = ref(db, c, 'templateVersions', id);
    if ((await tx.get(target)).exists())
      throw new UserError(
        'Another draft was just created. Reload the template.',
      );
    const t = await tx.get(ref(db, c, 'taskTemplates', templateId));
    if (!t.exists() || t.data().status !== 'active')
      throw new UserError('Choose an active template.');
    tx.set(target, {
      companyId: c,
      schemaVersion: 1,
      templateId,
      version,
      state: 'draft',
      content: parsed,
      revision: 1,
      createdAt: serverTimestamp(),
      createdBy: uid,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      publishedAt: null,
      publishedBy: '',
      retiredAt: null,
    });
  });
  return id;
}
/** Saves a draft; with `publish`, validates and freezes it permanently. */
export async function saveDraft(
  db: Firestore,
  c: string,
  uid: string,
  version: TemplateVersion,
  content: VersionContent,
  publish = false,
) {
  const issues = contentIssues(content, publish);
  if (issues.length) throw new UserError(issues[0].message);
  const parsed = versionContentSchema.parse(content);
  await runTransaction(db, async (tx) => {
    const target = ref(db, c, 'templateVersions', version.id);
    const s = await tx.get(target);
    if (!s.exists() || s.data().revision !== version.revision)
      throw new UserError('This draft changed. Reload before saving.');
    if (s.data().state !== 'draft')
      throw new UserError(
        'Published versions cannot be edited. Create a new draft.',
      );
    tx.update(target, {
      content: parsed,
      revision: version.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      ...(publish
        ? {
            state: 'published',
            publishedAt: serverTimestamp(),
            publishedBy: uid,
          }
        : {}),
    });
  });
}
export async function retireVersion(
  db: Firestore,
  c: string,
  uid: string,
  v: TemplateVersion,
) {
  await runTransaction(db, async (tx) => {
    const target = ref(db, c, 'templateVersions', v.id);
    const s = await tx.get(target);
    if (
      !s.exists() ||
      s.data().revision !== v.revision ||
      s.data().state !== 'published'
    )
      throw new UserError('Only the current published version can be retired.');
    tx.update(target, {
      state: 'retired',
      retiredAt: serverTimestamp(),
      revision: v.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  });
}

/* ================================================================ tasks */
export type NewTask = {
  versionId: string;
  title: string;
  siteId: string;
  locationId: string;
  facilityId: string;
  assetId: string;
  departmentId: string;
  assigneeIds: string[];
  teamId: string;
  priority: Priority;
  plannedStart: string;
  dueAt: string;
  notes: string;
};
function toTimestamp(local: string) {
  const d = new Date(local);
  if (!local || isNaN(d.getTime()))
    throw new UserError('Enter a valid date and time.');
  return Timestamp.fromDate(d);
}
/** Creates a task from a published version with an immutable content snapshot. */
export async function createTask(
  db: Firestore,
  c: string,
  uid: string,
  input: NewTask,
) {
  if (!input.title.trim()) throw new UserError('Enter a task title.');
  if (!input.siteId) throw new UserError('Choose a site.');
  if (input.assigneeIds.length > 10)
    throw new UserError('Assign at most 10 employees.');
  const dueAt = toTimestamp(input.dueAt);
  const plannedStart = input.plannedStart
    ? toTimestamp(input.plannedStart)
    : null;
  if (plannedStart && plannedStart.toMillis() > dueAt.toMillis())
    throw new UserError('The due time must be after the planned start.');
  const id = doc(col(db, c, 'tasks')).id;
  await runTransaction(db, async (tx) => {
    const v = await tx.get(ref(db, c, 'templateVersions', input.versionId));
    if (!v.exists() || v.data().state !== 'published')
      throw new UserError('Choose a published template version.');
    const site = await tx.get(ref(db, c, 'sites', input.siteId));
    if (!site.exists() || site.data().status === 'archived')
      throw new UserError('Choose an active site.');
    for (const [kind, key] of [
      ['locations', 'locationId'],
      ['facilities', 'facilityId'],
      ['assets', 'assetId'],
    ] as const) {
      const value = input[key];
      if (!value) continue;
      const s = await tx.get(ref(db, c, kind, value));
      if (
        !s.exists() ||
        s.data().siteId !== input.siteId ||
        s.data().status === 'archived'
      )
        throw new UserError(
          `The selected ${kind.slice(0, -1)} must be active and in this site.`,
        );
    }
    for (const e of input.assigneeIds) {
      const s = await tx.get(ref(db, c, 'employees', e));
      if (
        !s.exists() ||
        ['archived', 'terminated', 'resigned', 'suspended'].includes(
          s.data().status,
        )
      )
        throw new UserError('Assign active employees only.');
    }
    const content = v.data().content as VersionContent;
    const status: TaskStatus = input.assigneeIds.length
      ? 'assigned'
      : 'pending';
    const task = ref(db, c, 'tasks', id);
    tx.set(task, {
      companyId: c,
      schemaVersion: 1,
      reference: taskReference(),
      title: input.title.trim().slice(0, 160),
      templateId: v.data().templateId,
      versionId: input.versionId,
      version: v.data().version,
      content,
      approvalRequired: content.approvalRequired,
      priority: input.priority,
      siteId: input.siteId,
      locationId: input.locationId,
      facilityId: input.facilityId,
      assetId: input.assetId,
      departmentId: input.departmentId,
      assigneeIds: input.assigneeIds,
      teamId: input.teamId,
      notes: input.notes.slice(0, 2000),
      plannedStart,
      dueAt,
      status,
      attempt: 1,
      draftAnswers: {},
      occurrenceKey: '',
      cancelReason: '',
      exceptionCount: 0,
      evidencePending: false,
      completedAt: null,
      createdAt: serverTimestamp(),
      createdBy: uid,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      revision: 1,
    });
    tx.set(
      ref(db, c, 'taskEvents', `${id}_1`),
      event(c, id, 1, 'create', '', status, uid, '', input.assigneeIds, 1),
    );
  });
  return id;
}
export function event(
  c: string,
  taskId: string,
  revision: number,
  action: TaskAction,
  fromStatus: string,
  toStatus: TaskStatus,
  uid: string,
  note: string,
  assigneeIds: string[],
  attempt: number,
) {
  return {
    companyId: c,
    schemaVersion: 1,
    taskId,
    revision,
    action,
    fromStatus,
    toStatus,
    actorUid: uid,
    at: serverTimestamp(),
    note: note.slice(0, 1000),
    assigneeIds,
    attempt,
  };
}
async function loadFresh(
  tx: Parameters<Parameters<typeof runTransaction>[1]>[0],
  db: Firestore,
  c: string,
  task: Task,
) {
  const s = await tx.get(ref(db, c, 'tasks', task.id));
  if (!s.exists()) throw new UserError('This task no longer exists.');
  const fresh = { id: s.id, ...s.data() } as Task;
  if (fresh.revision !== task.revision)
    throw new UserError(
      'This task was updated by someone else. It has been reloaded; please review and try again.',
    );
  return fresh;
}
/** Simple lifecycle transitions: assign, start, pause, resume, restart, cancel. */
export async function transitionTask(
  db: Firestore,
  c: string,
  uid: string,
  task: Task,
  action: 'assign' | 'start' | 'pause' | 'resume' | 'restart' | 'cancel',
  options: { assigneeIds?: string[]; note?: string } = {},
) {
  if (action === 'cancel' && !options.note?.trim())
    throw new UserError('Enter a reason for cancelling.');
  if (action === 'assign' && !options.assigneeIds?.length)
    throw new UserError('Choose at least one employee.');
  await runTransaction(db, async (tx) => {
    const t = await loadFresh(tx, db, c, task);
    const rule = transitions[action];
    if (!rule.from.includes(t.status))
      throw new UserError(
        `This task cannot be ${action === 'restart' ? 'restarted' : action + 'ed'} while ${t.status.replaceAll('_', ' ')}.`,
      );
    if (action === 'assign')
      for (const e of options.assigneeIds!) {
        const s = await tx.get(ref(db, c, 'employees', e));
        if (!s.exists() || s.data().status === 'archived')
          throw new UserError('Assign active employees only.');
      }
    const to = rule.to(t.approvalRequired);
    const revision = t.revision + 1;
    const assigneeIds =
      action === 'assign' ? options.assigneeIds!.slice(0, 10) : t.assigneeIds;
    const attempt = action === 'restart' ? t.attempt + 1 : t.attempt;
    tx.update(ref(db, c, 'tasks', t.id), {
      status: to,
      assigneeIds,
      attempt,
      ...(action === 'restart' ? { draftAnswers: {} } : {}),
      ...(action === 'cancel'
        ? { cancelReason: options.note!.trim().slice(0, 500) }
        : {}),
      revision,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    tx.set(
      ref(db, c, 'taskEvents', `${t.id}_${revision}`),
      event(
        c,
        t.id,
        revision,
        action,
        t.status,
        to,
        uid,
        options.note || '',
        assigneeIds,
        attempt,
      ),
    );
  });
  if (action === 'assign')
    await notifySafely(db, c, uid, linkedUids(db, c, options.assigneeIds!), {
      type: task.assigneeIds.length ? 'task_reassigned' : 'task_assigned',
      recordKind: 'tasks',
      recordId: task.id,
      eventKey: `r${task.revision + 1}`,
      body: `${task.reference} ${task.title}`,
    });
}
/** Saves in-progress answers without changing the task status. */
export async function saveProgress(
  db: Firestore,
  c: string,
  uid: string,
  task: Task,
  answers: Record<string, string>,
) {
  await runTransaction(db, async (tx) => {
    const t = await loadFresh(tx, db, c, task);
    if (t.status !== 'in_progress')
      throw new UserError('Start the task before saving answers.');
    tx.update(ref(db, c, 'tasks', t.id), {
      draftAnswers: Object.fromEntries(
        Object.entries(answers)
          .filter(([, v]) => v.trim())
          .map(([k, v]) => [k, v.slice(0, 4000)]),
      ),
      revision: t.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  });
}
/**
 * Submits the checklist: an immutable submission attempt, the task status and
 * a timeline event in one transaction. Exception records follow in a batch.
 */
export async function submitTask(
  db: Firestore,
  c: string,
  uid: string,
  task: Task,
  answers: Record<string, string>,
  remarks: string,
) {
  const result = evaluateSubmission(task.content, answers);
  if (Object.keys(result.errors).length)
    throw new UserError(
      `Complete ${Object.keys(result.errors).length} required or invalid answer(s) before submitting.`,
    );
  let attempt = task.attempt;
  await runTransaction(db, async (tx) => {
    const t = await loadFresh(tx, db, c, task);
    if (t.status !== 'in_progress')
      throw new UserError('Only tasks in progress can be submitted.');
    attempt = t.attempt;
    const subRef = ref(db, c, 'taskSubmissions', `${t.id}_${t.attempt}`);
    if ((await tx.get(subRef)).exists())
      throw new UserError('This attempt was already submitted.');
    const to = transitions.submit.to(t.approvalRequired);
    const revision = t.revision + 1;
    tx.set(subRef, {
      companyId: c,
      schemaVersion: 1,
      taskId: t.id,
      attempt: t.attempt,
      versionId: t.versionId,
      answers: result.cleaned,
      exceptions: result.exceptions,
      evidencePending: result.evidencePending,
      remarks: remarks.slice(0, 2000),
      siteId: t.siteId,
      locationId: t.locationId,
      facilityId: t.facilityId,
      assetId: t.assetId,
      submittedBy: uid,
      submittedAt: serverTimestamp(),
    });
    tx.update(ref(db, c, 'tasks', t.id), {
      status: to,
      draftAnswers: {},
      exceptionCount: t.exceptionCount + result.exceptions.length,
      evidencePending: result.evidencePending.length > 0,
      ...(to === 'completed' ? { completedAt: serverTimestamp() } : {}),
      revision,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    tx.set(
      ref(db, c, 'taskEvents', `${t.id}_${revision}`),
      event(
        c,
        t.id,
        revision,
        'submit',
        t.status,
        to,
        uid,
        remarks,
        t.assigneeIds,
        t.attempt,
      ),
    );
  });
  if (result.exceptions.length) {
    const batch = writeBatch(db);
    for (const e of result.exceptions) {
      const q = task.content.questions.find((x) => x.id === e.questionId);
      batch.set(
        ref(db, c, 'taskExceptions', `${task.id}_${attempt}_${e.questionId}`),
        {
          ...exceptionBase(c, task, attempt, uid),
          questionId: e.questionId,
          type:
            q && ['pass_fail', 'yes_no', 'asset_condition'].includes(q.type)
              ? 'Failed check'
              : 'Out of range reading',
          severity: e.severity,
          description: `${q?.label || e.questionId}: ${e.reason}`.slice(
            0,
            1000,
          ),
        },
      );
    }
    await batch.commit();
  }
  if (task.approvalRequired)
    await notifySafely(
      db,
      c,
      uid,
      adminUids(db, c).then((u) => u.filter((x) => x !== uid)),
      {
        type: 'task_awaiting_approval',
        recordKind: 'tasks',
        recordId: task.id,
        eventKey: `a${attempt}`,
        body: `${task.reference} ${task.title}`,
      },
    );
  return result;
}
function exceptionBase(c: string, task: Task, attempt: number, uid: string) {
  return {
    companyId: c,
    schemaVersion: 1,
    taskId: task.id,
    attempt,
    siteId: task.siteId,
    locationId: task.locationId,
    facilityId: task.facilityId,
    assetId: task.assetId,
    detectedBy: uid,
    detectedAt: serverTimestamp(),
    status: 'open',
    resolutionNote: '',
    revision: 1,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
}
/** Records an issue found during execution (not tied to a checklist answer). */
export async function reportException(
  db: Firestore,
  c: string,
  uid: string,
  task: Task,
  input: {
    type: string;
    severity: 'warning' | 'critical';
    description: string;
    /** Question the issue relates to (optional). */
    questionId?: string;
  },
  /** Stable ID generated once per form so a retried report is not duplicated. */
  presetId?: string,
) {
  if (!input.description.trim()) throw new UserError('Describe the issue.');
  if (!openStatuses.includes(task.status))
    throw new UserError('Issues can only be reported on open tasks.');
  const id = presetId || doc(col(db, c, 'taskExceptions')).id;
  const target = ref(db, c, 'taskExceptions', id);
  if (presetId && (await getDoc(target)).exists()) return id;
  const batch = writeBatch(db);
  batch.set(target, {
    ...exceptionBase(c, task, task.attempt, uid),
    questionId: (input.questionId || '').slice(0, 16),
    type: input.type,
    severity: input.severity,
    description: input.description.trim().slice(0, 1000),
  });
  await batch.commit();
  return id;
}
export async function updateException(
  db: Firestore,
  c: string,
  uid: string,
  e: TaskException,
  status: 'acknowledged' | 'closed',
  note: string,
) {
  await runTransaction(db, async (tx) => {
    const target = ref(db, c, 'taskExceptions', e.id);
    const s = await tx.get(target);
    if (!s.exists() || s.data().revision !== e.revision)
      throw new UserError('This issue changed. Reload and try again.');
    tx.update(target, {
      status,
      resolutionNote: note.slice(0, 1000),
      revision: e.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  });
}
/** Records an immutable review decision and moves the task accordingly. */
export async function reviewTask(
  db: Firestore,
  c: string,
  uid: string,
  task: Task,
  decision: 'approve' | 'request_rework' | 'reject',
  reason: string,
) {
  if (decision !== 'approve' && !reason.trim())
    throw new UserError('Enter a reason so the team knows what to correct.');
  await runTransaction(db, async (tx) => {
    const t = await loadFresh(tx, db, c, task);
    if (t.status !== 'awaiting_approval')
      throw new UserError('This task is not awaiting approval.');
    const sub = await tx.get(
      ref(db, c, 'taskSubmissions', `${t.id}_${t.attempt}`),
    );
    if (!sub.exists()) throw new UserError('The submission is missing.');
    if (sub.data().submittedBy === uid)
      throw new UserError(
        'You submitted this work, so another authorised reviewer must approve it.',
      );
    const decisionRef = ref(db, c, 'taskApprovals', `${t.id}_${t.attempt}`);
    if ((await tx.get(decisionRef)).exists())
      throw new UserError('A decision was already recorded for this attempt.');
    const to = transitions[decision].to(true);
    const revision = t.revision + 1;
    tx.set(decisionRef, {
      companyId: c,
      schemaVersion: 1,
      taskId: t.id,
      attempt: t.attempt,
      decision,
      reason: reason.trim().slice(0, 1000),
      reviewerUid: uid,
      submittedBy: sub.data().submittedBy,
      decidedAt: serverTimestamp(),
    });
    tx.update(ref(db, c, 'tasks', t.id), {
      status: to,
      ...(to === 'completed' ? { completedAt: serverTimestamp() } : {}),
      revision,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
    tx.set(
      ref(db, c, 'taskEvents', `${t.id}_${revision}`),
      event(
        c,
        t.id,
        revision,
        decision,
        t.status,
        to,
        uid,
        reason,
        t.assigneeIds,
        t.attempt,
      ),
    );
  });
  await notifySafely(db, c, uid, linkedUids(db, c, task.assigneeIds), {
    type:
      decision === 'approve'
        ? 'task_approved'
        : decision === 'reject'
          ? 'task_rejected'
          : 'task_rework',
    recordKind: 'tasks',
    recordId: task.id,
    eventKey: `a${task.attempt}`,
    body: `${task.reference} ${task.title}${reason.trim() ? ': ' + reason.trim().slice(0, 200) : ''}`,
  });
}

/* ================================================================ queries */
export async function getTask(db: Firestore, c: string, id: string) {
  const s = await getDoc(ref(db, c, 'tasks', id));
  return s.exists() ? ({ id: s.id, ...s.data() } as Task) : null;
}
export type TaskFilter = {
  status?: string;
  siteId?: string;
  departmentId?: string;
  priority?: string;
  assigneeId?: string;
  templateId?: string;
};
export async function listTasks(
  db: Firestore,
  c: string,
  f: TaskFilter,
  cursor?: QueryDocumentSnapshot,
) {
  const k: QueryConstraint[] = [];
  if (f.status) k.push(where('status', '==', f.status));
  // One additional equality filter keeps every query on a declared index.
  if (f.assigneeId)
    k.push(where('assigneeIds', 'array-contains', f.assigneeId));
  else if (f.siteId) k.push(where('siteId', '==', f.siteId));
  else if (f.departmentId) k.push(where('departmentId', '==', f.departmentId));
  else if (f.priority) k.push(where('priority', '==', f.priority));
  else if (f.templateId) k.push(where('templateId', '==', f.templateId));
  k.push(orderBy('dueAt'));
  if (cursor) k.push(startAfter(cursor));
  k.push(limit(PAGE + 1));
  const r = await getDocs(query(col(db, c, 'tasks'), ...k));
  const page = r.docs.slice(0, PAGE);
  return {
    rows: page.map((d) => ({ id: d.id, ...d.data() }) as Task),
    cursor: page.at(-1),
    hasMore: r.docs.length > PAGE,
  };
}
export async function taskCounts(db: Firestore, c: string) {
  const base = col(db, c, 'tasks');
  const count = (...w: QueryConstraint[]) =>
    getCountFromServer(query(base, ...w)).then((r) => r.data().count);
  const statuses: TaskStatus[] = [
    'pending',
    'assigned',
    'in_progress',
    'awaiting_approval',
    'rework_required',
    'completed',
  ];
  const [total, overdue, ...rest] = await Promise.all([
    count(),
    count(
      where('status', 'in', openStatuses),
      where('dueAt', '<', Timestamp.now()),
    ),
    ...statuses.map((s) => count(where('status', '==', s))),
  ]);
  return {
    total,
    overdue,
    ...Object.fromEntries(statuses.map((s, i) => [s, rest[i]])),
  } as Record<string, number>;
}
export async function taskEvents(db: Firestore, c: string, taskId: string) {
  const r = await getDocs(
    query(
      col(db, c, 'taskEvents'),
      where('taskId', '==', taskId),
      orderBy('revision'),
      limit(200),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as TaskEvent);
}
export async function recentEvents(
  db: Firestore,
  c: string,
  cursor?: QueryDocumentSnapshot,
) {
  const k: QueryConstraint[] = [orderBy('at', 'desc')];
  if (cursor) k.push(startAfter(cursor));
  k.push(limit(PAGE + 1));
  const r = await getDocs(query(col(db, c, 'taskEvents'), ...k));
  const page = r.docs.slice(0, PAGE);
  return {
    rows: page.map((d) => ({ id: d.id, ...d.data() }) as TaskEvent),
    cursor: page.at(-1),
    hasMore: r.docs.length > PAGE,
  };
}
export async function submissions(db: Firestore, c: string, taskId: string) {
  const r = await getDocs(
    query(
      col(db, c, 'taskSubmissions'),
      where('taskId', '==', taskId),
      orderBy('attempt'),
      limit(50),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as Submission);
}
export async function approvals(db: Firestore, c: string, taskId: string) {
  const r = await getDocs(
    query(
      col(db, c, 'taskApprovals'),
      where('taskId', '==', taskId),
      orderBy('attempt'),
      limit(50),
    ),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as Approval);
}
export async function listExceptions(
  db: Firestore,
  c: string,
  f: { taskId?: string; status?: string },
  cursor?: QueryDocumentSnapshot,
) {
  const k: QueryConstraint[] = [];
  if (f.taskId) k.push(where('taskId', '==', f.taskId));
  else if (f.status) k.push(where('status', '==', f.status));
  k.push(orderBy('detectedAt', 'desc'));
  if (cursor) k.push(startAfter(cursor));
  k.push(limit(PAGE + 1));
  const r = await getDocs(query(col(db, c, 'taskExceptions'), ...k));
  const page = r.docs.slice(0, PAGE);
  return {
    rows: page.map((d) => ({ id: d.id, ...d.data() }) as TaskException),
    cursor: page.at(-1),
    hasMore: r.docs.length > PAGE,
  };
}
/**
 * Preview of eligible employees for an assignment rule. Phase 4's assignment
 * engine will resolve the same rule automatically; Phase 3 only previews it.
 */
export async function eligibleEmployees(
  db: Firestore,
  c: string,
  rule: { mode: string; refId: string; siteId: string },
) {
  const ids = new Set<string>();
  const add = async (
    collectionName: string,
    key: string,
    value: string,
    idKey = '',
  ) => {
    const r = await getDocs(
      query(col(db, c, collectionName), where(key, '==', value), limit(50)),
    );
    for (const d of r.docs)
      if (
        d.data().status === 'active' ||
        (!idKey && d.data().status === 'probation')
      )
        ids.add(idKey ? d.data()[idKey] : d.id);
  };
  if (rule.mode === 'employee' && rule.refId) ids.add(rule.refId);
  if (rule.mode === 'department' && rule.refId)
    await add('employees', 'departmentId', rule.refId);
  if (rule.mode === 'team' && rule.refId)
    await add('teamMembers', 'teamId', rule.refId, 'employeeId');
  if (rule.mode === 'shift' && rule.refId)
    await add('shiftAssignments', 'shiftId', rule.refId, 'employeeId');
  if (rule.mode === 'site' && (rule.refId || rule.siteId))
    await add(
      'siteAssignments',
      'siteId',
      rule.refId || rule.siteId,
      'employeeId',
    );
  return [...ids].slice(0, 50);
}
