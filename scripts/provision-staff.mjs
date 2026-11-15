// Trusted provisioning of a staff login (Phase 5). Run by the platform
// operator with Application Default Credentials; never shipped to browsers.
// Creates (or reuses) a Firebase Auth email/password account, a company
// membership with a non-admin staff role and the company directory entry.
// The account is then linked to an employee by an owner/admin in the admin
// portal (Administration → Staff access). Owner/admin roles are refused.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { parseArgs } from 'node:util';

const staffRoles = [
  'site_manager',
  'department_manager',
  'supervisor',
  'technician',
  'staff',
  'viewer',
  // Phase 7: customer portal logins. They are linked to a client (never an
  // employee) in Administration → Customer access.
  'customer',
];
const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    'confirm-project': { type: 'string' },
    company: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'technician' },
  },
});
const { project, company, email, name, role } = values;
if (
  !project ||
  project !== values['confirm-project'] ||
  !company ||
  !email ||
  !name
)
  throw new Error(
    'Required: --project ID --confirm-project ID --company ID --email EMAIL --name "FULL NAME" [--role technician]',
  );
if (!staffRoles.includes(role))
  throw new Error(
    `Role must be one of: ${staffRoles.join(', ')}. Owner/admin roles are not provisioned here.`,
  );
if (!/^[a-zA-Z0-9_-]{1,128}$/.test(company) || name.length > 100)
  throw new Error('Invalid company or name');
if (
  project.startsWith('demo-') ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST
)
  throw new Error('Use seed-emulator.mjs for local tests.');

initializeApp({ credential: applicationDefault(), projectId: project });
const auth = getAuth();
let user;
try {
  user = await auth.getUserByEmail(email);
} catch (e) {
  if (e.code !== 'auth/user-not-found') throw e;
  // No password is chosen or printed: the person sets it from the reset link.
  user = await auth.createUser({
    email,
    displayName: name,
    emailVerified: false,
    disabled: false,
  });
}
if (user.disabled) throw new Error('This login is disabled. Enable it first.');
const db = getFirestore();
const companyRef = db.doc(`companies/${company}`);
const memberRef = companyRef.collection('members').doc(user.uid);
const profileRef = db.doc(`users/${user.uid}`);
const directoryRef = profileRef.collection('companyAccess').doc(company);
await db.runTransaction(async (tx) => {
  const [c, m, p] = await tx.getAll(companyRef, memberRef, profileRef);
  if (!c.exists || c.data().status !== 'active')
    throw new Error('Company not found or not active.');
  if (m.exists && ['owner', 'admin'].includes(m.data().role))
    throw new Error('This login is an owner/admin. Refusing to change it.');
  if (m.exists && (m.data().role === 'customer') !== (role === 'customer'))
    throw new Error(
      'Refusing to convert between a staff login and a customer login. Use a separate email address.',
    );
  const meta = {
    schemaVersion: 1,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: 'trusted-provisioner',
  };
  tx.set(memberRef, {
    ...meta,
    companyId: company,
    uid: user.uid,
    role,
    status: 'active',
    createdAt: m.exists ? m.data().createdAt : FieldValue.serverTimestamp(),
    createdBy: m.exists ? m.data().createdBy : 'trusted-provisioner',
  });
  if (!p.exists)
    tx.create(profileRef, {
      ...meta,
      uid: user.uid,
      displayName: name,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: 'trusted-provisioner',
    });
  tx.set(directoryRef, { companyId: company });
  tx.create(companyRef.collection('auditLogs').doc(), {
    ...meta,
    companyId: company,
    actorUid: 'trusted-provisioner',
    action: 'company.staff.provisioned',
    subjectPath: memberRef.path,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: 'trusted-provisioner',
  });
});
const link = await auth.generatePasswordResetLink(email);
console.log(
  `Provisioned ${role} login ${user.uid} in company ${company}. Share this one-time password-setup link with the person privately:\n${link}`,
);
console.log(
  role === 'customer'
    ? 'Next: link the login to the client in Administration → Customer access.'
    : 'Next: link the login to the employee in Administration → Staff access.',
);
