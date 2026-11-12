import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
// Deliberately hard-coded loopback endpoints + demo project. Cannot seed production.
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
initializeApp({ projectId: 'demo-facilityos' });
const auth = getAuth(),
  db = getFirestore();
const password = 'Local-only-123!';
for (const [uid, email, name] of [
  ['local-owner', 'owner@example.test', 'Local Owner'],
  ['local-staff', 'staff@example.test', 'Local Staff'],
]) {
  try {
    await auth.getUser(uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    await auth.createUser({ uid, email, password, displayName: name });
  }
  const meta = {
    schemaVersion: 1,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'emulator-fixture',
    updatedBy: 'emulator-fixture',
  };
  await db.doc(`users/${uid}`).set({ ...meta, uid, displayName: name });
  for (const companyId of ['local-company-a', 'local-company-b']) {
    const batch = db.batch();
    batch.set(db.doc(`companies/${companyId}`), {
      ...meta,
      companyId,
      name:
        companyId === 'local-company-a'
          ? 'Emulator Company A'
          : 'Emulator Company B',
      status: 'active',
      timeZone: 'Asia/Dubai',
    });
    batch.set(db.doc(`companies/${companyId}/members/${uid}`), {
      ...meta,
      companyId,
      uid,
      role: uid === 'local-owner' ? 'owner' : 'staff',
      status: 'active',
    });
    batch.set(db.doc(`users/${uid}/companyAccess/${companyId}`), { companyId });
    await batch.commit();
  }
}
console.log(
  'Local emulators seeded. Test accounts: owner@example.test / staff@example.test; password: Local-only-123!',
);
