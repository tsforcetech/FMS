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
  updateDoc,
  setDoc,
  collection,
  query,
  where,
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
  makeRule,
  occurrenceTaskId,
  type Kind,
  type Values,
  type VersionContent,
  type MovementInput,
} from '../../packages/shared/src';
import {
  saveRecord,
  postMovement,
} from '../../apps/admin-web/src/management/store';
import {
  createDraft,
  saveDraft,
  listVersions,
  getTask,
  transitionTask,
  taskEvents,
  type Task,
} from '../../apps/admin-web/src/management/tasksStore';
import {
  emptySchedule,
  saveSchedule,
  setScheduleStatus,
  getSchedule,
  runScheduler,
  scheduleTasks,
  rescheduleTask,
  moveSeries,
  listRuns,
  type ScheduleInput,
} from '../../apps/admin-web/src/management/scheduling';
import {
  createCase,
  emptyCase,
  transitionCase,
  getCase,
  caseEvents,
  workOrderFromComplaint,
  escalateFurther,
  breachedCases,
  workOrderMaterials,
  listCases,
} from '../../apps/admin-web/src/management/casesStore';
import {
  notify,
  listNotifications,
  markRead,
  unreadCount,
  savePreferences,
} from '../../apps/admin-web/src/management/notifyStore';

let env: RulesTestEnvironment;
let db: Firestore; // owner-a
let admin2: Firestore; // admin2-a
let staff: Firestore; // staff-a
let other: Firestore; // owner-b
const meta = {
  schemaVersion: 1,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  createdBy: 'operator',
  updatedBy: 'operator',
};
// Monday 16 Nov 2026, 08:00 in Dubai.
const NOW = new Date('2026-11-16T04:00:00Z');
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw new Error('Emulator required');
  env = await initializeTestEnvironment({
    projectId: 'demo-facilityos-phase4',
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
        [`staff${companyId}`, 'staff'],
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
  const fs = (uid: string) =>
    env.authenticatedContext(uid).firestore() as unknown as Firestore;
  db = fs('owner-a');
  admin2 = fs('admin2-a');
  staff = fs('staffa');
  other = fs('owner-b');
});
afterAll(async () => {
  await env?.cleanup();
});
let seq = 0;
const create = (kind: Kind, v: Values = {}, database = db, company = 'a') =>
  saveRecord(database, company, `owner-${company}`, kind, {
    ...defaultValues(kind),
    code: `P4X${++seq}`,
    name: `Record ${seq}`,
    ...v,
  });
function checklist(): VersionContent {
  const c = emptyContent('Chiller inspection');
  return {
    ...c,
    approvalRequired: false,
    estimatedMinutes: 45,
    questions: [
      { ...newQuestion('s1', 'pass_fail'), id: 'q1', label: 'Running' },
    ],
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
async function world() {
  const site = await create('sites', { timeZone: 'Asia/Dubai' });
  const department = await create('departments');
  const designation = await create('designations', {
    departmentId: department,
  });
  const emp = (v: Values = {}) =>
    create('employees', {
      joiningDate: '2026-01-05',
      departmentId: department,
      designationId: designation,
      primarySiteId: site,
      ...v,
    });
  const e1 = await emp({ linkedUid: 'staffa' });
  const e2 = await emp();
  const asset = await create('assets', {
    siteId: site,
    locationId: await create('locations', { siteId: site }),
    categoryId: await create('assetCategories'),
  });
  const category = await create('taskCategories');
  const template = await create('taskTemplates', { categoryId: category });
  const versionId = await createDraft(
    db,
    'a',
    'owner-a',
    template,
    checklist(),
  );
  const [v] = await listVersions(db, 'a', template);
  await saveDraft(db, 'a', 'owner-a', v, v.content, true);
  return { site, department, designation, e1, e2, asset, template, versionId };
}
type World = Awaited<ReturnType<typeof world>>;
const schedule = (w: World, v: Partial<ScheduleInput> = {}): ScheduleInput => ({
  ...emptySchedule('routine', 'Asia/Dubai', '2026-11-10'),
  code: `SCH${++seq}`,
  name: 'Daily chiller round',
  templateId: w.template,
  versionId: w.versionId,
  siteId: w.site,
  departmentId: w.department,
  localTime: '09:00',
  ...v,
});
const run = (id?: string, database = db, uid = 'owner-a', now = NOW) =>
  runScheduler(database, 'a', uid, { mode: 'manual', now, onlyScheduleId: id });

describe('recurring schedules and generation', () => {
  it('generates deterministic occurrences once, even when runs repeat or overlap', async () => {
    const w = await world();
    const id = await saveSchedule(db, 'a', 'owner-a', schedule(w));
    const first = await run(id);
    // 10 Nov → 23 Nov (today + 7 days) = 14 daily occurrences.
    expect(first.created).toBe(14);
    expect(first.status).toBe('ok');
    const again = await run(id);
    expect(again.created).toBe(0);
    // Overlapping runs by two administrators: nothing duplicated.
    const s = await getSchedule(db, 'a', id);
    await updateDoc(doc(db, 'companies', 'a', 'recurringSchedules', id), {
      generatedThrough: '',
      lastRunAt: serverTimestamp(),
    });
    const [r1, r2] = await Promise.all([run(id), run(id, admin2, 'admin2-a')]);
    expect(r1.created + r2.created).toBe(0);
    const tasks = await scheduleTasks(db, 'a', id, 100);
    expect(tasks).toHaveLength(14);
    expect(new Set(tasks.map((t) => t.occurrenceKey)).size).toBe(14);
    const t = tasks.find((x) => x.occurrenceKey.endsWith('202611160900'))!;
    expect(t.id).toBe(occurrenceTaskId(`${id}_r1_202611160900`));
    expect(t.plannedStart!.toDate().toISOString()).toBe(
      '2026-11-16T05:00:00.000Z',
    );
    expect(t.status).toBe('pending');
    expect(t.origin).toBe('schedule');
    expect(s!.ruleVersion).toBe(1);
    expect((await getSchedule(db, 'a', id))!.generatedThrough).toBe(
      '2026-11-23',
    );
    const runs = await listRuns(db, 'a');
    expect(runs[0].status).toBe('ok');
  });

  it('rejects forged occurrences, paused schedules and staff runs', async () => {
    const w = await world();
    const id = await saveSchedule(
      db,
      'a',
      'owner-a',
      schedule(w, {
        rule: makeRule({ type: 'once' }),
        startDate: '2026-11-18',
      }),
    );
    await run(id);
    const [t] = await scheduleTasks(db, 'a', id);
    const { id: _ignored, ...data } = t as Task & Record<string, unknown>;
    void _ignored;
    const forge = (key: string, extra: Record<string, unknown> = {}) => {
      const tid = occurrenceTaskId(key);
      const b = writeBatch(db);
      b.set(doc(db, 'companies', 'a', 'tasks', tid), {
        ...data,
        occurrenceKey: key,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...extra,
      });
      b.set(doc(db, 'companies', 'a', 'taskEvents', `${tid}_1`), {
        companyId: 'a',
        schemaVersion: 1,
        taskId: tid,
        revision: 1,
        action: 'create',
        fromStatus: '',
        toStatus: 'pending',
        actorUid: 'owner-a',
        at: serverTimestamp(),
        note: '',
        assigneeIds: [],
        attempt: 1,
      });
      return b.commit();
    };
    // Wrong rule version, foreign schedule, mismatched site, manual origin with a key.
    await assertFails(forge(`${id}_r2_202611190900`));
    await assertFails(
      forge(`${id}_r1_202611190900`, { siteId: await create('sites') }),
    );
    await assertFails(forge(`${id}_r1_202611190900`, { origin: 'manual' }));
    await assertSucceeds(forge(`${id}_r1_202611190900`));
    // Paused schedules cannot be used to create occurrences and generate nothing.
    const s = (await getSchedule(db, 'a', id))!;
    await setScheduleStatus(db, 'a', 'owner-a', s, 'paused');
    await assertFails(forge(`${id}_r1_202611200900`));
    const r = await run(id);
    expect(r.scheduleCount).toBe(0);
    // Staff and other companies cannot read or run schedules.
    await assertFails(
      getDoc(doc(staff, 'companies', 'a', 'recurringSchedules', id)),
    );
    await assertFails(
      getDoc(doc(other, 'companies', 'a', 'recurringSchedules', id)),
    );
    await expect(
      runScheduler(staff, 'a', 'staffa', { mode: 'manual', now: NOW }),
    ).rejects.toThrow();
  });

  it('assigns by round-robin, respects leave and shifts, and queues unassigned work', async () => {
    const w = await world();
    const rr = await saveSchedule(
      db,
      'a',
      'owner-a',
      schedule(w, {
        startDate: '2026-11-16',
        assignment: {
          strategy: 'round_robin',
          pool: 'department',
          refId: w.department,
          employeeIds: [],
          siteOnly: true,
        },
      }),
    );
    await create('leaveRecords', {
      employeeId: w.e2,
      startDate: '2026-11-20',
      endDate: '2026-11-21',
      status: 'approved',
    });
    await run(rr);
    const tasks = (await scheduleTasks(db, 'a', rr, 50)).sort((a, b) =>
      a.occurrenceKey.localeCompare(b.occurrenceKey),
    );
    expect(tasks).toHaveLength(8);
    const who = tasks.map((t) => t.assigneeIds[0]);
    expect(who[0]).not.toBe(who[1]); // alternates between the two
    expect(who[4]).toBe(w.e1); // 20 Nov: e2 on leave
    expect(who[5]).toBe(w.e1); // 21 Nov: e2 on leave
    const events = await taskEvents(db, 'a', tasks[0].id);
    expect(events[0].note).toMatch(/Round-robin/);
    // A shift pool with nobody on shift leaves the occurrence unassigned.
    const shift = await create('shifts', {
      siteId: w.site,
      startTime: '08:00',
      endTime: '16:00',
      workingDays: 'Mon,Tue,Wed,Thu,Fri',
    });
    await create('shiftAssignments', {
      employeeId: w.e1,
      shiftId: shift,
      startDate: '2026-11-01',
    });
    const sh = await saveSchedule(
      db,
      'a',
      'owner-a',
      schedule(w, {
        startDate: '2026-11-21',
        endDate: '2026-11-23',
        assignment: {
          strategy: 'least_workload',
          pool: 'shift',
          refId: shift,
          employeeIds: [],
          siteOnly: false,
        },
      }),
    );
    const res = await run(sh);
    const st = (await scheduleTasks(db, 'a', sh)).sort((a, b) =>
      a.occurrenceKey.localeCompare(b.occurrenceKey),
    );
    // Sat 21 and Sun 22 are outside Mon–Fri; Mon 23 has e1 on shift.
    expect(st.map((t) => t.assigneeIds.length)).toEqual([0, 0, 1]);
    expect(res.unassigned).toBe(2);
    expect((await getSchedule(db, 'a', sh))!.status).toBe('completed');
  });

  it('skips or moves holidays and handles DST time zones', async () => {
    const w = await world();
    await create('holidays', { holidayDate: '2026-11-18', siteId: w.site });
    const skip = await saveSchedule(
      db,
      'a',
      'owner-a',
      schedule(w, {
        startDate: '2026-11-17',
        endDate: '2026-11-19',
        holidayPolicy: 'skip',
      }),
    );
    await run(skip);
    expect((await scheduleTasks(db, 'a', skip)).length).toBe(2);
    const ny = await saveSchedule(
      db,
      'a',
      'owner-a',
      schedule(w, {
        startDate: '2027-03-14',
        endDate: '2027-03-14',
        localTime: '02:30',
        timeZone: 'America/New_York',
      }),
    );
    await run(ny, db, 'owner-a', new Date('2027-03-10T12:00:00Z'));
    const [t] = await scheduleTasks(db, 'a', ny);
    // 02:30 does not exist on the spring-forward day; it runs at 03:30 EDT.
    expect(t.plannedStart!.toDate().toISOString()).toBe(
      '2027-03-14T07:30:00.000Z',
    );
  });

  it('reschedules single occurrences and moves the series without duplicates', async () => {
    const w = await world();
    const id = await saveSchedule(
      db,
      'a',
      'owner-a',
      schedule(w, { startDate: '2026-11-16', endDate: '2026-11-22' }),
    );
    await run(id);
    const tasks = (await scheduleTasks(db, 'a', id)).sort((a, b) =>
      a.occurrenceKey.localeCompare(b.occurrenceKey),
    );
    const t = tasks[2];
    const start = new Date('2026-11-18T08:00:00Z');
    await rescheduleTask(
      db,
      'a',
      'owner-a',
      t,
      start,
      new Date(start.getTime() + 3600000),
      'Client request',
    );
    const moved = (await getTask(db, 'a', t.id))!;
    expect(moved.plannedStart!.toDate().toISOString()).toBe(
      start.toISOString(),
    );
    expect(moved.status).toBe(t.status);
    // Forged: a due-date change without its event, or a status change disguised as a reschedule.
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'tasks', t.id), {
        dueAt: Timestamp.now(),
        revision: moved.revision + 1,
        updatedAt: serverTimestamp(),
        updatedBy: 'owner-a',
      }),
    );
    // Cancelled work cannot be rescheduled.
    await transitionTask(db, 'a', 'owner-a', tasks[3], 'cancel', {
      note: 'Closed site',
    });
    await expect(
      rescheduleTask(
        db,
        'a',
        'owner-a',
        (await getTask(db, 'a', tasks[3].id))!,
        start,
        start,
        '',
      ),
    ).rejects.toThrow('cannot be rescheduled');
    // Move the series from 20 Nov to 11:00: old-version open occurrences from that day are cancelled and replaced.
    const s = (await getSchedule(db, 'a', id))!;
    const anchor = tasks[4];
    await moveSeries(
      db,
      'a',
      'owner-a',
      s,
      anchor,
      new Date('2026-11-20T07:00:00Z'),
      'future',
      NOW,
    );
    const s2 = (await getSchedule(db, 'a', id))!;
    expect(s2.ruleVersion).toBe(2);
    expect(s2.localTime).toBe('11:00');
    await run(id);
    const all = await scheduleTasks(db, 'a', id, 100);
    const open = all.filter((x) => !['cancelled'].includes(x.status));
    const days = open.map((x) => x.occurrenceKey.slice(-12, -4)).sort();
    expect(days).toEqual([
      '20261116',
      '20261117',
      '20261118',
      '20261120',
      '20261121',
      '20261122',
    ]);
    expect(open.filter((x) => x.occurrenceKey.includes('_r2_')).length).toBe(3);
  });
});

describe('work orders, complaints and escalations', () => {
  it('runs the work order lifecycle with reasons, SLA targets and history', async () => {
    const w = await world();
    await create('slaPolicies', {
      priority: 'high',
      appliesTo: 'all',
      responseMinutes: '60',
      resolutionMinutes: '240',
      hoursMode: 'calendar',
    });
    const { id } = await createCase(db, 'a', 'owner-a', 'workOrders', {
      ...emptyCase('workOrders'),
      title: 'Chiller trip',
      siteId: w.site,
      assetId: w.asset,
      priority: 'high',
    });
    let wo = (await getCase(db, 'a', 'workOrders', id))!;
    expect(wo.status).toBe('reported');
    expect(wo.resolutionDueAt!.toMillis() - wo.responseDueAt!.toMillis()).toBe(
      180 * 60000,
    );
    const step = async (
      action: string,
      o: Parameters<typeof transitionCase>[5] = {},
    ) => {
      await transitionCase(db, 'a', 'owner-a', wo, action, o);
      wo = (await getCase(db, 'a', 'workOrders', id))!;
    };
    await expect(step('resolve', { note: 'x' })).rejects.toThrow(
      'not available',
    );
    await step('assign', { assigneeIds: [w.e1] });
    expect(wo.respondedAt).not.toBeNull();
    await step('start');
    await expect(step('hold')).rejects.toThrow('reason');
    await step('hold', { note: 'Waiting for spare part' });
    await step('resume');
    await step('resolve', { note: 'Replaced contactor' });
    expect(wo.resolution).toBe('Replaced contactor');
    await step('verify');
    await step('close');
    expect(wo.closedAt).not.toBeNull();
    await step('reopen', { note: 'Tripped again' });
    expect(wo.status).toBe('in_progress');
    expect(wo.resolvedAt).toBeNull();
    const events = await caseEvents(db, 'a', 'workOrders', id);
    expect(events.map((e) => e.action)).toEqual([
      'create',
      'assign',
      'start',
      'hold',
      'resume',
      'resolve',
      'verify',
      'close',
      'reopen',
    ]);
    // Forged jump straight to closed, staff and other tenants denied.
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'workOrders', id), {
        status: 'closed',
        revision: wo.revision + 1,
        updatedAt: serverTimestamp(),
        updatedBy: 'owner-a',
      }),
    );
    await assertFails(getDoc(doc(staff, 'companies', 'a', 'workOrders', id)));
    await assertFails(getDoc(doc(other, 'companies', 'a', 'workOrders', id)));
    // Breach is derived from the stored target only.
    expect(
      (
        await breachedCases(
          db,
          'a',
          'workOrders',
          new Date(Date.now() + 10 * 3600000),
        )
      ).some((x) => x.id === id),
    ).toBe(true);
    expect(
      (await breachedCases(db, 'a', 'workOrders', new Date())).some(
        (x) => x.id === id,
      ),
    ).toBe(false);
  });

  it('creates one work order per exception or complaint and issues materials through the ledger', async () => {
    const w = await world();
    const input = {
      ...emptyCase('workOrders'),
      title: 'Leak',
      siteId: w.site,
      sourceType: 'task_exception',
      sourceId: 'ex123',
    };
    const a = await createCase(db, 'a', 'owner-a', 'workOrders', input);
    const b = await createCase(db, 'a', 'owner-a', 'workOrders', input);
    expect(a).toEqual({ id: 'wo_task_exception_ex123', created: true });
    expect(b.created).toBe(false);
    expect(
      (await listCases(db, 'a', 'workOrders', { sourceId: 'ex123' })).length,
    ).toBe(1);
    const cmp = await createCase(db, 'a', 'owner-a', 'complaints', {
      ...emptyCase('complaints'),
      title: 'Noisy AHU',
      siteId: w.site,
      reportedBy: 'Tenant 12F',
    });
    const complaint = (await getCase(db, 'a', 'complaints', cmp.id))!;
    const w1 = await workOrderFromComplaint(db, 'a', 'owner-a', complaint);
    const w2 = await workOrderFromComplaint(
      db,
      'a',
      'owner-a',
      (await getCase(db, 'a', 'complaints', cmp.id))!,
    );
    expect(w1.created).toBe(true);
    expect(w2.created).toBe(false);
    expect((await getCase(db, 'a', 'complaints', cmp.id))!.workOrderId).toBe(
      w1.id,
    );
    // Material issue against the work order.
    const category = await create('materialCategories');
    const material = await create('materials', {
      categoryId: category,
      unit: 'kg',
    });
    const store = await create('stores', { siteId: w.site });
    const mv = (v: Partial<MovementInput>): MovementInput => ({
      movementType: 'receipt',
      materialId: material,
      fromStoreId: '',
      toStoreId: store,
      quantity: 5,
      movementDate: '2026-11-16',
      reason: '',
      reference: '',
      notes: '',
      issuedToEmployeeId: '',
      issuedToLocationId: '',
      reversesId: '',
      ...v,
    });
    await postMovement(db, 'a', 'owner-a', mv({}), 'P4R1');
    await postMovement(
      db,
      'a',
      'owner-a',
      mv({
        movementType: 'issue',
        fromStoreId: store,
        toStoreId: '',
        quantity: 2,
        issuedToEmployeeId: w.e1,
        workOrderId: w1.id,
      }),
      'P4I1',
    );
    const used = await workOrderMaterials(db, 'a', w1.id);
    expect(used).toHaveLength(1);
    expect(used[0].quantity).toBe(2);
  });

  it('runs complaints and escalations, including reassign and escalate further, idempotently', async () => {
    const w = await world();
    const dep2 = await create('departments');
    const { id } = await createCase(db, 'a', 'owner-a', 'complaints', {
      ...emptyCase('complaints'),
      title: 'Lift stuck',
      siteId: w.site,
      sourceType: 'client',
      reportedBy: 'Reception',
    });
    let c = (await getCase(db, 'a', 'complaints', id))!;
    await transitionCase(db, 'a', 'owner-a', c, 'assign', {
      assigneeIds: [w.e2],
    });
    c = (await getCase(db, 'a', 'complaints', id))!;
    await transitionCase(db, 'a', 'owner-a', c, 'resolve', {
      note: 'Released',
    });
    c = (await getCase(db, 'a', 'complaints', id))!;
    await transitionCase(db, 'a', 'owner-a', c, 'reopen', {
      note: 'Stuck again',
    });
    c = (await getCase(db, 'a', 'complaints', id))!;
    expect(c.status).toBe('in_progress');
    const e1 = await escalateFurther(
      db,
      'a',
      'owner-a',
      c,
      w.department,
      'Repeated failure',
    );
    const e1again = await escalateFurther(
      db,
      'a',
      'owner-a',
      c,
      w.department,
      'Repeated failure',
    );
    expect(e1again.id).toBe(e1.id);
    expect(e1again.created).toBe(false);
    let esc = (await getCase(db, 'a', 'escalations', e1.id))!;
    expect(esc.level).toBe(1);
    await transitionCase(db, 'a', 'owner-a', esc, 'acknowledge');
    esc = (await getCase(db, 'a', 'escalations', e1.id))!;
    await expect(
      transitionCase(db, 'a', 'owner-a', esc, 'reassign', {
        note: 'x',
        targetDepartmentId: w.department,
      }),
    ).rejects.toThrow('different');
    await transitionCase(db, 'a', 'owner-a', esc, 'reassign', {
      note: 'Needs vendor team',
      targetDepartmentId: dep2,
    });
    esc = (await getCase(db, 'a', 'escalations', e1.id))!;
    expect(esc.status).toBe('raised');
    expect(esc.targetDepartmentId).toBe(dep2);
    const e2 = await escalateFurther(
      db,
      'a',
      'owner-a',
      esc,
      w.department,
      'No response',
    );
    expect((await getCase(db, 'a', 'escalations', e2.id))!.level).toBe(2);
    // Escalations need a target department.
    await expect(
      createCase(db, 'a', 'owner-a', 'escalations', {
        ...emptyCase('escalations'),
        title: 'x',
        siteId: w.site,
      }),
    ).rejects.toThrow('department');
  });
});

describe('notifications', () => {
  it('delivers once per event, isolates recipients and only lets them mark read', async () => {
    const n = {
      type: 'task_assigned' as const,
      recordKind: 'tasks' as const,
      recordId: 'T1',
      eventKey: 'r1',
      body: 'Inspect',
    };
    expect(await notify(db, 'a', 'owner-a', ['staffa', 'admin2-a'], n)).toBe(2);
    expect(await notify(db, 'a', 'owner-a', ['staffa', 'admin2-a'], n)).toBe(0);
    const mine = (await listNotifications(staff, 'a', 'staffa')).filter(
      (x) => x.recordId === 'T1',
    );
    expect(mine).toHaveLength(1);
    const before = await unreadCount(staff, 'a', 'staffa');
    // Others cannot read it, and the sender cannot mark it read for them.
    await assertFails(
      getDoc(doc(admin2, 'companies', 'a', 'notifications', mine[0].id)),
    );
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'notifications', mine[0].id), {
        readAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(staff, 'companies', 'a', 'notifications', mine[0].id), {
        body: 'changed',
      }),
    );
    await markRead(staff, 'a', mine[0].id);
    expect(await unreadCount(staff, 'a', 'staffa')).toBe(before - 1);
    // Staff cannot create notifications; inactive or foreign recipients are skipped.
    await assertFails(
      setDoc(doc(staff, 'companies', 'a', 'notifications', 'x'), {
        ...n,
        companyId: 'a',
      }),
    );
    expect(
      await notify(db, 'a', 'owner-a', ['owner-b'], { ...n, eventKey: 'r2' }),
    ).toBe(0);
    // Preferences mute a type for that person.
    await savePreferences(staff, 'a', 'staffa', {
      inApp: { task_due_soon: false },
      email: false,
      push: false,
    });
    expect(
      await notify(db, 'a', 'owner-a', ['staffa'], {
        ...n,
        type: 'task_due_soon',
        eventKey: 'd1',
      }),
    ).toBe(0);
    await assertFails(
      setDoc(
        doc(admin2, 'companies', 'a', 'notificationPreferences', 'staffa'),
        {
          companyId: 'a',
          uid: 'staffa',
          inApp: {},
          email: true,
          push: true,
          updatedAt: serverTimestamp(),
        },
      ),
    );
  });

  it('notifies the linked employee when the scheduler assigns work', async () => {
    const w = await world();
    const id = await saveSchedule(
      db,
      'a',
      'owner-a',
      schedule(w, {
        startDate: '2026-11-17',
        endDate: '2026-11-17',
        assignment: {
          strategy: 'fixed',
          pool: 'employee',
          refId: '',
          employeeIds: [w.e1],
          siteOnly: false,
        },
      }),
    );
    const r = await run(id);
    expect(r.created).toBe(1);
    const mine = await getDocs(
      query(
        collection(staff, 'companies', 'a', 'notifications'),
        where('recipientUid', '==', 'staffa'),
      ),
    );
    expect(
      mine.docs.some(
        (d) =>
          d.data().type === 'task_assigned' &&
          d.data().recordId.startsWith('occ_' + id),
      ),
    ).toBe(true);
  });
});
