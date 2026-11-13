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
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { beforeAll, afterAll, describe, it } from 'vitest';
let env: RulesTestEnvironment;
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
    projectId: 'demo-facilityos',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firebase/firestore.rules', 'utf8'),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const id of ['a', 'b', 'suspended'])
      await setDoc(doc(db, 'companies', id), {
        ...meta,
        companyId: id,
        name: id,
        status: id === 'suspended' ? 'suspended' : 'active',
        timeZone: 'Asia/Dubai',
      });
    for (const [companyId, uid, role, status] of [
      ['a', 'owner-a', 'owner', 'active'],
      ['a', 'admin-a', 'admin', 'active'],
      ['b', 'owner-b', 'owner', 'active'],
      ['a', 'staff', 'staff', 'active'],
      ['a', 'multi', 'admin', 'active'],
      ['b', 'multi', 'owner', 'active'],
      ['a', 'inactive', 'owner', 'inactive'],
      ['suspended', 'owner-a', 'owner', 'active'],
    ])
      await setDoc(doc(db, 'companies', companyId, 'members', uid), {
        ...meta,
        companyId,
        uid,
        role,
        status,
      });
    await setDoc(doc(db, 'users', 'staff'), {
      ...meta,
      uid: 'staff',
      displayName: 'Staff',
    });
    await setDoc(doc(db, 'users', 'staff', 'companyAccess', 'a'), {
      companyId: 'a',
    });
    await setDoc(doc(db, 'companies', 'a', 'auditLogs', 'event'), {
      ...meta,
      companyId: 'a',
      actorUid: 'operator',
      action: 'provision',
    });
    await setDoc(doc(db, 'companies', 'a', 'members', 'corrupt'), {
      ...meta,
      companyId: 'b',
      uid: 'corrupt',
      role: 'owner',
      status: 'active',
    });
  });
});
afterAll(async () => {
  await env?.cleanup();
});
const db = (uid: string) => env.authenticatedContext(uid).firestore();
describe('tenant security rules', () => {
  it('1 denies anonymous company reads', () =>
    assertFails(
      getDoc(doc(env.unauthenticatedContext().firestore(), 'companies', 'a')),
    ));
  it('2 isolates company A from B', () =>
    assertFails(getDoc(doc(db('owner-a'), 'companies', 'b'))));
  it('3 denies staff admin reads and writes', async () => {
    await assertFails(getDoc(doc(db('staff'), 'companies', 'a')));
    await assertFails(
      updateDoc(doc(db('staff'), 'companies', 'a'), { name: 'Changed' }),
    );
  });
  it('4 denies self promotion', () =>
    assertFails(
      updateDoc(doc(db('staff'), 'companies', 'a', 'members', 'staff'), {
        role: 'owner',
      }),
    ));
  it('5 denies unauthorized membership creation', () =>
    assertFails(
      setDoc(doc(db('staff'), 'companies', 'b', 'members', 'staff'), {
        companyId: 'b',
        uid: 'staff',
        role: 'owner',
        status: 'active',
      }),
    ));
  it('6 protects audit history from every client', async () => {
    await assertFails(
      deleteDoc(doc(db('owner-a'), 'companies', 'a', 'auditLogs', 'event')),
    );
    await assertFails(
      updateDoc(doc(db('owner-a'), 'companies', 'a', 'auditLogs', 'event'), {
        action: 'changed',
      }),
    );
    await assertFails(
      setDoc(doc(db('owner-a'), 'companies', 'a', 'auditLogs', 'new'), {
        companyId: 'a',
      }),
    );
  });
  it('7 permits authorized admin read only', async () => {
    await assertSucceeds(getDoc(doc(db('admin-a'), 'companies', 'a')));
    await assertFails(getDoc(doc(db('admin-a'), 'companies', 'b')));
  });
  it('8 supports multiple memberships', async () => {
    await assertSucceeds(getDoc(doc(db('multi'), 'companies', 'a')));
    await assertSucceeds(getDoc(doc(db('multi'), 'companies', 'b')));
  });
  it('9 denies cross company writes', () =>
    assertFails(
      updateDoc(doc(db('owner-a'), 'companies', 'b'), { name: 'Intrusion' }),
    ));
  it('10 rejects invalid ownership', async () => {
    await assertFails(getDoc(doc(db('corrupt'), 'companies', 'a')));
    await assertFails(
      updateDoc(doc(db('owner-a'), 'companies', 'a'), { companyId: 'b' }),
    );
  });
  it('denies inactive membership and suspended companies', async () => {
    await assertFails(getDoc(doc(db('inactive'), 'companies', 'a')));
    await assertFails(getDoc(doc(db('owner-a'), 'companies', 'suspended')));
  });
  it('allows own directory but denies granting access', async () => {
    await assertSucceeds(
      getDocs(collection(db('staff'), 'users', 'staff', 'companyAccess')),
    );
    await assertFails(
      setDoc(doc(db('staff'), 'users', 'staff', 'companyAccess', 'b'), {
        companyId: 'b',
      }),
    );
    await assertFails(
      getDocs(collection(db('owner-a'), 'users', 'staff', 'companyAccess')),
    );
  });
  it('never allows a profile role to grant privileges', async () => {
    await assertFails(
      updateDoc(doc(db('staff'), 'users', 'staff'), { role: 'owner' }),
    );
    await assertSucceeds(
      updateDoc(doc(db('staff'), 'users', 'staff'), {
        displayName: 'Updated',
        updatedAt: serverTimestamp(),
        updatedBy: 'staff',
      }),
    );
    await assertFails(
      updateDoc(doc(db('staff'), 'users', 'staff'), { uid: 'owner-a' }),
    );
  });
  it('denies list discovery and future collections', async () => {
    await assertFails(getDocs(collection(db('owner-a'), 'companies')));
    await assertFails(
      getDocs(collection(db('owner-a'), 'companies', 'a', 'members')),
    );
    await assertFails(
      setDoc(doc(db('owner-a'), 'companies', 'a', 'tasks', 't'), {
        companyId: 'a',
      }),
    );
    await assertFails(
      getDoc(doc(db('owner-a'), 'companies', 'a', 'sites', 's')),
    );
  });
  it('allows own membership without exposing other staff', async () => {
    await assertSucceeds(
      getDoc(doc(db('staff'), 'companies', 'a', 'members', 'staff')),
    );
    await assertFails(
      getDoc(doc(db('staff'), 'companies', 'a', 'members', 'owner-a')),
    );
  });
  it('revocation takes effect on subsequent reads', async () => {
    await env.withSecurityRulesDisabled((c) =>
      setDoc(doc(c.firestore(), 'companies', 'a', 'members', 'revoked'), {
        ...meta,
        companyId: 'a',
        uid: 'revoked',
        role: 'admin',
        status: 'active',
      }),
    );
    await assertSucceeds(getDoc(doc(db('revoked'), 'companies', 'a')));
    await env.withSecurityRulesDisabled((c) =>
      updateDoc(doc(c.firestore(), 'companies', 'a', 'members', 'revoked'), {
        status: 'inactive',
      }),
    );
    await assertFails(getDoc(doc(db('revoked'), 'companies', 'a')));
  });
});
