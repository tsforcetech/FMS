// Trusted operator tool (Phase 8): grants or revokes a Sharaco platform role
// as a Firebase Auth custom claim. Platform authority comes ONLY from this
// claim — never from a tenant membership — and only this Admin SDK script
// (run with the operator's Application Default Credentials) can set it.
//
//   node scripts/grant-platform-role.mjs --project facilityos-43386 \
//     --confirm-project facilityos-43386 --email ops@sharaco.example --role billing
//   node scripts/grant-platform-role.mjs ... --email x@y --revoke
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { parseArgs } from 'node:util';

const roles = ['owner', 'billing', 'support', 'viewer'];
const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    'confirm-project': { type: 'string' },
    email: { type: 'string' },
    role: { type: 'string' },
    revoke: { type: 'boolean', default: false },
  },
});
const { project, email, role, revoke } = values;
if (
  !project ||
  project !== values['confirm-project'] ||
  !email ||
  (!revoke && !roles.includes(role || ''))
)
  throw new Error(
    `Required: --project ID --confirm-project ID --email EMAIL (--role ${roles.join('|')} | --revoke)`,
  );
const emulator = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
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
const user = await auth.getUserByEmail(email);
if (!user.emailVerified && !revoke)
  throw new Error(
    'The account email is not verified. Platform roles require a verified email (the security rules check it).',
  );
const claims = { ...(user.customClaims || {}) };
if (revoke) delete claims.platformRole;
else claims.platformRole = role;
await auth.setCustomUserClaims(user.uid, claims);
// Revoke refresh tokens so a removed or changed role takes effect immediately.
await auth.revokeRefreshTokens(user.uid);
await getFirestore()
  .collection('platformEvents')
  .add({
    type: revoke ? 'platform.role.revoked' : 'platform.role.granted',
    subject: `user/${user.uid}`,
    actorUid: 'trusted-operator',
    at: FieldValue.serverTimestamp(),
    detail: revoke
      ? `Platform role removed from ${email}`
      : `Platform role ${role} granted to ${email}`,
  });
console.log(
  `${revoke ? 'Revoked platform role from' : `Granted ${role} to`} ${email} (${user.uid}). The person must sign in again.`,
);
