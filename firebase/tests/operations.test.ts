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
  type Firestore,
} from 'firebase/firestore';
import { beforeAll, afterAll, it, expect } from 'vitest';
import {
  defaultValues,
  type Kind,
  type Values,
} from '../../packages/shared/src/operations';
import {
  saveRecord,
  recordById,
  listRecords,
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
    projectId: 'demo-facilityos-operations',
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
async function create(kind: Kind, v: Values = {}) {
  try {
    return await saveRecord(db, 'a', 'owner-a', kind, {
      ...defaultValues(kind),
      code: `T${++seq}`,
      name: `Test ${seq}`,
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
async function setup() {
  const client = await create('clients'),
    contract = await create('contracts', {
      clientId: client,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    }),
    site = await create('sites', { clientId: client, contractId: contract }),
    location = await create('locations', { siteId: site }),
    type = await create('facilityTypes');
  return { client, contract, site, location, type };
}
it('valid owner create/edit/list and archive, with code retained', async () => {
  const id = await create('clients', { code: 'CLIENT_01' });
  await edit('clients', id, { name: 'Updated client' });
  expect((await recordById(db, 'a', 'clients', id))?.values.name).toBe(
    'Updated client',
  );
  expect((await listRecords(db, 'a', 'clients', 'Updated')).rows.length).toBe(
    1,
  );
  await edit('clients', id, { status: 'archived' });
  await expect(create('clients', { code: 'CLIENT_01' })).rejects.toThrow(
    'reserved',
  );
  await assertFails(deleteDoc(doc(db, 'companies', 'a', 'clients', id)));
});
it('valid complete relationships and facility condition history', async () => {
  const r = await setup();
  const facility = await create('facilities', {
    siteId: r.site,
    locationId: r.location,
    typeId: r.type,
  });
  await edit('facilities', facility, {
    condition: 'Poor',
    status: 'under_maintenance',
  });
  const history = await getDocs(
    collection(db, 'companies', 'a', 'facilities', facility, 'history'),
  );
  expect(history.size).toBe(2);
  expect((await recordById(db, 'a', 'locations', r.location))?.refCount).toBe(
    1,
  );
  await assertFails(
    updateDoc(
      doc(db, 'companies', 'a', 'facilities', facility, 'history', '1'),
      { condition: 'Critical' },
    ),
  );
  await assertFails(
    setDoc(doc(db, 'companies', 'a', 'facilities', facility, 'history', '3'), {
      companyId: 'a',
      revision: 3,
      condition: 'Good',
      status: 'active',
      actorUid: 'owner-a',
      occurredAt: serverTimestamp(),
    }),
  );
});
it('rejects duplicate codes under concurrent creation', async () => {
  const results = await Promise.allSettled([
    create('clients', { code: 'RACE' }),
    create('clients', { code: 'RACE' }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
});
it('isolates company clients and site writes, denies staff', async () => {
  const r = await setup();
  const other = env.authenticatedContext('owner-b').firestore();
  const staff = env.authenticatedContext('staff-a').firestore();
  await assertFails(getDoc(doc(other, 'companies', 'a', 'clients', r.client)));
  await assertFails(getDocs(collection(other, 'companies', 'a', 'clients')));
  await assertFails(
    updateDoc(doc(other, 'companies', 'a', 'sites', r.site), {
      name: 'Intrusion',
    }),
  );
  await assertFails(
    setDoc(doc(staff, 'companies', 'a', 'clients', 'fake'), { companyId: 'a' }),
  );
  await assertFails(getDoc(doc(staff, 'companies', 'a', 'clients', r.client)));
});
it('rejects direct metadata, unknown fields and invalid status writes', async () => {
  const id = await create('clients'),
    target = doc(db, 'companies', 'a', 'clients', id),
    original = (await getDoc(target)).data()!;
  for (const change of [
    { companyId: 'b' },
    { createdBy: 'attacker' },
    { status: 'superuser' },
    { name: 42 },
    { role: 'owner' },
    { code: 'CHANGED' },
    { refCount: -1 },
  ])
    await assertFails(
      updateDoc(target, {
        ...change,
        revision: original.revision + 1,
        updatedAt: serverTimestamp(),
        updatedBy: 'owner-a',
      }),
    );
});
it('rejects missing and cross-site parents at the database boundary', async () => {
  const r = await setup();
  const second = await create('sites', { clientId: r.client });
  const local = await create('locations', { siteId: second });
  const old = (
    await getDoc(doc(db, 'companies', 'a', 'locations', local))
  ).data()!;
  await assertFails(
    updateDoc(doc(db, 'companies', 'a', 'locations', local), {
      parentId: r.location,
      revision: old.revision + 1,
      updatedAt: serverTimestamp(),
      updatedBy: 'owner-a',
    }),
  );
  await expect(
    create('locations', { siteId: r.site, parentId: 'missing' }),
  ).rejects.toThrow();
});
it('supports moves and blocks descendant cycles even with correctly forged counter updates', async () => {
  const r = await setup();
  const child = await create('locations', {
    siteId: r.site,
    parentId: r.location,
  });
  const alternate = await create('locations', { siteId: r.site });
  await edit('locations', child, { parentId: alternate });
  expect((await recordById(db, 'a', 'locations', r.location))?.refCount).toBe(
    0,
  );
  await edit('locations', child, { parentId: r.location });
  const parentRef = doc(db, 'companies', 'a', 'locations', r.location),
    childRef = doc(db, 'companies', 'a', 'locations', child);
  const parent = (await getDoc(parentRef)).data()!,
    childData = (await getDoc(childRef)).data()!;
  const b = writeBatch(db);
  b.update(parentRef, {
    parentId: child,
    revision: parent.revision + 1,
    updatedBy: 'owner-a',
    updatedAt: serverTimestamp(),
  });
  b.update(childRef, {
    refCount: childData.refCount + 1,
    witnessKind: 'locations',
    witnessId: r.location,
    updatedBy: 'owner-a',
    updatedAt: serverTimestamp(),
  });
  await assertFails(b.commit());
  await expect(
    edit('locations', r.location, { parentId: r.location }),
  ).rejects.toThrow('itself');
});
it('archive protects parents; child archive releases references atomically', async () => {
  const r = await setup();
  const child = await create('locations', {
    siteId: r.site,
    parentId: r.location,
  });
  await expect(
    edit('locations', r.location, { status: 'archived' }),
  ).rejects.toThrow('linked');
  await assertFails(
    updateDoc(doc(db, 'companies', 'a', 'locations', r.location), {
      status: 'archived',
      revision: 2,
      updatedAt: serverTimestamp(),
      updatedBy: 'owner-a',
    }),
  );
  await edit('locations', child, { status: 'archived' });
  await edit('locations', r.location, { status: 'archived' });
  expect(
    (await recordById(db, 'a', 'locations', r.location))?.values.status,
  ).toBe('archived');
  await expect(
    create('facilities', {
      siteId: r.site,
      locationId: r.location,
      typeId: r.type,
    }),
  ).rejects.toThrow('active');
});
it('rejects contract/client mismatches and cross-site facility references', async () => {
  const r = await setup();
  const client = await create('clients'),
    site = await create('sites', { clientId: client });
  await expect(
    create('sites', { clientId: client, contractId: r.contract }),
  ).rejects.toThrow('different client');
  await expect(
    create('facilities', {
      siteId: site,
      locationId: r.location,
      typeId: r.type,
    }),
  ).rejects.toThrow('this site');
});
it('does not permit fabricated counters or changing facility site', async () => {
  const r = await setup();
  await assertFails(
    updateDoc(doc(db, 'companies', 'a', 'clients', r.client), {
      refCount: 0,
      witnessKind: 'sites',
      witnessId: r.site,
      updatedAt: serverTimestamp(),
      updatedBy: 'owner-a',
    }),
  );
  const facility = await create('facilities', {
      siteId: r.site,
      locationId: r.location,
      typeId: r.type,
    }),
    site = await create('sites', { clientId: r.client });
  await expect(edit('facilities', facility, { siteId: site })).rejects.toThrow(
    'between sites',
  );
});
it('detects stale edits and paginates sorted results', async () => {
  const id = await create('clients');
  const old = (await recordById(db, 'a', 'clients', id))!;
  await edit('clients', id, { name: 'Newer' });
  await expect(
    saveRecord(
      db,
      'a',
      'owner-a',
      'clients',
      { ...old.values, name: 'Older' },
      old,
    ),
  ).rejects.toThrow('changed');
  const first = await listRecords(db, 'a', 'clients');
  expect(first.rows.length).toBeLessThanOrEqual(20);
  if (first.hasMore) {
    const next = await listRecords(db, 'a', 'clients', '', '', first.cursor);
    expect(next.rows.some((n) => first.rows.some((p) => p.id === n.id))).toBe(
      false,
    );
  }
});
it('allows safe company contacts and forbids protected status', async () => {
  await assertSucceeds(
    updateDoc(doc(db, 'companies', 'a'), {
      contactEmail: 'team@example.test',
      contactPhone: '123',
      address: 'Office',
      country: 'AE',
      updatedAt: serverTimestamp(),
      updatedBy: 'owner-a',
    }),
  );
  await assertFails(
    updateDoc(doc(db, 'companies', 'a'), {
      status: 'suspended',
      updatedAt: serverTimestamp(),
      updatedBy: 'owner-a',
    }),
  );
});
it('validates deep hierarchy, retained contract relationships and independent moves', async () => {
  const r = await setup();
  let parent = r.location;
  for (let n = 0; n < 4; n++)
    parent = await create('locations', { siteId: r.site, parentId: parent });
  await expect(
    create('locations', { siteId: r.site, parentId: parent }),
  ).rejects.toThrow();
  const second = await create('clients');
  await expect(
    edit('contracts', r.contract, { clientId: second }),
  ).rejects.toThrow('linked');
  const location = await create('locations', { siteId: r.site }),
    type = await create('facilityTypes');
  const facility = await create('facilities', {
    siteId: r.site,
    locationId: r.location,
    typeId: r.type,
  });
  await expect(
    edit('facilities', facility, { locationId: location, typeId: type }),
  ).rejects.toThrow('one linked record');
  await edit('facilities', facility, { locationId: location });
  await edit('facilities', facility, { typeId: type });
  expect((await recordById(db, 'a', 'locations', r.location))?.refCount).toBe(
    1,
  );
  await edit('facilities', facility, { status: 'archived' });
  expect((await recordById(db, 'a', 'facilityTypes', type))?.refCount).toBe(0);
});
it('server rejects impossible dates, unknown zones and missing required fields', async () => {
  const r = await setup();
  const contract = doc(db, 'companies', 'a', 'contracts', r.contract),
    site = doc(db, 'companies', 'a', 'sites', r.site);
  for (const v of [
    { startDate: '2026-02-31' },
    { endDate: '2026-13-01' },
    { startDate: '2027-01-01' },
    { clientId: 'no-such-client' },
  ])
    await assertFails(
      updateDoc(contract, {
        ...v,
        revision: 2,
        updatedAt: serverTimestamp(),
        updatedBy: 'owner-a',
      }),
    );
  await assertFails(
    updateDoc(site, {
      timeZone: 'Invalid/Nowhere',
      revision: 2,
      updatedAt: serverTimestamp(),
      updatedBy: 'owner-a',
    }),
  );
  await assertFails(
    updateDoc(doc(db, 'companies', 'a'), {
      timeZone: 'Invalid/Nowhere',
      updatedAt: serverTimestamp(),
      updatedBy: 'owner-a',
    }),
  );
  const client = (
    await getDoc(doc(db, 'companies', 'a', 'clients', r.client))
  ).data()!;
  delete client.name;
  await assertFails(
    setDoc(doc(db, 'companies', 'a', 'clients', r.client), {
      ...client,
      revision: 2,
      updatedAt: serverTimestamp(),
      updatedBy: 'owner-a',
    }),
  );
});
it('serializes concurrent parent changes without creating a cycle', async () => {
  const r = await setup();
  const other = await create('locations', { siteId: r.site });
  const results = await Promise.allSettled([
    edit('locations', r.location, { parentId: other }),
    edit('locations', other, { parentId: r.location }),
  ]);
  expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  const a = await recordById(db, 'a', 'locations', r.location),
    b = await recordById(db, 'a', 'locations', other);
  expect(
    a?.values.parentId === other && b?.values.parentId === r.location,
  ).toBe(false);
});
