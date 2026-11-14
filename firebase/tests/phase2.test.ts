import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import { beforeAll, afterAll, it, expect, describe } from 'vitest';
import {
  defaultValues,
  reversalOf,
  balanceId,
  reversalId,
  type Kind,
  type Values,
  type MovementInput,
} from '../../packages/shared/src';
import {
  saveRecord,
  recordById,
  transferAsset,
  postMovement,
  listMovements,
  listMembers,
  AlreadyPostedError,
} from '../../apps/admin-web/src/management/store';
let env: RulesTestEnvironment;
let db: Firestore;
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
    projectId: 'demo-facilityos-phase2',
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
        [`staff-${companyId}`, 'staff'],
      ])
        await setDoc(
          doc(c.firestore(), 'companies', companyId, 'members', uid),
          { ...meta, companyId, uid, role, status: 'active' },
        );
    }
  });
  db = env.authenticatedContext('owner-a').firestore() as unknown as Firestore;
});
afterAll(async () => {
  await env?.cleanup();
});
let seq = 0;
async function create(
  kind: Kind,
  v: Values = {},
  database = db,
  company = 'a',
) {
  try {
    return await saveRecord(database, company, `owner-${company}`, kind, {
      ...defaultValues(kind),
      code: `P${++seq}`,
      name: `Record ${seq}`,
      ...v,
    });
  } catch (e) {
    throw new Error('Create ' + kind + ': ' + String(e));
  }
}
async function edit(kind: Kind, id: string, v: Values) {
  const r = await recordById(db, 'a', kind, id);
  if (!r) throw Error('Missing');
  await saveRecord(db, 'a', 'owner-a', kind, { ...r.values, ...v }, r);
}
async function people() {
  const site = await create('sites');
  const department = await create('departments');
  const designation = await create('designations', {
    departmentId: department,
  });
  const employee = await create('employees', {
    joiningDate: '2026-01-05',
    departmentId: department,
    designationId: designation,
    primarySiteId: site,
  });
  return { site, department, designation, employee };
}
async function place() {
  const site = await create('sites');
  const location = await create('locations', { siteId: site });
  const other = await create('locations', { siteId: site });
  const category = await create('assetCategories');
  return { site, location, other, category };
}
async function stock() {
  const p = await place();
  const category = await create('materialCategories');
  const material = await create('materials', {
    categoryId: category,
    unit: 'kg',
  });
  const storeA = await create('stores', {
    siteId: p.site,
    locationId: p.location,
  });
  const storeB = await create('stores', { siteId: p.site });
  return { ...p, material, storeA, storeB };
}
const mv = (v: Partial<MovementInput>): MovementInput => ({
  movementType: 'receipt',
  materialId: '',
  fromStoreId: '',
  toStoreId: '',
  quantity: 1,
  movementDate: '2026-11-14',
  reason: '',
  reference: '',
  notes: '',
  issuedToEmployeeId: '',
  issuedToLocationId: '',
  reversesId: '',
  ...v,
});
let mseq = 0;
const post = (v: Partial<MovementInput>, id = `MV${++mseq}`) =>
  postMovement(db, 'a', 'owner-a', mv(v), id).then(() => id);
const balance = async (store: string, material: string) =>
  (
    await getDoc(
      doc(db, 'companies', 'a', 'stockBalances', balanceId(store, material)),
    )
  ).data()?.quantity;

describe('people and teams', () => {
  it('creates departments, designations and employees with counted references', async () => {
    const r = await people();
    expect(
      (await recordById(db, 'a', 'departments', r.department))?.refCount,
    ).toBe(2);
    expect((await recordById(db, 'a', 'sites', r.site))?.refCount).toBe(0);
    await expect(
      edit('departments', r.department, { status: 'archived' }),
    ).rejects.toThrow('Archive or reassign');
    const supervisor = await create('employees', {
      joiningDate: '2026-01-05',
      departmentId: r.department,
      designationId: r.designation,
    });
    await edit('employees', r.employee, { supervisorId: supervisor });
    expect(
      (await recordById(db, 'a', 'employees', r.employee))?.values.supervisorId,
    ).toBe(supervisor);
    await expect(
      edit('employees', r.employee, { supervisorId: r.employee }),
    ).rejects.toThrow();
  });
  it('supports one-level department hierarchy and rejects deeper parents', async () => {
    const root = await create('departments');
    const child = await create('departments', { parentId: root });
    await expect(create('departments', { parentId: child })).rejects.toThrow(
      'top-level',
    );
  });
  it('team memberships keep history and release references when ended', async () => {
    const r = await people();
    const team = await create('teams', {
      departmentId: r.department,
      leaderId: r.employee,
    });
    const m = await create('teamMembers', {
      teamId: team,
      employeeId: r.employee,
      startDate: '2026-01-01',
    });
    const membership = await recordById(db, 'a', 'teamMembers', m);
    expect(membership?.values.name).toContain('·');
    expect((await recordById(db, 'a', 'teams', team))?.refCount).toBe(1);
    await edit('teamMembers', m, { status: 'ended', endDate: '2026-06-30' });
    expect((await recordById(db, 'a', 'teams', team))?.refCount).toBe(0);
    await expect(edit('teamMembers', m, { status: 'active' })).rejects.toThrow(
      'reopened',
    );
    await expect(
      edit('teamMembers', m, { employeeId: team }),
    ).rejects.toThrow();
  });
  it('assigns sites and overnight shifts with effective dates', async () => {
    const r = await people();
    const shift = await create('shifts', {
      siteId: r.site,
      startTime: '22:00',
      endTime: '06:00',
      workingDays: 'Sun,Mon,Tue',
    });
    const a = await create('shiftAssignments', {
      employeeId: r.employee,
      shiftId: shift,
      startDate: '2026-02-01',
    });
    await create('siteAssignments', {
      employeeId: r.employee,
      siteId: r.site,
      startDate: '2026-02-01',
    });
    expect((await recordById(db, 'a', 'shifts', shift))?.refCount).toBe(1);
    await expect(
      edit('shifts', shift, { status: 'archived' }),
    ).rejects.toThrow();
    await edit('shiftAssignments', a, {
      status: 'ended',
      endDate: '2026-03-01',
    });
    await edit('shifts', shift, { status: 'archived' });
    await create('holidays', { holidayDate: '2026-12-02', siteId: r.site });
    await create('leaveRecords', {
      employeeId: r.employee,
      startDate: '2026-04-01',
      endDate: '2026-04-03',
    });
  });
  it('denies staff, other tenants and role escalation through employee or member writes', async () => {
    const r = await people();
    const staff = env.authenticatedContext('staff-a').firestore();
    await assertFails(
      getDoc(doc(staff, 'companies', 'a', 'employees', r.employee)),
    );
    await assertFails(
      updateDoc(doc(staff, 'companies', 'a', 'members', 'staff-a'), {
        role: 'admin',
      }),
    );
    const other = env.authenticatedContext('owner-b').firestore();
    await assertFails(
      getDoc(doc(other, 'companies', 'a', 'employees', r.employee)),
    );
    await assertFails(getDocs(collection(other, 'companies', 'a', 'members')));
    await assertFails(getDocs(collection(staff, 'companies', 'a', 'members')));
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'members', 'owner-a'), {
        role: 'owner',
        status: 'active',
      }),
    );
    await assertFails(
      setDoc(doc(db, 'companies', 'a', 'members', 'new-user'), {
        ...meta,
        companyId: 'a',
        uid: 'new-user',
        role: 'admin',
        status: 'active',
      }),
    );
    // Linking a login UID is informational and grants nothing.
    await edit('employees', r.employee, { linkedUid: 'staffa' });
    expect((await listMembers(db, 'a')).length).toBeGreaterThanOrEqual(2);
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'employees', r.employee), {
        role: 'admin',
        revision: 99,
      }),
    );
    await assertFails(
      deleteDoc(doc(db, 'companies', 'a', 'employees', r.employee)),
    );
  });
  it('rejects forged employee references without counter updates and cross-company links', async () => {
    const r = await people();
    const b = env
      .authenticatedContext('owner-b')
      .firestore() as unknown as Firestore;
    const foreign = await create('departments', {}, b, 'b');
    await expect(
      create('employees', {
        joiningDate: '2026-01-05',
        departmentId: foreign,
        designationId: r.designation,
      }),
    ).rejects.toThrow('no longer exists');
    const id = 'forged-employee';
    const batch = writeBatch(db);
    batch.set(doc(db, 'companies', 'a', 'codeClaims', 'employees_FORGED1'), {
      kind: 'employees',
      recordId: id,
      code: 'FORGED1',
      companyId: 'a',
    });
    batch.set(doc(db, 'companies', 'a', 'employees', id), {
      ...defaultValues('employees'),
      code: 'FORGED1',
      name: 'Forged',
      joiningDate: '2026-01-05',
      departmentId: r.department,
      designationId: r.designation,
      companyId: 'a',
      schemaVersion: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: 'owner-a',
      updatedBy: 'owner-a',
      revision: 1,
      refCount: 0,
      witnessKind: '',
      witnessId: '',
    });
    await assertFails(batch.commit());
  });
});

describe('assets, furniture and transfers', () => {
  it('registers equipment and furniture batches with unique tags and history', async () => {
    const p = await place();
    const supplier = await create('suppliers');
    const asset = await create('assets', {
      categoryId: p.category,
      siteId: p.site,
      locationId: p.location,
      supplierId: supplier,
      serialNumber: 'SN-1',
      purchaseCost: '1250.50',
      code: 'CHILLER-01',
    });
    const batch = await create('assets', {
      categoryId: p.category,
      siteId: p.site,
      locationId: p.location,
      assetClass: 'Furniture',
      trackingMode: 'batch',
      quantity: '40',
    });
    expect((await recordById(db, 'a', 'locations', p.location))?.refCount).toBe(
      2,
    );
    await expect(
      create('assets', {
        categoryId: p.category,
        siteId: p.site,
        locationId: p.location,
        code: 'CHILLER-01',
      }),
    ).rejects.toThrow('already reserved');
    await edit('assets', batch, { quantity: '38', condition: 'Fair' });
    const history = await getDocs(
      collection(db, 'companies', 'a', 'assets', batch, 'history'),
    );
    expect(history.size).toBe(2);
    await expect(
      edit('assets', asset, { trackingMode: 'batch' }),
    ).rejects.toThrow();
    await expect(
      edit('assets', asset, { locationId: p.other }),
    ).rejects.toThrow('Transfer');
    // Direct move without a transfer record is denied by the server.
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'assets', asset), {
        locationId: p.other,
      }),
    );
  });
  it('transfers atomically with history and counter moves, across sites', async () => {
    const p = await place();
    const asset = await create('assets', {
      categoryId: p.category,
      siteId: p.site,
      locationId: p.location,
    });
    const site2 = await create('sites');
    const remote = await create('locations', { siteId: site2 });
    const r = await recordById(db, 'a', 'assets', asset);
    const tid = await transferAsset(db, 'a', 'owner-a', r!, {
      toSiteId: site2,
      toLocationId: remote,
      transferDate: '2026-11-14',
      reason: 'Relocated to new tower',
      conditionAfter: 'Good',
      receivedById: '',
      notes: '',
    });
    const moved = await recordById(db, 'a', 'assets', asset);
    expect(moved?.values.locationId).toBe(remote);
    expect(moved?.lastTransferId).toBe(tid);
    expect((await recordById(db, 'a', 'locations', p.location))?.refCount).toBe(
      0,
    );
    expect((await recordById(db, 'a', 'locations', remote))?.refCount).toBe(1);
    const t = (
      await getDoc(doc(db, 'companies', 'a', 'assetTransfers', tid))
    ).data();
    expect(t).toMatchObject({
      fromLocationId: p.location,
      toLocationId: remote,
    });
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'assetTransfers', tid), {
        reason: 'x',
      }),
    );
    await assertFails(
      deleteDoc(doc(db, 'companies', 'a', 'assetTransfers', tid)),
    );
    // A stale copy cannot transfer again.
    await expect(
      transferAsset(db, 'a', 'owner-a', r!, {
        toSiteId: p.site,
        toLocationId: p.other,
        transferDate: '2026-11-14',
        reason: 'x',
        conditionAfter: 'Good',
        receivedById: '',
        notes: '',
      }),
    ).rejects.toThrow('changed');
    // Assets stay put when the space's contract/client changes: no client fields exist.
    expect(Object.keys(moved!.values)).not.toContain('clientId');
  });
  it('rejects a forged transfer whose record does not match the asset move', async () => {
    const p = await place();
    const asset = await create('assets', {
      categoryId: p.category,
      siteId: p.site,
      locationId: p.location,
    });
    const r = (
      await getDoc(doc(db, 'companies', 'a', 'assets', asset))
    ).data()!;
    const batch = writeBatch(db);
    batch.set(doc(db, 'companies', 'a', 'assetTransfers', 'forged'), {
      companyId: 'a',
      schemaVersion: 1,
      assetId: asset,
      fromSiteId: p.site,
      fromLocationId: p.location,
      toSiteId: p.site,
      toLocationId: p.location,
      quantity: '1',
      transferDate: '2026-11-14',
      reason: 'x',
      conditionBefore: r.condition,
      conditionAfter: r.condition,
      receivedById: '',
      notes: '',
      actorUid: 'owner-a',
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, 'companies', 'a', 'assets', asset), {
      locationId: p.other,
      lastTransferId: 'forged',
      revision: r.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: 'owner-a',
    });
    await assertFails(batch.commit());
  });
});

describe('materials and inventory ledger', () => {
  it('posts opening, receipt, issue, transfer and adjustments with exact balances', async () => {
    const s = await stock();
    await post({
      movementType: 'opening',
      materialId: s.material,
      toStoreId: s.storeA,
      quantity: 10500,
    });
    await expect(
      post({
        movementType: 'opening',
        materialId: s.material,
        toStoreId: s.storeA,
        quantity: 1,
      }),
    ).rejects.toThrow('already recorded');
    await post({
      movementType: 'receipt',
      materialId: s.material,
      toStoreId: s.storeA,
      quantity: 2250,
    });
    await post({
      movementType: 'issue',
      materialId: s.material,
      fromStoreId: s.storeA,
      quantity: 750,
    });
    await post({
      movementType: 'transfer',
      materialId: s.material,
      fromStoreId: s.storeA,
      toStoreId: s.storeB,
      quantity: 2000,
    });
    await post({
      movementType: 'adjustment_out',
      materialId: s.material,
      fromStoreId: s.storeB,
      quantity: 1,
      reason: 'Cycle count variance',
    });
    expect(await balance(s.storeA, s.material)).toBe(10000);
    expect(await balance(s.storeB, s.material)).toBe(1999);
    const history = await listMovements(db, 'a', {
      key: 'materialId',
      value: s.material,
    });
    expect(history.rows.length).toBe(5);
    expect(history.rows[0].movementType).toBe('adjustment_out');
  });
  it('rejects negative stock and keeps the ledger append-only', async () => {
    const s = await stock();
    const id = await post({
      movementType: 'receipt',
      materialId: s.material,
      toStoreId: s.storeA,
      quantity: 5,
    });
    await expect(
      post({
        movementType: 'issue',
        materialId: s.material,
        fromStoreId: s.storeA,
        quantity: 6,
      }),
    ).rejects.toThrow('Not enough stock');
    await assertFails(
      updateDoc(doc(db, 'companies', 'a', 'stockMovements', id), {
        quantity: 50,
      }),
    );
    await assertFails(
      deleteDoc(doc(db, 'companies', 'a', 'stockMovements', id)),
    );
    await assertFails(
      updateDoc(
        doc(
          db,
          'companies',
          'a',
          'stockBalances',
          balanceId(s.storeA, s.material),
        ),
        {
          quantity: 1000,
        },
      ),
    );
    // A forged negative issue written directly is rejected by the server.
    const batch = writeBatch(db);
    batch.set(doc(db, 'companies', 'a', 'stockMovements', 'forged-issue'), {
      ...mv({
        movementType: 'issue',
        materialId: s.material,
        fromStoreId: s.storeA,
        quantity: 9,
      }),
      companyId: 'a',
      schemaVersion: 1,
      fromBalanceAfter: -4,
      toBalanceAfter: -1,
      createdAt: serverTimestamp(),
      createdBy: 'owner-a',
    });
    batch.set(
      doc(
        db,
        'companies',
        'a',
        'stockBalances',
        balanceId(s.storeA, s.material),
      ),
      {
        companyId: 'a',
        storeId: s.storeA,
        materialId: s.material,
        quantity: -4,
        revision: 2,
        lastMovementId: 'forged-issue',
        updatedAt: serverTimestamp(),
        updatedBy: 'owner-a',
      },
    );
    await assertFails(batch.commit());
    // A movement without its balance update is rejected too.
    await assertFails(
      setDoc(doc(db, 'companies', 'a', 'stockMovements', 'orphan'), {
        ...mv({
          movementType: 'receipt',
          materialId: s.material,
          toStoreId: s.storeA,
          quantity: 9,
        }),
        companyId: 'a',
        schemaVersion: 1,
        fromBalanceAfter: -1,
        toBalanceAfter: 14,
        createdAt: serverTimestamp(),
        createdBy: 'owner-a',
      }),
    );
    expect(await balance(s.storeA, s.material)).toBe(5);
  });
  it('prevents duplicate posting with the same idempotency key', async () => {
    const s = await stock();
    const input = {
      movementType: 'receipt' as const,
      materialId: s.material,
      toStoreId: s.storeA,
      quantity: 100,
    };
    await post(input, 'IDEMPOTENT-1');
    await expect(post(input, 'IDEMPOTENT-1')).rejects.toBeInstanceOf(
      AlreadyPostedError,
    );
    expect(await balance(s.storeA, s.material)).toBe(100);
  });
  it('serialises concurrent issues so stock never goes negative', async () => {
    const s = await stock();
    await post({
      movementType: 'receipt',
      materialId: s.material,
      toStoreId: s.storeA,
      quantity: 10,
    });
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        post({
          movementType: 'issue',
          materialId: s.material,
          fromStoreId: s.storeA,
          quantity: 4,
        }),
      ),
    );
    // Contention may exhaust client retries, but stock is conserved and never negative.
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBeGreaterThanOrEqual(1);
    expect(ok).toBeLessThanOrEqual(2);
    expect(await balance(s.storeA, s.material)).toBe(10 - 4 * ok);
    const posted = await listMovements(db, 'a', {
      key: 'materialId',
      value: s.material,
    });
    expect(posted.rows.length).toBe(1 + ok);
  });
  it('reverses a movement exactly once and never reverses a reversal', async () => {
    const s = await stock();
    await post({
      movementType: 'receipt',
      materialId: s.material,
      toStoreId: s.storeA,
      quantity: 40,
    });
    const t = await post({
      movementType: 'transfer',
      materialId: s.material,
      fromStoreId: s.storeA,
      toStoreId: s.storeB,
      quantity: 15,
    });
    const original = (
      await getDoc(doc(db, 'companies', 'a', 'stockMovements', t))
    ).data() as MovementInput;
    const rev = reversalOf(
      { ...original, id: t },
      '2026-11-15',
      'Posted to wrong store',
    );
    await post(rev, reversalId(t));
    expect(await balance(s.storeA, s.material)).toBe(40);
    expect(await balance(s.storeB, s.material)).toBe(0);
    await expect(post(rev, reversalId(t))).rejects.toThrow(
      'already been reversed',
    );
    await expect(
      post({ ...rev, reversesId: reversalId(t) }, reversalId(reversalId(t))),
    ).rejects.toThrow();
  });
  it('rejects inactive materials, other-company stores and staff postings', async () => {
    const s = await stock();
    const b = env
      .authenticatedContext('owner-b')
      .firestore() as unknown as Firestore;
    const bp = await create('sites', {}, b, 'b');
    const foreignStore = await create('stores', { siteId: bp }, b, 'b');
    await expect(
      post({
        movementType: 'receipt',
        materialId: s.material,
        toStoreId: foreignStore,
        quantity: 1,
      }),
    ).rejects.toThrow('active stores');
    await edit('materials', s.material, { name: 'Renamed' });
    await expect(
      edit('materials', s.material, { unit: 'each' }),
    ).rejects.toThrow('cannot change');
    await edit('materials', s.material, { status: 'archived' });
    await expect(
      post({
        movementType: 'receipt',
        materialId: s.material,
        toStoreId: s.storeA,
        quantity: 1,
      }),
    ).rejects.toThrow('active material');
    const staff = env
      .authenticatedContext('staff-a')
      .firestore() as unknown as Firestore;
    await expect(
      postMovement(
        staff,
        'a',
        'staff-a',
        mv({ materialId: s.material, toStoreId: s.storeA }),
        'STAFF1',
      ),
    ).rejects.toThrow();
    await assertFails(
      getDocs(
        query(
          collection(staff, 'companies', 'a', 'stockBalances'),
          where('storeId', '==', s.storeA),
        ),
      ),
    );
    await assertSucceeds(
      getDocs(collection(db, 'companies', 'a', 'stockBalances')),
    );
  });
});
