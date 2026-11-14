import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { beforeAll, afterAll, it, expect, describe } from 'vitest';
import {
  defaultValues,
  emptyContent,
  newQuestion,
  type Kind,
  type Values,
  type VersionContent,
} from '../../packages/shared/src';
import { saveRecord } from '../../apps/admin-web/src/management/store';
import {
  createDraft,
  saveDraft,
  retireVersion,
  listVersions,
  createTask,
  getTask,
  transitionTask,
  saveProgress,
  submitTask,
  reviewTask,
  taskEvents,
  submissions,
  approvals,
  listExceptions,
  reportException,
  taskCounts,
  listTasks,
  type NewTask,
} from '../../apps/admin-web/src/management/tasksStore';

let env: RulesTestEnvironment;
let db: Firestore; // owner-a
let reviewer: Firestore; // admin2-a
const meta = {
  schemaVersion: 1,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  createdBy: 'operator',
  updatedBy: 'operator',
};
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw new Error('Emulator required');
  env = await initializeTestEnvironment({
    projectId: 'demo-facilityos-phase3',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firebase/firestore.rules', 'utf8'),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    for (const companyId of ['a', 'b']) {
      await setDoc(doc(c.firestore(), 'companies', companyId), {
        ...meta,
        companyId,
        name: companyId,
        status: 'active',
        timeZone: 'Asia/Dubai',
      });
      for (const [uid, role] of [
        [`owner-${companyId}`, 'owner'],
        [`admin2-${companyId}`, 'admin'],
        [`staff-${companyId}`, 'staff'],
      ])
        await setDoc(
          doc(c.firestore(), 'companies', companyId, 'members', uid),
          {
            ...meta,
            companyId,
            uid,
            role,
            status: 'active',
          },
        );
    }
  });
  db = env.authenticatedContext('owner-a').firestore() as unknown as Firestore;
  reviewer = env
    .authenticatedContext('admin2-a')
    .firestore() as unknown as Firestore;
});
afterAll(async () => {
  await env?.cleanup();
});
let seq = 0;
const create = (kind: Kind, v: Values = {}, database = db, company = 'a') =>
  saveRecord(database, company, `owner-${company}`, kind, {
    ...defaultValues(kind),
    code: `P3X${++seq}`,
    name: `Record ${seq}`,
    ...v,
  });
function checklist(approvalRequired = true): VersionContent {
  const c = emptyContent('Daily AC inspection');
  const q1 = {
    ...newQuestion('s1', 'pass_fail'),
    id: 'q1',
    label: 'AC operating',
    escalateOnFail: true,
  };
  const q2 = {
    ...newQuestion('s1', 'temperature', [q1]),
    id: 'q2',
    label: 'Supply air temperature',
    min: -10,
    max: 60,
    expectedMin: 12,
    expectedMax: 18,
  };
  return {
    ...c,
    approvalRequired,
    questions: [q1, q2],
    raci: [
      {
        id: 'r1',
        letter: 'R',
        kind: 'designation',
        refId: 'tech',
        label: 'Technician',
        siteId: '',
      },
      {
        id: 'r2',
        letter: 'A',
        kind: 'designation',
        refId: 'sup',
        label: 'Supervisor',
        siteId: '',
      },
    ],
  };
}
async function world(approvalRequired = true) {
  const site = await create('sites');
  const location = await create('locations', { siteId: site });
  const department = await create('departments');
  const designation = await create('designations', {
    departmentId: department,
  });
  const employee = await create('employees', {
    joiningDate: '2026-01-05',
    departmentId: department,
    designationId: designation,
  });
  const category = await create('taskCategories');
  const template = await create('taskTemplates', { categoryId: category });
  const draft = await createDraft(
    db,
    'a',
    'owner-a',
    template,
    checklist(approvalRequired),
  );
  const [v] = await listVersions(db, 'a', template);
  await saveDraft(db, 'a', 'owner-a', v, v.content, true);
  return {
    site,
    location,
    department,
    employee,
    category,
    template,
    versionId: draft,
  };
}
const due = (hours: number) => {
  const d = new Date(Date.now() + hours * 3600_000);
  return d.toISOString().slice(0, 16);
};
const input = (
  w: Awaited<ReturnType<typeof world>>,
  v: Partial<NewTask> = {},
): NewTask => ({
  versionId: w.versionId,
  title: 'Inspect AC – Tower A',
  siteId: w.site,
  locationId: w.location,
  facilityId: '',
  assetId: '',
  departmentId: w.department,
  assigneeIds: [w.employee],
  teamId: '',
  priority: 'high',
  plannedStart: '',
  dueAt: due(4),
  notes: '',
  ...v,
});
const fresh = async (id: string, database = db) =>
  (await getTask(database, 'a', id))!;

describe('categories, templates and versions', () => {
  it('creates categories and templates, publishes immutable versions and keeps history', async () => {
    const w = await world();
    const versions = await listVersions(db, 'a', w.template);
    expect(versions[0].state).toBe('published');
    // Published content cannot be changed in place, by the app or directly.
    await expect(
      saveDraft(db, 'a', 'owner-a', versions[0], checklist()),
    ).rejects.toThrow('cannot be edited');
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'templateVersions', w.versionId), {
        'content.title': 'Changed',
        revision: versions[0].revision + 1,
        updatedAt: serverTimestamp(),
        updatedBy: 'owner-a',
      }),
    );
    await assertFails(
      deleteDoc(doc(db, 'companies', 'a', 'templateVersions', w.versionId)),
    );
    // Copy into v2, publish, retire v1: v1 is preserved for audit.
    const v2 = await createDraft(db, 'a', 'owner-a', w.template, {
      ...checklist(),
      title: 'AC inspection v2',
    });
    await expect(
      createDraft(db, 'a', 'owner-a', w.template, checklist()),
    ).rejects.toThrow('already has a draft');
    let list = await listVersions(db, 'a', w.template);
    await saveDraft(db, 'a', 'owner-a', list[0], list[0].content, true);
    list = await listVersions(db, 'a', w.template);
    await retireVersion(db, 'a', 'owner-a', list[1]);
    list = await listVersions(db, 'a', w.template);
    expect(list.map((v) => [v.id, v.state])).toEqual([
      [v2, 'published'],
      [w.versionId, 'retired'],
    ]);
    expect(list[1].content.title).toBe('Daily AC inspection');
  });
  it('blocks publishing incomplete checklists and conditional loops', async () => {
    const w = await world();
    await create('taskTemplates', { categoryId: w.category });
    const t = await create('taskTemplates', { categoryId: w.category });
    await createDraft(db, 'a', 'owner-a', t, emptyContent('Empty'));
    const [v] = await listVersions(db, 'a', t);
    await expect(
      saveDraft(db, 'a', 'owner-a', v, v.content, true),
    ).rejects.toThrow('at least one question');
    const loop = checklist();
    loop.questions[0].showIf = { questionId: 'q2', equals: '1' };
    loop.questions[1].showIf = { questionId: 'q1', equals: 'pass' };
    await expect(saveDraft(db, 'a', 'owner-a', v, loop)).rejects.toThrow(
      'loop',
    );
  });
});

describe('task creation and references', () => {
  it('creates a task from a published version with a frozen snapshot and creation event', async () => {
    const w = await world();
    const id = await createTask(db, 'a', 'owner-a', input(w));
    const t = await fresh(id);
    expect(t.status).toBe('assigned');
    expect(t.content.questions.length).toBe(2);
    expect(t.reference).toMatch(/^TSK-/);
    // Publishing a new version does not change existing tasks.
    await createDraft(db, 'a', 'owner-a', w.template, {
      ...checklist(),
      title: 'v2',
    });
    const [v2] = await listVersions(db, 'a', w.template);
    await saveDraft(
      db,
      'a',
      'owner-a',
      v2,
      { ...v2.content, questions: v2.content.questions.slice(0, 1) },
      true,
    );
    expect((await fresh(id)).content.questions.length).toBe(2);
    const events = await taskEvents(db, 'a', id);
    expect(events.map((e) => e.action)).toEqual(['create']);
  });
  it('rejects drafts, foreign sites and cross-site locations, and denies other companies and staff', async () => {
    const w = await world();
    const other = await create('sites');
    const t2 = await create('taskTemplates', { categoryId: w.category });
    const draft = await createDraft(db, 'a', 'owner-a', t2, checklist());
    await expect(
      createTask(db, 'a', 'owner-a', input(w, { versionId: draft })),
    ).rejects.toThrow('published');
    await expect(
      createTask(db, 'a', 'owner-a', input(w, { siteId: other })),
    ).rejects.toThrow('in this site');
    await expect(
      createTask(db, 'a', 'owner-a', input(w, { assigneeIds: ['ghost'] })),
    ).rejects.toThrow('active employees');
    const id = await createTask(db, 'a', 'owner-a', input(w));
    const outsider = env.authenticatedContext('owner-b').firestore();
    await assertFails(getDoc(doc(outsider, 'companies', 'a', 'tasks', id)));
    const staff = env.authenticatedContext('staff-a').firestore();
    await assertFails(getDoc(doc(staff, 'companies', 'a', 'tasks', id)));
    // A forged task whose content differs from the published version is rejected.
    const forged = 'forged-task';
    const batch = writeBatch(db);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _ignored, ...t } = await fresh(id);
    batch.set(doc(db, 'companies', 'a', 'tasks', forged), {
      ...t,
      content: { ...t.content, title: 'Different' },
      status: 'assigned',
      revision: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: 'owner-a',
      updatedBy: 'owner-a',
    });
    batch.set(doc(db, 'companies', 'a', 'taskEvents', forged + '_1'), {
      companyId: 'a',
      schemaVersion: 1,
      taskId: forged,
      revision: 1,
      action: 'create',
      fromStatus: '',
      toStatus: 'assigned',
      actorUid: 'owner-a',
      at: serverTimestamp(),
      note: '',
      assigneeIds: t.assigneeIds,
      attempt: 1,
    });
    await assertFails(batch.commit());
  });
});

describe('execution, approval and rework', () => {
  it('runs start → progress → submit → rework → resubmit → approve with full history', async () => {
    const w = await world();
    const id = await createTask(db, 'a', 'owner-a', input(w));
    await expect(
      submitTask(
        db,
        'a',
        'owner-a',
        await fresh(id),
        { q1: 'pass', q2: '15' },
        '',
      ),
    ).rejects.toThrow();
    await transitionTask(db, 'a', 'owner-a', await fresh(id), 'start');
    await saveProgress(db, 'a', 'owner-a', await fresh(id), { q1: 'pass' });
    expect((await fresh(id)).draftAnswers).toEqual({ q1: 'pass' });
    await expect(
      submitTask(db, 'a', 'owner-a', await fresh(id), { q1: 'pass' }, ''),
    ).rejects.toThrow('required');
    await expect(
      submitTask(
        db,
        'a',
        'owner-a',
        await fresh(id),
        { q1: 'pass', q2: '99' },
        '',
      ),
    ).rejects.toThrow('invalid');
    const r1 = await submitTask(
      db,
      'a',
      'owner-a',
      await fresh(id),
      { q1: 'fail', q2: '21' },
      'Unit noisy',
    );
    expect(r1.exceptions.length).toBe(2);
    expect((await fresh(id)).status).toBe('awaiting_approval');
    // The submitter cannot approve their own work.
    await expect(
      reviewTask(db, 'a', 'owner-a', await fresh(id), 'approve', ''),
    ).rejects.toThrow('another authorised reviewer');
    await expect(
      reviewTask(
        reviewer,
        'a',
        'admin2-a',
        await fresh(id, reviewer),
        'request_rework',
        '',
      ),
    ).rejects.toThrow('reason');
    await reviewTask(
      reviewer,
      'a',
      'admin2-a',
      await fresh(id, reviewer),
      'request_rework',
      'Re-check temperature',
    );
    expect((await fresh(id)).status).toBe('rework_required');
    await transitionTask(db, 'a', 'owner-a', await fresh(id), 'restart');
    const t = await fresh(id);
    expect(t.attempt).toBe(2);
    await submitTask(db, 'a', 'owner-a', t, { q1: 'pass', q2: '14' }, '');
    await reviewTask(
      reviewer,
      'a',
      'admin2-a',
      await fresh(id, reviewer),
      'approve',
      '',
    );
    const done = await fresh(id);
    expect(done.status).toBe('completed');
    expect(done.completedAt).not.toBe(null);
    const subs = await submissions(db, 'a', id);
    expect(subs.map((s) => s.answers)).toEqual([
      { q1: 'fail', q2: '21' },
      { q1: 'pass', q2: '14' },
    ]);
    expect((await approvals(db, 'a', id)).map((a) => a.decision)).toEqual([
      'request_rework',
      'approve',
    ]);
    expect((await taskEvents(db, 'a', id)).map((e) => e.action)).toEqual([
      'create',
      'start',
      'submit',
      'request_rework',
      'restart',
      'submit',
      'approve',
    ]);
    expect((await listExceptions(db, 'a', { taskId: id })).rows.length).toBe(2);
    // Completed tasks cannot be reopened; history and submissions are immutable.
    await expect(
      transitionTask(db, 'a', 'owner-a', done, 'start'),
    ).rejects.toThrow();
    await expect(
      reviewTask(reviewer, 'a', 'admin2-a', done, 'approve', ''),
    ).rejects.toThrow();
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'taskSubmissions', `${id}_1`), {
        remarks: 'edited',
      }),
    );
    await assertFails(
      deleteDoc(doc(db, 'companies', 'a', 'taskEvents', `${id}_1`)),
    );
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'taskApprovals', `${id}_2`), {
        decision: 'reject',
      }),
    );
  });
  it('completes without approval when the template does not require it', async () => {
    const w = await world(false);
    const id = await createTask(db, 'a', 'owner-a', input(w));
    await transitionTask(db, 'a', 'owner-a', await fresh(id), 'start');
    await submitTask(
      db,
      'a',
      'owner-a',
      await fresh(id),
      { q1: 'pass', q2: '15' },
      '',
    );
    expect((await fresh(id)).status).toBe('completed');
  });
  it('rejects invalid transitions, forged status jumps and stale concurrent updates', async () => {
    const w = await world();
    const id = await createTask(
      db,
      'a',
      'owner-a',
      input(w, { assigneeIds: [] }),
    );
    expect((await fresh(id)).status).toBe('pending');
    await expect(
      transitionTask(db, 'a', 'owner-a', await fresh(id), 'start'),
    ).rejects.toThrow();
    // Direct status jump without an event is denied.
    const t = await fresh(id);
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'tasks', id), {
        status: 'completed',
        revision: t.revision + 1,
        updatedAt: serverTimestamp(),
        updatedBy: 'owner-a',
      }),
    );
    await transitionTask(db, 'a', 'owner-a', t, 'assign', {
      assigneeIds: [w.employee],
    });
    // A second writer holding the old revision is refused.
    await expect(
      transitionTask(db, 'a', 'owner-a', t, 'cancel', { note: 'dup' }),
    ).rejects.toThrow('updated by someone else');
    const both = await Promise.allSettled([
      transitionTask(db, 'a', 'owner-a', await fresh(id), 'start'),
      transitionTask(
        reviewer,
        'a',
        'admin2-a',
        await fresh(id, reviewer),
        'cancel',
        { note: 'Not needed' },
      ),
    ]);
    expect(both.filter((r) => r.status === 'fulfilled').length).toBe(1);
    const events = await taskEvents(db, 'a', id);
    expect(events.length).toBe(3);
    await expect(
      transitionTask(db, 'a', 'owner-a', await fresh(id), 'cancel', {}),
    ).rejects.toThrow('reason');
  });
  it('records issues during execution, counts tasks and finds overdue work', async () => {
    const w = await world();
    const id = await createTask(
      db,
      'a',
      'owner-a',
      input(w, { dueAt: due(-2) }),
    );
    await transitionTask(db, 'a', 'owner-a', await fresh(id), 'start');
    await reportException(db, 'a', 'owner-a', await fresh(id), {
      type: 'Leak',
      severity: 'critical',
      description: 'Water dripping from indoor unit',
    });
    const issues = await listExceptions(db, 'a', { taskId: id });
    expect(issues.rows[0].severity).toBe('critical');
    const counts = await taskCounts(db, 'a');
    expect(counts.overdue).toBeGreaterThanOrEqual(1);
    expect(counts.in_progress).toBeGreaterThanOrEqual(1);
    const mine = await listTasks(db, 'a', { assigneeId: w.employee });
    expect(mine.rows.some((t) => t.id === id)).toBe(true);
    const staff = env.authenticatedContext('staff-a').firestore();
    await assertFails(
      getDocs(collection(staff, 'companies', 'a', 'taskExceptions')),
    );
  });
});
