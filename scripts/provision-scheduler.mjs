// Trusted operator tool (Blaze scheduler): creates the scheduler service
// account (fixed uid, no email, no password) and makes it an active ADMIN
// member of one company, so the scheduled Cloud Function processes it.
// Revoke with --revoke (membership set inactive; the function then skips it).
//
//   node scripts/provision-scheduler.mjs --project facilityos-43386 \
//     --confirm-project facilityos-43386 --company <companyId> [--revoke]
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { parseArgs } from 'node:util';

const UID = 'facilityos-scheduler';
const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    'confirm-project': { type: 'string' },
    company: { type: 'string' },
    revoke: { type: 'boolean', default: false },
  },
});
const { project, company, revoke } = values;
if (!project || project !== values['confirm-project'] || !company)
  throw new Error(
    'Required: --project ID --confirm-project ID --company ID [--revoke]',
  );
const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (project.startsWith('demo-') !== emulator)
  throw new Error(
    'demo-* projects only with the emulators, real projects only without them.',
  );
initializeApp(
  emulator
    ? { projectId: project }
    : { credential: applicationDefault(), projectId: project },
);
const auth = getAuth();
await auth
  .getUser(UID)
  .catch(() =>
    auth.createUser({ uid: UID, displayName: 'FacilityOS scheduler (system)' }),
  );
const db = getFirestore();
const companyRef = db.doc(`companies/${company}`);
const memberRef = companyRef.collection('members').doc(UID);
const profileRef = db.doc(`users/${UID}`);
const accessRef = profileRef.collection('companyAccess').doc(company);
await db.runTransaction(async (tx) => {
  const [co, member, profile, access] = await tx.getAll(
    companyRef,
    memberRef,
    profileRef,
    accessRef,
  );
  if (!co.exists) throw new Error(`Company ${company} does not exist.`);
  const meta = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'trusted-provisioner',
  };
  if (revoke) {
    if (member.exists) tx.update(memberRef, { ...meta, status: 'inactive' });
  } else if (member.exists) {
    const m = member.data();
    if (m.role !== 'admin' || m.status !== 'active')
      tx.update(memberRef, { ...meta, role: 'admin', status: 'active' });
  } else {
    const created = {
      schemaVersion: 1,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: 'trusted-provisioner',
      ...meta,
    };
    tx.create(memberRef, {
      ...created,
      companyId: company,
      uid: UID,
      role: 'admin',
      status: 'active',
    });
    if (!profile.exists)
      tx.create(profileRef, {
        ...created,
        uid: UID,
        displayName: 'FacilityOS scheduler (system)',
      });
    if (!access.exists) tx.create(accessRef, { companyId: company });
  }
  tx.create(companyRef.collection('auditLogs').doc(), {
    schemaVersion: 1,
    companyId: company,
    actorUid: 'trusted-provisioner',
    action: revoke ? 'scheduler.revoked' : 'scheduler.provisioned',
    subjectPath: memberRef.path,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'trusted-provisioner',
    updatedBy: 'trusted-provisioner',
  });
});
console.log(
  `${revoke ? 'Revoked' : 'Provisioned'} the scheduler service account in ${company} (${project}).`,
);
