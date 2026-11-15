import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
  Timestamp,
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
  listVersions,
  createTask,
  getTask,
  transitionTask,
  submitTask,
  type NewTask,
} from '../../apps/admin-web/src/management/tasksStore';
import {
  linkStaff,
  updateStaffScope,
  listStaffLinks,
  resolveStaff,
  myReportedIssues,
  staffTaskEvents,
  staffSubmission,
} from '../../apps/admin-web/src/management/staffStore';
import {
  checkIn,
  checkOut,
  correctAttendance,
  getAttendance,
  myAttendance,
  recordEvidence,
  getEvidence,
} from '../../apps/admin-web/src/management/fieldStore';
import { toLocal } from '../../packages/shared/src';
import { firestoreExecutor } from '../../apps/mobile/src/offline/executor';
import { OpQueue, runSync } from '../../apps/mobile/src/offline/sync';
import {
  Vault,
  memoryKV,
  memoryKeys,
} from '../../apps/mobile/src/offline/vault';
import { TaskRepo, localApply } from '../../apps/mobile/src/offline/repo';

let env: RulesTestEnvironment;
const fs = (uid: string) =>
  env.authenticatedContext(uid).firestore() as unknown as Firestore;
let owner: Firestore, sup: Firestore, tech: Firestore, tech2: Firestore;
const meta = {
  schemaVersion: 1,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  createdBy: 'operator',
  updatedBy: 'operator',
};
const members: [string, string, string][] = [
  ['a', 'ownera', 'owner'],
  ['a', 'supa', 'supervisor'],
  ['a', 'techa', 'technician'],
  ['a', 'tech2a', 'technician'],
  ['a', 'nolinka', 'technician'],
  ['a', 'revokeda', 'staff'],
  ['a', 'customera', 'customer'],
  ['b', 'ownerb', 'owner'],
  ['b', 'techb', 'technician'],
];
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw new Error('Emulator required');
  env = await initializeTestEnvironment({
    projectId: 'demo-facilityos-phase6',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firebase/firestore.rules', 'utf8'),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    for (const companyId of ['a', 'b'])
      await setDoc(doc(c.firestore(), 'companies', companyId), {
        ...meta,
        companyId,
        name: companyId.toUpperCase(),
        status: 'active',
        timeZone: 'Asia/Dubai',
      });
    for (const [companyId, uid, role] of members)
      await setDoc(doc(c.firestore(), 'companies', companyId, 'members', uid), {
        ...meta,
        companyId,
        uid,
        role,
        status: 'active',
      });
  });
  owner = fs('ownera');
  sup = fs('supa');
  tech = fs('techa');
  tech2 = fs('tech2a');
});
afterAll(async () => {
  await env?.cleanup();
});
let seq = 0;
const create = (kind: Kind, v: Values = {}, db = owner, c = 'a') =>
  saveRecord(db, c, c === 'a' ? 'ownera' : 'ownerb', kind, {
    ...defaultValues(kind),
    code: `P5X${++seq}`,
    name: `Record ${seq}`,
    ...v,
  });
function checklist(): VersionContent {
  const c = emptyContent('AC inspection');
  const q1 = {
    ...newQuestion('s1', 'pass_fail'),
    id: 'q1',
    label: 'AC cooling',
  };
  const q2 = {
    ...newQuestion('s1', 'temperature', [q1]),
    id: 'q2',
    label: 'Supply air',
    min: -10,
    max: 60,
    expectedMin: 12,
    expectedMax: 18,
  };
  const q3 = {
    ...newQuestion('s1', 'text', [q1, q2]),
    id: 'q3',
    label: 'Describe the fault',
    showIf: { questionId: 'q1', equals: 'fail' },
  };
  return {
    ...c,
    approvalRequired: true,
    questions: [q1, q2, q3],
    raci: [
      {
        id: 'r1',
        letter: 'R',
        kind: 'designation',
        refId: 't',
        label: 'Technician',
        siteId: '',
      },
      {
        id: 'r2',
        letter: 'A',
        kind: 'designation',
        refId: 's',
        label: 'Supervisor',
        siteId: '',
      },
    ],
  };
}
type World = Awaited<ReturnType<typeof world>>;
async function world() {
  const s1 = await create('sites');
  const s2 = await create('sites');
  const loc1 = await create('locations', { siteId: s1 });
  const dep = await create('departments');
  const des = await create('designations', { departmentId: dep });
  const emp = (v: Values) =>
    create('employees', {
      joiningDate: '2026-01-05',
      departmentId: dep,
      designationId: des,
      primarySiteId: s1,
      ...v,
    });
  const e1 = await emp({ linkedUid: 'techa' });
  const e2 = await emp({ linkedUid: 'tech2a' });
  const eSup = await emp({ linkedUid: 'supa' });
  const eRev = await emp({});
  const eOff = await emp({});
  const cat = await create('taskCategories');
  const tpl = await create('taskTemplates', { categoryId: cat });
  const versionId = await createDraft(owner, 'a', 'ownera', tpl, checklist());
  const [v] = await listVersions(owner, 'a', tpl);
  await saveDraft(owner, 'a', 'ownera', v, v.content, true);
  return { s1, s2, loc1, dep, e1, e2, eSup, eRev, eOff, versionId };
}
let w: World;
const task = (v: Partial<NewTask> = {}) =>
  createTask(owner, 'a', 'ownera', {
    versionId: w.versionId,
    title: 'AC Inspection – Floor 2',
    siteId: w.s1,
    locationId: w.loc1,
    facilityId: '',
    assetId: '',
    departmentId: w.dep,
    assigneeIds: [w.e1],
    teamId: '',
    priority: 'high',
    plannedStart: '',
    dueAt: new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 16),
    notes: '',
    ...v,
  });

const today = () => toLocal(new Date(), 'Asia/Dubai').date;
describe('phase 6 field operations', () => {
  it('sets up linked staff', async () => {
    w = await world();
    await linkStaff(owner, 'a', 'ownera', {
      uid: 'techa',
      employeeId: w.e1,
      siteIds: [w.s1],
      allSites: false,
    });
    await linkStaff(owner, 'a', 'ownera', {
      uid: 'tech2a',
      employeeId: w.e2,
      siteIds: [w.s1],
      allSites: false,
    });
    await linkStaff(owner, 'a', 'ownera', {
      uid: 'supa',
      employeeId: w.eSup,
      siteIds: [w.s1],
      allSites: false,
    });
  });
  it('checks in once per day, checks out once, and protects attendance history', async () => {
    const date = today();
    const loc = {
      lat: 25.08,
      lng: 55.14,
      accuracy: 12,
      capturedAt: new Date(),
    };
    const r1 = await checkIn(tech, 'a', 'techa', {
      employeeId: w.e1,
      date,
      siteId: w.s1,
      shiftId: '',
      lateMinutes: 5,
      location: loc,
      source: 'mobile',
    });
    const r2 = await checkIn(tech, 'a', 'techa', {
      employeeId: w.e1,
      date,
      siteId: w.s1,
      shiftId: '',
      lateMinutes: 5,
      location: loc,
      source: 'mobile',
    });
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    // Forged identity, out-of-scope site, wrong day and client-chosen time are refused.
    await expect(
      checkIn(tech, 'a', 'techa', {
        employeeId: w.e2,
        date,
        siteId: w.s1,
        shiftId: '',
        lateMinutes: 0,
        location: null,
        source: 'mobile',
      }),
    ).rejects.toThrow();
    await expect(
      checkIn(tech2, 'a', 'tech2a', {
        employeeId: w.e2,
        date,
        siteId: w.s2,
        shiftId: '',
        lateMinutes: 0,
        location: null,
        source: 'mobile',
      }),
    ).rejects.toThrow();
    await expect(
      checkIn(tech2, 'a', 'tech2a', {
        employeeId: w.e2,
        date: '2026-01-01',
        siteId: w.s1,
        shiftId: '',
        lateMinutes: 0,
        location: null,
        source: 'mobile',
      }),
    ).rejects.toThrow();
    await assertFails(
      setDoc(doc(tech2, 'companies', 'a', 'attendance', `${w.e2}_${date}`), {
        companyId: 'a',
        schemaVersion: 1,
        employeeId: w.e2,
        uid: 'tech2a',
        date,
        siteId: w.s1,
        shiftId: '',
        checkInAt: Timestamp.fromDate(new Date(Date.now() - 3600000)),
        checkInLocation: null,
        checkOutAt: null,
        checkOutLocation: null,
        status: 'checked_in',
        lateMinutes: 0,
        source: 'mobile',
        correction: null,
        revision: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'tech2a',
      }),
    );
    const id = r1.id;
    await checkOut(tech, 'a', 'techa', id, loc);
    await checkOut(tech, 'a', 'techa', id, loc); // idempotent retry
    let a = (await getAttendance(tech, 'a', id))!;
    expect(a.status).toBe('checked_out');
    // Staff cannot rewrite their own times; other staff cannot read them.
    await assertFails(
      updateDoc(doc(tech, 'companies', 'a', 'attendance', id), {
        checkInAt: Timestamp.now(),
        revision: a.revision + 1,
        updatedAt: serverTimestamp(),
        updatedBy: 'techa',
      }),
    );
    await assertFails(getDoc(doc(tech2, 'companies', 'a', 'attendance', id)));
    expect((await myAttendance(tech, 'a', w.e1)).map((x) => x.id)).toContain(
      id,
    );
    // Supervisor in scope corrects with a reason; self-correction is refused.
    await expect(
      correctAttendance(
        sup,
        'a',
        'supa',
        a,
        new Date(Date.now() - 8 * 3600000),
        new Date(),
        '',
      ),
    ).rejects.toThrow('reason');
    await correctAttendance(
      sup,
      'a',
      'supa',
      a,
      new Date(Date.now() - 8 * 3600000),
      new Date(),
      'Forgot to check in at the gate',
    );
    a = (await getAttendance(owner, 'a', id))!;
    expect(a.status).toBe('corrected');
    expect(a.correction?.by).toBe('supa');
    const sid = (
      await checkIn(sup, 'a', 'supa', {
        employeeId: w.eSup,
        date,
        siteId: w.s1,
        shiftId: '',
        lateMinutes: 0,
        location: null,
        source: 'mobile',
      })
    ).id;
    const own = (await getAttendance(sup, 'a', sid))!;
    await expect(
      correctAttendance(
        sup,
        'a',
        'supa',
        own,
        new Date(Date.now() - 3600000),
        null,
        'Self',
      ),
    ).rejects.toThrow();
  });
  it('records verified QR and GPS evidence only for the assigned, in-progress task', async () => {
    const asset = await create('assets', {
      siteId: w.s1,
      locationId: w.loc1,
      categoryId: await create('assetCategories'),
    });
    const id = await task({ assetId: asset });
    let t = (await getTask(tech, 'a', id))!;
    const target = { kind: 'assets' as const, id: asset };
    await expect(
      recordEvidence(tech, 'a', 'techa', w.e1, t, 'q1', {
        type: 'qr',
        target,
        capturedAt: new Date(),
      }),
    ).rejects.toThrow();
    await transitionTask(tech, 'a', 'techa', t, 'start');
    t = (await getTask(tech, 'a', id))!;
    await expect(
      recordEvidence(tech, 'a', 'techa', w.e1, t, 'q1', {
        type: 'qr',
        target: { kind: 'assets', id: 'someOtherAsset' },
        capturedAt: new Date(),
      }),
    ).rejects.toThrow('does not belong');
    await recordEvidence(tech, 'a', 'techa', w.e1, t, 'q1', {
      type: 'qr',
      target,
      capturedAt: new Date(),
    });
    await recordEvidence(tech, 'a', 'techa', w.e1, t, 'q1', {
      type: 'qr',
      target,
      capturedAt: new Date(),
    }); // retry is a no-op
    await recordEvidence(tech, 'a', 'techa', w.e1, t, 'q2', {
      type: 'gps',
      location: { lat: 25.1, lng: 55.2, accuracy: 18, capturedAt: new Date() },
    });
    expect((await getEvidence(tech, 'a', t, 'q1'))?.status).toBe('verified');
    expect((await getEvidence(sup, 'a', t, 'q2'))?.location?.accuracy).toBe(18);
    // A forged mismatch written directly is refused; other staff cannot read or write.
    await assertFails(
      setDoc(doc(tech, 'companies', 'a', 'taskEvidence', `${id}_1_q3`), {
        companyId: 'a',
        schemaVersion: 1,
        taskId: id,
        attempt: 1,
        questionId: 'q3',
        type: 'qr',
        refKind: 'assets',
        refId: 'forged',
        location: null,
        capturedAt: Timestamp.now(),
        recordedAt: serverTimestamp(),
        uid: 'techa',
        employeeId: w.e1,
        status: 'verified',
      }),
    );
    await expect(
      recordEvidence(tech2, 'a', 'tech2a', w.e2, t, 'q4', {
        type: 'gps',
        location: { lat: 1, lng: 1, accuracy: 5, capturedAt: new Date() },
      }),
    ).rejects.toThrow();
    await assertFails(
      getDoc(doc(tech2, 'companies', 'a', 'taskEvidence', `${id}_1_q1`)),
    );
  });
});
describe('phase 6 offline synchronization', () => {
  const queue = () => new OpQueue(new Vault('techa', memoryKeys(), memoryKV()));
  const base = { companyId: 'a', uid: 'techa', employeeId: '' };
  it('applies a whole offline session (start, save, submit) once, even when re-run', async () => {
    const id = await task();
    const q = queue();
    const t0 = (await getTask(tech, 'a', id))!;
    await q.add({
      ...base,
      employeeId: w.e1,
      id: 'op1',
      taskId: id,
      type: 'start',
      baseRevision: t0.revision,
      payload: {},
    });
    await q.add({
      ...base,
      employeeId: w.e1,
      id: 'op2',
      taskId: id,
      type: 'save_progress',
      baseRevision: t0.revision + 1,
      payload: { answers: { q1: 'pass' } },
    });
    await q.add({
      ...base,
      employeeId: w.e1,
      id: 'op3',
      taskId: id,
      type: 'submit',
      baseRevision: t0.revision + 2,
      payload: { answers: { q1: 'pass', q2: '15' }, remarks: 'Offline' },
    });
    const r = await runSync(q, firestoreExecutor(tech, 'techa'));
    expect(r).toMatchObject({ applied: 3, conflicts: 0 });
    expect((await getTask(tech, 'a', id))!.status).toBe('awaiting_approval');
    // Lost acknowledgement: the same operations replayed are recognised, not repeated.
    const again = queue();
    await again.add({
      ...base,
      employeeId: w.e1,
      id: 'op1',
      taskId: id,
      type: 'start',
      baseRevision: t0.revision,
      payload: {},
    });
    await again.add({
      ...base,
      employeeId: w.e1,
      id: 'op3',
      taskId: id,
      type: 'submit',
      baseRevision: t0.revision + 2,
      payload: { answers: { q1: 'pass', q2: '15' } },
    });
    const r2 = await runSync(again, firestoreExecutor(tech, 'techa'));
    expect(r2).toMatchObject({ duplicates: 2, applied: 0, conflicts: 0 });
    expect(
      (
        await staffTaskEvents(tech, 'a', (await getTask(tech, 'a', id))!)
      ).filter((e) => e.action === 'submit'),
    ).toHaveLength(1);
  });
  it('reports a conflict instead of completing a task cancelled while offline', async () => {
    const id = await task();
    let t = (await getTask(tech, 'a', id))!;
    await transitionTask(tech, 'a', 'techa', t, 'start');
    t = (await getTask(tech, 'a', id))!;
    const q = queue();
    await q.add({
      ...base,
      employeeId: w.e1,
      id: 'c1',
      taskId: id,
      type: 'submit',
      baseRevision: t.revision,
      payload: { answers: { q1: 'pass', q2: '15' } },
    });
    await transitionTask(
      owner,
      'a',
      'ownera',
      (await getTask(owner, 'a', id))!,
      'cancel',
      { note: 'Area closed' },
    );
    const r = await runSync(q, firestoreExecutor(tech, 'techa'));
    console.log(
      'DBG',
      JSON.stringify({
        r,
        q: (await q.list()).map((o) => [o.status, o.lastError]),
      }),
    );
    expect(r.conflicts).toBe(1);
    expect((await q.list())[0].lastError).toMatch(/cancelled/);
    expect((await getTask(tech, 'a', id))!.status).toBe('cancelled');
  });
  it('never overwrites a checklist already submitted from Staff Web', async () => {
    const id = await task();
    await transitionTask(
      tech,
      'a',
      'techa',
      (await getTask(tech, 'a', id))!,
      'start',
    );
    const t = (await getTask(tech, 'a', id))!;
    const q = queue();
    await q.add({
      ...base,
      employeeId: w.e1,
      id: 'w1',
      taskId: id,
      type: 'save_progress',
      baseRevision: t.revision,
      payload: { answers: { q1: 'fail' } },
    });
    await submitTask(
      tech,
      'a',
      'techa',
      t,
      { q1: 'pass', q2: '14' },
      'From the web',
    ); // web wins first
    const r = await runSync(q, firestoreExecutor(tech, 'techa'));
    console.log(
      'DBG',
      JSON.stringify({
        r,
        q: (await q.list()).map((o) => [o.status, o.lastError]),
      }),
    );
    expect(r.conflicts).toBe(1);
    expect((await staffSubmission(tech, 'a', id, 1))?.remarks).toBe(
      'From the web',
    );
  });
  it('sends a queued issue once and blocks queued work after revocation', async () => {
    const id = await task();
    await transitionTask(
      tech,
      'a',
      'techa',
      (await getTask(tech, 'a', id))!,
      'start',
    );
    const q = queue();
    const issue = {
      category: 'Plumbing',
      severity: 'critical',
      description: 'Leak at pump',
      workOrder: true,
      reportedBy: 'Tech',
    };
    await q.add({
      ...base,
      employeeId: w.e1,
      id: 'issueP6a',
      taskId: id,
      type: 'report_issue',
      baseRevision: -1,
      payload: issue,
    });
    await runSync(q, firestoreExecutor(tech, 'techa'));
    const retry = queue();
    await retry.add({
      ...base,
      employeeId: w.e1,
      id: 'issueP6a',
      taskId: id,
      type: 'report_issue',
      baseRevision: -1,
      payload: issue,
    });
    await runSync(retry, firestoreExecutor(tech, 'techa'));
    expect(
      (await myReportedIssues(tech, 'a', 'techa')).filter(
        (x) => x.id === 'issueP6a',
      ),
    ).toHaveLength(1);
    expect((await listWorkOrdersBySource('issueP6a')).length).toBe(1);
    // Revoked while offline: nothing queued is sent.
    const t = (await getTask(tech, 'a', id))!;
    const blocked = queue();
    await blocked.add({
      ...base,
      employeeId: w.e1,
      id: 'r1',
      taskId: id,
      type: 'pause',
      baseRevision: t.revision,
      payload: {},
    });
    const link = (await listStaffLinks(owner, 'a')).find(
      (l) => l.uid === 'techa',
    )!;
    await updateStaffScope(owner, 'a', 'ownera', link, { status: 'revoked' });
    const r = await runSync(blocked, firestoreExecutor(tech, 'techa'));
    expect(r.revoked).toBe(true);
    expect((await blocked.list())[0].status).toBe('blocked');
    expect((await getTask(owner, 'a', id))!.status).toBe('in_progress');
    await updateStaffScope(
      owner,
      'a',
      'ownera',
      (await listStaffLinks(owner, 'a')).find((l) => l.uid === 'techa')!,
      { status: 'active' },
    );
  });
  it('keeps an encrypted offline copy of synchronized tasks with optimistic updates', async () => {
    const id = await task();
    const vault = new Vault('techa', memoryKeys(), memoryKV());
    const repo = new TaskRepo(vault, 'a');
    const a = await resolveStaff(tech, 'a', 'techa');
    if (!('link' in a)) throw new Error('not staff');
    await repo.save(a, [(await getTask(tech, 'a', id))!]);
    const cached = (await repo.get(id))!;
    expect(cached.dueAt.toMillis()).toBeGreaterThan(0);
    const next = localApply(cached, {
      ...base,
      employeeId: w.e1,
      id: 'x',
      taskId: id,
      type: 'start',
      baseRevision: cached.revision,
      payload: {},
      payloadVersion: 1,
      createdAt: '',
      status: 'pending',
      attempts: 0,
      lastError: '',
      lastAttemptAt: '',
    });
    expect(next.status).toBe('in_progress');
    expect(
      await new TaskRepo(
        new Vault('tech2a', memoryKeys(), memoryKV()),
        'a',
      ).get(id),
    ).toBeNull();
  });
});
async function listWorkOrdersBySource(sourceId: string) {
  return getDocs(
    query(
      collection(owner, 'companies', 'a', 'workOrders'),
      where('sourceId', '==', sourceId),
    ),
  ).then((r) => r.docs);
}
