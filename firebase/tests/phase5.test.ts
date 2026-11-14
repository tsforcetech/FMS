import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
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
  saveProgress,
  submitTask,
  reviewTask,
  reportException,
  type NewTask,
} from '../../apps/admin-web/src/management/tasksStore';
import {
  linkStaff,
  updateStaffScope,
  listStaffLinks,
  resolveStaff,
  myTasksBetween,
  myTasksByStatus,
  myWorkOrders,
  myReportedIssues,
  scopeTasks,
  staffTaskEvents,
  staffSubmission,
  staffApproval,
  myShiftContext,
  type StaffAccess,
} from '../../apps/admin-web/src/management/staffStore';
import {
  createCase,
  emptyCase,
  getCase,
  transitionCase,
} from '../../apps/admin-web/src/management/casesStore';
import { listNotifications } from '../../apps/admin-web/src/management/notifyStore';

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
    projectId: 'demo-facilityos-phase5',
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
const access = async (db: Firestore, uid: string) => {
  const a = await resolveStaff(db, 'a', uid);
  if (!('link' in a)) throw new Error('not staff: ' + a.reason);
  return a as StaffAccess;
};
const day = (n: number) => new Date(Date.now() + n * 86400000);

describe('identity linking', () => {
  it('links one login to one active employee and resolves identity from the link', async () => {
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
    await linkStaff(owner, 'a', 'ownera', {
      uid: 'revokeda',
      employeeId: w.eRev,
      siteIds: [w.s1],
      allSites: false,
    });
    // One employee per login and one login per employee.
    await expect(
      linkStaff(owner, 'a', 'ownera', {
        uid: 'techa',
        employeeId: w.e2,
        siteIds: [w.s1],
        allSites: false,
      }),
    ).rejects.toThrow('another employee');
    await expect(
      linkStaff(owner, 'a', 'ownera', {
        uid: 'nolinka',
        employeeId: w.e1,
        siteIds: [w.s1],
        allSites: false,
      }),
    ).rejects.toThrow('another login');
    // Forged writes and self-linking are denied.
    const forged = {
      companyId: 'a',
      schemaVersion: 1,
      uid: 'nolinka',
      employeeId: w.eOff,
      siteIds: [],
      allSites: true,
      status: 'active',
      note: '',
      createdAt: serverTimestamp(),
      createdBy: 'nolinka',
      updatedAt: serverTimestamp(),
      updatedBy: 'nolinka',
      revision: 1,
    };
    await assertFails(
      setDoc(
        doc(fs('nolinka'), 'companies', 'a', 'staffLinks', 'nolinka'),
        forged,
      ),
    );
    await assertFails(
      setDoc(doc(owner, 'companies', 'a', 'staffLinks', 'nolinka'), {
        ...forged,
        createdBy: 'ownera',
        updatedBy: 'ownera',
      }),
    );
    await assertFails(
      updateDoc(doc(tech, 'companies', 'a', 'staffLinks', 'techa'), {
        allSites: true,
      }),
    );
    // Customers and inactive employees cannot be linked.
    await expect(
      linkStaff(owner, 'a', 'ownera', {
        uid: 'customera',
        employeeId: w.eOff,
        siteIds: [w.s1],
        allSites: false,
      }),
    ).rejects.toThrow();
    const a = await access(tech, 'techa');
    expect(a.employee.id).toBe(w.e1);
    expect(a.supervisor).toBe(false);
    expect((await access(sup, 'supa')).supervisor).toBe(true);
    expect(
      (await resolveStaff(fs('nolinka'), 'a', 'nolinka')) as { reason: string },
    ).toMatchObject({ reason: 'no-link' });
    expect((await listStaffLinks(owner, 'a')).length).toBe(4);
    await assertFails(
      getDocs(collection(tech, 'companies', 'a', 'staffLinks')),
    );
  });
  it('denies revoked links, inactive employees and revoked memberships', async () => {
    const links = await listStaffLinks(owner, 'a');
    await updateStaffScope(
      owner,
      'a',
      'ownera',
      links.find((l) => l.uid === 'revokeda')!,
      { status: 'revoked' },
    );
    expect(await resolveStaff(fs('revokeda'), 'a', 'revokeda')).toMatchObject({
      reason: 'revoked',
    });
    await assertFails(
      getDoc(doc(fs('revokeda'), 'companies', 'a', 'sites', w.s1)),
    );
    // Revoked employee claim can be moved to a new login.
    await linkStaff(owner, 'a', 'ownera', {
      uid: 'nolinka',
      employeeId: w.eRev,
      siteIds: [w.s1],
      allSites: false,
    });
    expect((await access(fs('nolinka'), 'nolinka')).employee.id).toBe(w.eRev);
    // Suspended employee: access is denied immediately.
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(
        doc(c.firestore(), 'companies', 'a', 'employees', w.eRev),
        { status: 'suspended' },
      );
    });
    expect(await resolveStaff(fs('nolinka'), 'a', 'nolinka')).toMatchObject({
      reason: 'inactive-employee',
    });
    await assertFails(
      getDoc(doc(fs('nolinka'), 'companies', 'a', 'sites', w.s1)),
    );
    // Inactive membership.
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(
        doc(c.firestore(), 'companies', 'a', 'members', 'nolinka'),
        { status: 'inactive' },
      );
    });
    expect(await resolveStaff(fs('nolinka'), 'a', 'nolinka')).toMatchObject({
      reason: 'inactive-member',
    });
    // Signed-out (expired) sessions get nothing.
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(
      getDoc(doc(anon, 'companies', 'a', 'staffLinks', 'techa')),
    );
    await assertFails(
      getDocs(
        query(
          collection(anon, 'companies', 'a', 'tasks'),
          where('assigneeIds', 'array-contains', w.e1),
        ),
      ),
    );
  });
});

describe('scoped reads', () => {
  it('shows staff only their own tasks and permitted reference data', async () => {
    const mine = await task();
    const theirs = await task({ assigneeIds: [w.e2], title: 'Other' });
    const a = await access(tech, 'techa');
    const list = await myTasksBetween(
      tech,
      'a',
      a.employee.id,
      day(-1),
      day(2),
    );
    expect(list.map((t) => t.id)).toContain(mine);
    expect(list.map((t) => t.id)).not.toContain(theirs);
    await assertFails(getDoc(doc(tech, 'companies', 'a', 'tasks', theirs)));
    await assertFails(getDocs(collection(tech, 'companies', 'a', 'tasks')));
    await assertFails(
      getDocs(
        query(
          collection(tech, 'companies', 'a', 'tasks'),
          where('assigneeIds', 'array-contains', w.e2),
        ),
      ),
    );
    // Reference data: own employee, sites in scope, no clients/suppliers/other employees/schedules.
    await assertSucceeds(
      getDoc(doc(tech, 'companies', 'a', 'employees', w.e1)),
    );
    await assertFails(getDoc(doc(tech, 'companies', 'a', 'employees', w.e2)));
    await assertSucceeds(getDoc(doc(tech, 'companies', 'a', 'sites', w.s1)));
    await assertFails(getDoc(doc(tech, 'companies', 'a', 'sites', w.s2)));
    await assertSucceeds(
      getDoc(doc(tech, 'companies', 'a', 'locations', w.loc1)),
    );
    await assertFails(getDocs(collection(tech, 'companies', 'a', 'clients')));
    await assertFails(getDocs(collection(tech, 'companies', 'a', 'suppliers')));
    await assertFails(
      getDocs(collection(tech, 'companies', 'a', 'recurringSchedules')),
    );
    await assertFails(
      getDocs(collection(tech, 'companies', 'a', 'templateVersions')),
    );
    await assertFails(getDocs(collection(tech, 'companies', 'a', 'members')));
    await assertSucceeds(
      getDocs(
        query(
          collection(tech, 'companies', 'a', 'members'),
          where('role', 'in', ['owner', 'admin']),
        ),
      ),
    );
    // Shift context reads only own records.
    await myShiftContext(tech, 'a', w.e1);
    await assertFails(
      getDocs(
        query(
          collection(tech, 'companies', 'a', 'leaveRecords'),
          where('employeeId', '==', w.e2),
        ),
      ),
    );
    // Supervisor sees tasks in scope sites, including other employees'.
    await assertSucceeds(getDoc(doc(sup, 'companies', 'a', 'tasks', theirs)));
    expect(
      (await scopeTasks(sup, 'a', await access(sup, 'supa'), 'assigned'))
        .length,
    ).toBeGreaterThanOrEqual(2);
  });
  it('separates companies', async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(
        doc(c.firestore(), 'companies', 'b', 'staffLinks', 'techb'),
        {
          companyId: 'b',
          schemaVersion: 1,
          uid: 'techb',
          employeeId: 'eb',
          siteIds: [],
          allSites: true,
          status: 'active',
          note: '',
          createdAt: Timestamp.now(),
          createdBy: 'ownerb',
          updatedAt: Timestamp.now(),
          updatedBy: 'ownerb',
          revision: 1,
        },
      );
      await setDoc(doc(c.firestore(), 'companies', 'b', 'employees', 'eb'), {
        status: 'active',
        name: 'B tech',
      });
    });
    const techb = fs('techb');
    expect(await resolveStaff(techb, 'b', 'techb')).toHaveProperty('link');
    expect(await resolveStaff(techb, 'a', 'techb')).not.toHaveProperty('link');
    await assertFails(
      getDocs(
        query(
          collection(techb, 'companies', 'a', 'tasks'),
          where('assigneeIds', 'array-contains', w.e1),
        ),
      ),
    );
    await assertFails(getDoc(doc(techb, 'companies', 'a', 'sites', w.s1)));
    await assertFails(getDoc(doc(tech, 'companies', 'b', 'employees', 'eb')));
  });
});

describe('execution, review and rework', () => {
  it('runs start → pause → resume → save → submit → rework → resubmit → approve with history', async () => {
    const id = await task();
    const t = () => getTask(tech, 'a', id).then((x) => x!);
    await transitionTask(tech, 'a', 'techa', await t(), 'start');
    await transitionTask(tech, 'a', 'techa', await t(), 'pause');
    await transitionTask(tech, 'a', 'techa', await t(), 'resume');
    await saveProgress(tech, 'a', 'techa', await t(), { q1: 'pass' });
    expect((await t()).draftAnswers).toEqual({ q1: 'pass' });
    // Concurrent edit: a stale copy cannot overwrite the newer revision.
    const stale = await t();
    await saveProgress(tech, 'a', 'techa', await t(), { q1: 'pass', q2: '14' });
    await expect(
      saveProgress(tech, 'a', 'techa', stale, { q1: 'fail' }),
    ).rejects.toThrow('updated by someone else');
    // Required and conditional validation.
    await expect(
      submitTask(tech, 'a', 'techa', await t(), { q1: 'fail', q2: '14' }, ''),
    ).rejects.toThrow('required');
    // Staff cannot assign, cancel or reschedule.
    await expect(
      transitionTask(tech, 'a', 'techa', await t(), 'cancel', { note: 'x' }),
    ).rejects.toThrow();
    const r = await submitTask(
      tech,
      'a',
      'techa',
      await t(),
      { q1: 'fail', q2: '25', q3: 'Water leaking from drain pan' },
      'Leak seen',
    );
    expect(r.exceptions.length).toBeGreaterThan(0);
    expect((await t()).status).toBe('awaiting_approval');
    // Duplicate submission and self-approval are refused.
    await expect(
      submitTask(tech, 'a', 'techa', await t(), { q1: 'pass', q2: '14' }, ''),
    ).rejects.toThrow();
    await expect(
      reviewTask(tech, 'a', 'techa', await t(), 'approve', ''),
    ).rejects.toThrow();
    await assertFails(
      getDoc(doc(tech2, 'companies', 'a', 'taskSubmissions', `${id}_1`)),
    );
    // Supervisor in scope requests rework; the technician restarts with a new attempt.
    await reviewTask(
      sup,
      'a',
      'supa',
      await getTask(sup, 'a', id).then((x) => x!),
      'request_rework',
      'Re-check drain pan',
    );
    expect((await t()).status).toBe('rework_required');
    expect((await staffApproval(tech, 'a', id, 1))?.reason).toBe(
      'Re-check drain pan',
    );
    await transitionTask(tech, 'a', 'techa', await t(), 'restart');
    await submitTask(
      tech,
      'a',
      'techa',
      await t(),
      { q1: 'pass', q2: '15' },
      'Cleaned',
    );
    await reviewTask(
      sup,
      'a',
      'supa',
      await getTask(sup, 'a', id).then((x) => x!),
      'approve',
      '',
    );
    expect((await t()).status).toBe('completed');
    // History preserved: both attempts and both decisions remain; nothing can be edited.
    expect((await staffSubmission(tech, 'a', id, 1))?.remarks).toBe(
      'Leak seen',
    );
    expect((await staffSubmission(tech, 'a', id, 2))?.remarks).toBe('Cleaned');
    await assertFails(
      updateDoc(doc(tech, 'companies', 'a', 'taskSubmissions', `${id}_1`), {
        remarks: 'changed',
      }),
    );
    const events = await staffTaskEvents(tech, 'a', await t());
    expect(events.map((e) => e.action)).toEqual([
      'create',
      'start',
      'pause',
      'resume',
      'submit',
      'request_rework',
      'restart',
      'submit',
      'approve',
    ]);
    expect(
      (await myTasksByStatus(tech, 'a', w.e1, ['completed'], true)).some(
        (x) => x.id === id,
      ),
    ).toBe(true);
    // The technician was notified of rework and approval.
    const notes = await listNotifications(tech, 'a', 'techa');
    expect(
      notes.some((n) => n.type === 'task_rework' && n.recordId === id),
    ).toBe(true);
    expect(
      notes.some((n) => n.type === 'task_approved' && n.recordId === id),
    ).toBe(true);
  });
  it('blocks unassigned staff and revoked site scope', async () => {
    const id = await task();
    await expect(
      transitionTask(
        tech2,
        'a',
        'tech2a',
        (await getTask(owner, 'a', id))!,
        'start',
      ),
    ).rejects.toThrow();
    // Remove the site from the technician's scope: assigned work at that site can no longer be executed.
    const link = (await listStaffLinks(owner, 'a')).find(
      (l) => l.uid === 'techa',
    )!;
    await updateStaffScope(owner, 'a', 'ownera', link, { siteIds: [w.s2] });
    await expect(
      transitionTask(
        tech,
        'a',
        'techa',
        (await getTask(tech, 'a', id))!,
        'start',
      ),
    ).rejects.toThrow();
    await assertFails(getDoc(doc(tech, 'companies', 'a', 'sites', w.s1)));
    await updateStaffScope(
      owner,
      'a',
      'ownera',
      (await listStaffLinks(owner, 'a')).find((l) => l.uid === 'techa')!,
      { siteIds: [w.s1] },
    );
    // Supervisor scope removal hides the site's tasks.
    const supLink = (await listStaffLinks(owner, 'a')).find(
      (l) => l.uid === 'supa',
    )!;
    await updateStaffScope(owner, 'a', 'ownera', supLink, { siteIds: [w.s2] });
    await assertFails(getDoc(doc(sup, 'companies', 'a', 'tasks', id)));
    await updateStaffScope(
      owner,
      'a',
      'ownera',
      (await listStaffLinks(owner, 'a')).find((l) => l.uid === 'supa')!,
      { siteIds: [w.s1] },
    );
    await assertSucceeds(getDoc(doc(sup, 'companies', 'a', 'tasks', id)));
  });
});

describe('issues and work orders', () => {
  it('reports issues once, raises a work order, and runs permitted work-order actions', async () => {
    const id = await task();
    await transitionTask(
      tech,
      'a',
      'techa',
      (await getTask(tech, 'a', id))!,
      'start',
    );
    const t = (await getTask(tech, 'a', id))!;
    const x1 = await reportException(
      tech,
      'a',
      'techa',
      t,
      {
        type: 'Water leakage',
        severity: 'critical',
        description: 'Leak under AHU',
        questionId: 'q1',
      },
      'exP5a',
    );
    const x2 = await reportException(
      tech,
      'a',
      'techa',
      t,
      {
        type: 'Water leakage',
        severity: 'critical',
        description: 'Leak under AHU',
        questionId: 'q1',
      },
      'exP5a',
    );
    expect(x1).toBe(x2);
    expect(
      (await myReportedIssues(tech, 'a', 'techa')).filter(
        (x) => x.id === 'exP5a',
      ),
    ).toHaveLength(1);
    await assertFails(
      getDoc(doc(tech2, 'companies', 'a', 'taskExceptions', 'exP5a')),
    );
    const wo = {
      ...emptyCase('workOrders'),
      title: 'Leak under AHU',
      siteId: w.s1,
      locationId: w.loc1,
      sourceType: 'task_exception',
      sourceId: 'exP5a',
      reportedBy: 'Tech A',
      severity: 'critical' as const,
    };
    const r1 = await createCase(tech, 'a', 'techa', 'workOrders', wo);
    const r2 = await createCase(tech, 'a', 'techa', 'workOrders', wo);
    expect(r1.created).toBe(true);
    expect(r2.created).toBe(false);
    // Staff cannot raise work orders outside scope or complaints.
    await expect(
      createCase(tech, 'a', 'techa', 'workOrders', {
        ...wo,
        sourceId: '',
        sourceType: 'staff',
        siteId: w.s2,
      }),
    ).rejects.toThrow();
    await expect(
      createCase(tech, 'a', 'techa', 'complaints', {
        ...emptyCase('complaints'),
        title: 'x',
        siteId: w.s1,
      }),
    ).rejects.toThrow();
    // Owner assigns a work order to the technician; the technician works it within the state machine.
    const { id: woId } = await createCase(owner, 'a', 'ownera', 'workOrders', {
      ...emptyCase('workOrders'),
      title: 'Replace light',
      siteId: w.s1,
    });
    await transitionCase(
      owner,
      'a',
      'ownera',
      (await getCase(owner, 'a', 'workOrders', woId))!,
      'assign',
      { assigneeIds: [w.e1] },
    );
    const a = await access(tech, 'techa');
    expect(
      (await myWorkOrders(tech, 'a', a, 'techa')).map((x) => x.id),
    ).toEqual(expect.arrayContaining([woId, r1.id]));
    await assertFails(getDoc(doc(tech2, 'companies', 'a', 'workOrders', woId)));
    const g = () => getCase(tech, 'a', 'workOrders', woId).then((x) => x!);
    await transitionCase(tech, 'a', 'techa', await g(), 'start');
    await transitionCase(tech, 'a', 'techa', await g(), 'note', {
      note: 'Assistance requested: need ladder',
    });
    expect((await g()).status).toBe('in_progress');
    await expect(
      transitionCase(tech, 'a', 'techa', await g(), 'cancel', { note: 'x' }),
    ).rejects.toThrow();
    await transitionCase(tech, 'a', 'techa', await g(), 'resolve', {
      note: 'Replaced tube',
    });
    await expect(
      transitionCase(tech, 'a', 'techa', await g(), 'verify'),
    ).rejects.toThrow();
    await transitionCase(
      sup,
      'a',
      'supa',
      (await getCase(sup, 'a', 'workOrders', woId))!,
      'verify',
    );
    expect((await g()).status).toBe('verified');
  });
  it('keeps notifications recipient-scoped', async () => {
    const mine = await listNotifications(tech, 'a', 'techa');
    expect(mine.every((n) => n.recipientUid === 'techa')).toBe(true);
    await assertFails(
      getDocs(
        query(
          collection(tech, 'companies', 'a', 'notifications'),
          where('recipientUid', '==', 'tech2a'),
        ),
      ),
    );
    // Staff may notify reviewers but cannot forge other notification types.
    await assertFails(
      setDoc(doc(tech, 'companies', 'a', 'notifications', 'forge1'), {
        companyId: 'a',
        schemaVersion: 1,
        recipientUid: 'tech2a',
        type: 'sla_breach',
        title: 'x',
        body: '',
        recordKind: 'tasks',
        recordId: 'x',
        createdAt: serverTimestamp(),
        createdBy: 'techa',
        readAt: null,
      }),
    );
  });
});
