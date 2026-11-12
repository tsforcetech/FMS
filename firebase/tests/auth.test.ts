import { beforeAll, afterAll, it, expect } from 'vitest';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  inMemoryPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  terminate,
} from 'firebase/firestore';
import {
  initializeApp as initAdmin,
  deleteApp as deleteAdmin,
} from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb, Timestamp } from 'firebase-admin/firestore';
import { loadAccess, loadProfile } from '../../apps/admin-web/src/data';
const client = initializeApp(
  {
    projectId: 'demo-facilityos',
    apiKey: 'demo-facilityos',
    appId: 'demo-web',
  },
  'integration',
);
const auth = getAuth(client),
  db = getFirestore(client);
let admin: ReturnType<typeof initAdmin>;
beforeAll(async () => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'
  )
    throw new Error('Both emulators required');
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  await setPersistence(auth, inMemoryPersistence);
  admin = initAdmin({ projectId: 'demo-facilityos' }, 'integration-admin');
  try {
    await adminAuth(admin).createUser({
      uid: 'integration-owner',
      email: 'integration@example.test',
      password: 'Local-only-123!',
    });
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/uid-already-exists') throw e;
  }
  const meta = {
    schemaVersion: 1,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: 'test',
    updatedBy: 'test',
  };
  const store = adminDb(admin);
  await store.doc('users/integration-owner').set({
    ...meta,
    uid: 'integration-owner',
    displayName: 'Integration Owner',
  });
  for (const id of ['integration-a', 'integration-b']) {
    await store.doc('companies/' + id).set({
      ...meta,
      companyId: id,
      name: id,
      status: 'active',
      timeZone: 'Asia/Dubai',
    });
    await store.doc(`companies/${id}/members/integration-owner`).set({
      ...meta,
      companyId: id,
      uid: 'integration-owner',
      role: 'owner',
      status: 'active',
    });
    await store
      .doc(`users/integration-owner/companyAccess/${id}`)
      .set({ companyId: id });
  }
});
afterAll(async () => {
  await signOut(auth);
  await terminate(db);
  await deleteApp(client);
  if (admin) await deleteAdmin(admin);
});
it('rejects failed login', async () => {
  await expect(
    signInWithEmailAndPassword(
      auth,
      'integration@example.test',
      'wrong-password',
    ),
  ).rejects.toBeDefined();
});
it('logs in, resolves profile and both companies, signs out and denies reads', async () => {
  const credential = await signInWithEmailAndPassword(
    auth,
    'integration@example.test',
    'Local-only-123!',
  );
  expect(credential.user.uid).toBe('integration-owner');
  const profile = await loadProfile(db, credential.user.uid);
  expect(profile.displayName).toBe('Integration Owner');
  const access = await loadAccess(db, credential.user.uid);
  expect(access.items.map((v) => v.company.companyId)).toEqual([
    'integration-a',
    'integration-b',
  ]);
  for (const a of access.items)
    expect(
      (await getDoc(doc(db, 'companies', a.company.companyId))).exists(),
    ).toBe(true);
  await signOut(auth);
  expect(auth.currentUser).toBe(null);
  await expect(
    getDoc(doc(db, 'companies', 'integration-a')),
  ).rejects.toBeDefined();
});
