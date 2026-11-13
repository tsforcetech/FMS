import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { parseArgs } from 'node:util';
const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    'confirm-project': { type: 'string' },
    company: { type: 'string' },
    name: { type: 'string' },
    uid: { type: 'string' },
    'time-zone': { type: 'string', default: 'Asia/Dubai' },
  },
});
const { project, company, name, uid } = values;
if (
  !project ||
  project !== values['confirm-project'] ||
  !company ||
  !name ||
  !uid
)
  throw new Error(
    'Required: --project ID --confirm-project ID --company ID --name NAME --uid EXISTING_AUTH_UID',
  );
if (
  project.startsWith('demo-') ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST
)
  throw new Error('Use seed-emulator.mjs for local tests.');
if (!/^[a-zA-Z0-9_-]{1,128}$/.test(company) || name.length > 120)
  throw new Error('Invalid company identifier or name');
new Intl.DateTimeFormat('en', { timeZone: values['time-zone'] });
initializeApp({ credential: applicationDefault(), projectId: project });
const authUser = await getAuth().getUser(uid);
if (authUser.disabled || !authUser.email)
  throw new Error('Owner must be an enabled, existing email/password account');
if (!authUser.providerData.some((p) => p.providerId === 'password'))
  throw new Error('Enable password authentication for this owner first');
const db = getFirestore();
const companyRef = db.doc(`companies/${company}`),
  memberRef = companyRef.collection('members').doc(uid),
  profileRef = db.doc(`users/${uid}`),
  directoryRef = profileRef.collection('companyAccess').doc(company),
  auditRef = companyRef.collection('auditLogs').doc();
await db.runTransaction(async (tx) => {
  const [existingCompany, existingMember, profile, directory] = await tx.getAll(
    companyRef,
    memberRef,
    profileRef,
    directoryRef,
  );
  if (existingCompany.exists || existingMember.exists || directory.exists)
    throw new Error(
      'Existing company or membership found. Refusing to overwrite.',
    );
  const metadata = {
    schemaVersion: 1,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'trusted-provisioner',
    updatedBy: 'trusted-provisioner',
  };
  tx.create(companyRef, {
    ...metadata,
    companyId: company,
    name,
    status: 'active',
    timeZone: values['time-zone'],
  });
  tx.create(memberRef, {
    ...metadata,
    companyId: company,
    uid,
    role: 'owner',
    status: 'active',
  });
  if (!profile.exists)
    tx.create(profileRef, {
      ...metadata,
      uid,
      displayName: (authUser.displayName || authUser.email).slice(0, 100),
    });
  tx.create(directoryRef, { companyId: company });
  tx.create(auditRef, {
    ...metadata,
    companyId: company,
    actorUid: 'trusted-provisioner',
    action: 'company.owner.provisioned',
    subjectPath: memberRef.path,
  });
});
console.log(
  `Provisioned company ${company} in explicitly selected project ${project}. No password or credential was written to disk.`,
);
