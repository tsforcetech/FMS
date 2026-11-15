import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { UserError } from './store';

/**
 * Phase 8 tenant-side SaaS data: invitations, joining a company, the
 * company's own invoices and support-access approvals.
 *
 * Invitations: an owner/admin creates companies/{c}/invitations/{token} for
 * an email address and role (owners only invite admins; nobody invites an
 * owner from the tenant side). The person signs in with that exact,
 * verified email and accepts: the security rules create their membership
 * only in the same batch that marks that invitation accepted. Delivery is
 * operator-assisted: the admin shares the link (no email service on Spark).
 */
export const invitableRoles = [
  'admin',
  'site_manager',
  'department_manager',
  'supervisor',
  'technician',
  'staff',
  'viewer',
  'customer',
] as const;
export type Invitation = {
  id: string;
  email: string;
  role: string;
  siteIds: string[];
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
  acceptedBy?: string;
  note: string;
};
const invites = (db: Firestore, c: string) =>
  collection(db, 'companies', c, 'invitations');
function token() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
export function inviteLink(c: string, t: string) {
  const base = window.location.origin + import.meta.env.BASE_URL;
  const hash =
    import.meta.env.VITE_ROUTER_MODE === 'hash' ||
    window.location.hash.startsWith('#/');
  return `${base}${hash ? '#/' : ''}join?c=${encodeURIComponent(c)}&t=${encodeURIComponent(t)}`;
}
export async function createInvitation(
  db: Firestore,
  c: string,
  uid: string,
  input: {
    email: string;
    role: string;
    siteIds: string[];
    note: string;
    days: number;
  },
) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new UserError('Enter a valid email address.');
  if (!(invitableRoles as readonly string[]).includes(input.role))
    throw new UserError('Choose a role.');
  if (input.days < 1 || input.days > 14)
    throw new UserError('Invitations expire after 1 to 14 days.');
  const t = token();
  await setDoc(doc(invites(db, c), t), {
    companyId: c,
    email,
    role: input.role,
    siteIds: input.siteIds.slice(0, 10),
    status: 'pending',
    expiresAt: Timestamp.fromMillis(Date.now() + input.days * 86400000),
    createdAt: serverTimestamp(),
    createdBy: uid,
    note: input.note.slice(0, 300),
  });
  return { token: t, link: inviteLink(c, t) };
}
export async function listInvitations(db: Firestore, c: string) {
  const r = await getDocs(
    query(invites(db, c), orderBy('createdAt', 'desc'), limit(100)),
  );
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as Invitation);
}
export async function revokeInvitation(db: Firestore, c: string, id: string) {
  await updateDoc(doc(invites(db, c), id), { status: 'revoked' });
}
/** Accepts an invitation as the signed-in, email-verified user (one atomic batch). */
export async function acceptInvitation(
  db: Firestore,
  c: string,
  t: string,
  user: {
    uid: string;
    email: string | null;
    emailVerified: boolean;
    displayName: string | null;
  },
) {
  if (!user.emailVerified)
    throw new UserError(
      'Verify your email address first, then accept the invitation.',
    );
  const inv = await getDoc(doc(invites(db, c), t)).catch(() => null);
  if (!inv?.exists())
    throw new UserError(
      'This invitation does not exist or was addressed to a different email.',
    );
  const d = inv.data() as Invitation;
  if (d.status !== 'pending')
    throw new UserError(
      d.status === 'accepted'
        ? 'This invitation was already accepted.'
        : 'This invitation was revoked.',
    );
  if (d.expiresAt.toMillis() < Date.now())
    throw new UserError('This invitation has expired. Ask for a new one.');
  if ((user.email || '').toLowerCase() !== d.email)
    throw new UserError(
      `This invitation is for ${d.email}. Sign in with that email.`,
    );
  const profile = await getDoc(doc(db, 'users', user.uid));
  const b = writeBatch(db);
  b.update(inv.ref, {
    status: 'accepted',
    acceptedBy: user.uid,
    acceptedAt: serverTimestamp(),
  });
  b.set(doc(db, 'companies', c, 'members', user.uid), {
    schemaVersion: 1,
    companyId: c,
    uid: user.uid,
    role: d.role,
    status: 'active',
    inviteId: t,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
  if (!profile.exists())
    b.set(doc(db, 'users', user.uid), {
      schemaVersion: 1,
      uid: user.uid,
      displayName: (user.displayName || d.email.split('@')[0]).slice(0, 100),
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid,
    });
  b.set(doc(db, 'users', user.uid, 'companyAccess', c), { companyId: c });
  await b.commit();
  return d.role;
}

/* ------------------------------------------------------------- invoices & support */
export async function companyInvoices(db: Firestore, c: string) {
  const r = await getDocs(
    query(
      collection(db, 'platformInvoices'),
      where('companyId', '==', c),
      limit(100),
    ),
  );
  return r.docs.map(
    (d) =>
      ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string },
  );
}
export type SupportGrant = {
  uid: string;
  reason: string;
  status: 'requested' | 'approved' | 'revoked';
  requestedAt: Timestamp;
  expiresAt: Timestamp | null;
  decidedBy: string;
};
export async function listGrants(db: Firestore, c: string) {
  const r = await getDocs(
    query(collection(db, 'companies', c, 'supportGrants'), limit(50)),
  );
  return r.docs.map((d) => d.data() as SupportGrant);
}
/** Approves summary-level support access for at most 72 hours, or revokes it. */
export async function decideGrant(
  db: Firestore,
  c: string,
  uid: string,
  grantUid: string,
  approve: boolean,
  hours = 24,
) {
  if (approve && (hours < 1 || hours > 72))
    throw new UserError('Approve support access for 1 to 72 hours.');
  await updateDoc(doc(db, 'companies', c, 'supportGrants', grantUid), {
    status: approve ? 'approved' : 'revoked',
    expiresAt: approve
      ? Timestamp.fromMillis(Date.now() + hours * 3600000)
      : null,
    decidedBy: uid,
  });
}
