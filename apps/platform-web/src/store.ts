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
  where,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  applyAction,
  newSubscription,
  planSnapshot,
  planVersionId,
  type Invoice,
  type LifecycleAction,
  type PlanTerms,
  type PlatformRole,
  type Subscription,
  type Usage,
} from '@facilityos/shared';

/**
 * Sharaco platform data layer. Every privileged change is one batch that
 * also writes a platformEvents audit record by the same person; the security
 * rules refuse the change without it. Nothing here reads tenant operational
 * data — only the company directory record, its usage counters and, with a
 * tenant-approved grant, its setup summary.
 */
export class PlatformError extends Error {}
export async function platformRoleOf(
  user: User,
): Promise<{ role: PlatformRole | null; verified: boolean; mfa: boolean }> {
  const t = await user.getIdTokenResult(true);
  const role = (t.claims.platformRole as PlatformRole | undefined) || null;
  return {
    role,
    verified: user.emailVerified,
    mfa:
      !!t.claims.firebase &&
      !!(t.claims.firebase as { sign_in_second_factor?: string })
        .sign_in_second_factor,
  };
}
export const can = (
  role: PlatformRole | null,
  action: 'billing' | 'register' | 'support' | 'read',
) =>
  !!role &&
  (action === 'read'
    ? true
    : action === 'billing'
      ? ['owner', 'billing'].includes(role)
      : action === 'register'
        ? role === 'owner'
        : ['owner', 'support'].includes(role));

function event(
  db: Firestore,
  b: WriteBatch,
  uid: string,
  type: string,
  subject: string,
  detail: string,
) {
  const ref = doc(collection(db, 'platformEvents'));
  b.set(ref, {
    type,
    subject,
    actorUid: uid,
    at: serverTimestamp(),
    detail: detail.slice(0, 2000),
  });
  return ref.id;
}
const ts = (d: Date | null) => (d ? Timestamp.fromDate(d) : null);
const dt = (v: unknown) =>
  v && typeof (v as Timestamp).toDate === 'function'
    ? (v as Timestamp).toDate()
    : null;

/* ------------------------------------------------------------- companies */
export type CompanyRow = {
  id: string;
  name: string;
  status: string;
  timeZone: string;
  contactEmail?: string;
  plan?: ReturnType<typeof planSnapshot>;
  createdAt?: Timestamp;
};
export async function listCompanies(db: Firestore) {
  const r = await getDocs(query(collection(db, 'companies'), limit(500)));
  return r.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<CompanyRow, 'id'>),
  }));
}
export async function getUsageOf(db: Firestore, c: string) {
  const s = await getDoc(doc(db, 'companies', c, 'usage', 'counters'));
  return s.exists()
    ? (s.data() as Usage & { revision: number; updatedAt?: Timestamp })
    : null;
}
export function subFrom(
  id: string,
  x: Record<string, unknown>,
): Subscription & { id: string } {
  return {
    ...(x as unknown as Subscription),
    id,
    trialEndsAt: dt(x.trialEndsAt),
    periodStart: dt(x.periodStart),
    periodEnd: dt(x.periodEnd),
  };
}
export async function listSubs(db: Firestore) {
  const r = await getDocs(query(collection(db, 'platformSubs'), limit(500)));
  return r.docs.map((d) => subFrom(d.id, d.data()));
}
export async function getSub(db: Firestore, c: string) {
  const s = await getDoc(doc(db, 'platformSubs', c));
  return s.exists() ? subFrom(s.id, s.data()) : null;
}
function subDoc(s: Subscription, eventId: string, uid: string) {
  return {
    companyId: s.companyId,
    companyName: s.companyName,
    planId: s.planId,
    versionId: s.versionId,
    planName: s.planName,
    terms: s.terms,
    state: s.state,
    trialEndsAt: ts(s.trialEndsAt),
    periodStart: ts(s.periodStart),
    periodEnd: ts(s.periodEnd),
    graceDays: s.graceDays,
    revision: s.revision,
    eventId,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
}
function companyPatch(s: Subscription, eventId: string, uid: string) {
  const snap = planSnapshot(s);
  return {
    plan: snap,
    status: snap.access === 'read_only' ? 'read_only' : 'active',
    eventId,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };
}

/* ------------------------------------------------------------- plans */
export type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  status: 'active' | 'retired';
  currentVersion: number;
};
export type VersionRow = {
  id: string;
  planId: string;
  version: number;
  terms: PlanTerms;
  createdAt?: Timestamp;
};
export async function listPlans(db: Firestore) {
  const r = await getDocs(query(collection(db, 'platformPlans'), limit(100)));
  return r.docs.map((d) => ({ id: d.id, ...d.data() }) as PlanRow);
}
export async function listVersions(db: Firestore, planId: string) {
  const r = await getDocs(
    query(
      collection(db, 'platformPlanVersions'),
      where('planId', '==', planId),
      limit(100),
    ),
  );
  return r.docs
    .map((d) => ({ id: d.id, ...d.data() }) as VersionRow)
    .sort((a, b) => b.version - a.version);
}
function checkTerms(t: PlanTerms) {
  for (const [k, v] of Object.entries(t.limits))
    if (!Number.isInteger(v) || v < -1)
      throw new PlatformError(
        `Limit “${k}” must be a whole number, or -1 for unlimited.`,
      );
  if (!Number.isInteger(t.trialDays) || t.trialDays < 0 || t.trialDays > 90)
    throw new PlatformError('Trial days must be 0–90.');
  if (
    t.price &&
    (!(t.price.amount >= 0) || !/^[A-Z]{3}$/.test(t.price.currency))
  )
    throw new PlatformError(
      'Enter a valid list price and currency, or leave the price empty.',
    );
}
/**
 * Creates a plan or publishes a new version of it. Versions are immutable,
 * so existing subscriptions keep the terms they were sold on.
 */
export async function savePlan(
  db: Firestore,
  uid: string,
  input: {
    id?: string;
    code: string;
    name: string;
    description: string;
    status: 'active' | 'retired';
    terms: PlanTerms;
  },
) {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,30}$/.test(code))
    throw new PlatformError('Use a short code such as STARTER.');
  if (!input.name.trim()) throw new PlatformError('Enter a plan name.');
  checkTerms(input.terms);
  const id = input.id || code.toLowerCase();
  const prev = await getDoc(doc(db, 'platformPlans', id));
  if (!input.id && prev.exists())
    throw new PlatformError(
      'A plan with this code exists. Edit it to publish a new version.',
    );
  const version = (prev.data()?.currentVersion || 0) + 1;
  const b = writeBatch(db);
  const eventId = event(
    db,
    b,
    uid,
    prev.exists() ? 'plan.version' : 'plan.created',
    `plan/${id}`,
    `${input.name} v${version}`,
  );
  b.set(doc(db, 'platformPlans', id), {
    code,
    name: input.name.trim().slice(0, 80),
    description: input.description.slice(0, 500),
    status: input.status,
    currentVersion: version,
    eventId,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  b.set(doc(db, 'platformPlanVersions', planVersionId(id, version)), {
    planId: id,
    version,
    terms: input.terms,
    eventId,
    createdAt: serverTimestamp(),
    createdBy: uid,
  });
  await b.commit();
  return { id, version };
}

/* ------------------------------------------------------------- subscriptions */
async function versionWithName(db: Firestore, versionId: string) {
  const v = await getDoc(doc(db, 'platformPlanVersions', versionId));
  if (!v.exists()) throw new PlatformError('Plan version not found.');
  const p = await getDoc(doc(db, 'platformPlans', v.data().planId));
  return {
    id: v.id,
    planId: v.data().planId as string,
    version: v.data().version as number,
    terms: v.data().terms as PlanTerms,
    planName: (p.data()?.name as string) || v.data().planId,
  };
}
/** Assigns a plan (new subscription) to a company that has usage counters. */
export async function assignPlan(
  db: Firestore,
  uid: string,
  company: CompanyRow,
  versionId: string,
) {
  if (!(await getUsageOf(db, company.id)))
    throw new PlatformError(
      'This company has no usage counters yet. Run the usage reconciliation (scripts/usage-reconcile.ts --apply) for it first, so plan limits start from real counts.',
    );
  const v = await versionWithName(db, versionId);
  const s = newSubscription({ id: company.id, name: company.name }, v);
  const b = writeBatch(db);
  const eventId = event(
    db,
    b,
    uid,
    'subscription.assigned',
    company.id,
    `${v.planName} v${v.version}`,
  );
  b.set(doc(db, 'platformSubs', company.id), subDoc(s, eventId, uid));
  b.update(doc(db, 'companies', company.id), companyPatch(s, eventId, uid));
  await b.commit();
}
export async function lifecycle(
  db: Firestore,
  uid: string,
  c: string,
  action: LifecycleAction,
  input: { days?: number; versionId?: string } = {},
) {
  const cur = await getSub(db, c);
  if (!cur)
    throw new PlatformError(
      'No subscription for this company. Assign a plan first.',
    );
  const version = input.versionId
    ? await versionWithName(db, input.versionId)
    : undefined;
  let next: Subscription;
  try {
    next = applyAction(cur, action, { days: input.days, version });
  } catch (e) {
    throw new PlatformError((e as Error).message);
  }
  const b = writeBatch(db);
  const eventId = event(
    db,
    b,
    uid,
    `subscription.${action}`,
    c,
    `${cur.planName} → ${next.planName}${input.days ? ` (+${input.days} days)` : ''}`,
  );
  b.set(doc(db, 'platformSubs', c), subDoc(next, eventId, uid));
  b.update(doc(db, 'companies', c), companyPatch(next, eventId, uid));
  await b.commit();
}

/* ------------------------------------------------------------- registration */
function token() {
  const r = new Uint8Array(24);
  crypto.getRandomValues(r);
  return btoa(String.fromCharCode(...r))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
/**
 * Registers a new tenant: company record, zeroed usage counters, optional
 * plan and an owner invitation — one audited batch. The owner joins by
 * accepting the invitation with the invited, verified email.
 */
export async function registerCompany(
  db: Firestore,
  uid: string,
  input: {
    id: string;
    name: string;
    timeZone: string;
    ownerEmail: string;
    versionId: string;
  },
  adminBase: string,
) {
  const id = input.id.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,40}$/.test(id))
    throw new PlatformError(
      'Company ID: 3–41 lowercase letters, digits or hyphens.',
    );
  if (!input.name.trim()) throw new PlatformError('Enter the company name.');
  const email = input.ownerEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new PlatformError('Enter the owner’s email address.');
  if ((await getDoc(doc(db, 'companies', id)).catch(() => null))?.exists())
    throw new PlatformError('This company ID is taken.');
  const v = input.versionId ? await versionWithName(db, input.versionId) : null;
  const s = v ? newSubscription({ id, name: input.name.trim() }, v) : null;
  const b = writeBatch(db);
  const eventId = event(
    db,
    b,
    uid,
    'company.registered',
    id,
    `${input.name.trim()} · owner invitation for ${email}${v ? ` · ${v.planName}` : ''}`,
  );
  b.set(doc(db, 'companies', id), {
    schemaVersion: 1,
    companyId: id,
    name: input.name.trim().slice(0, 120),
    status: 'active',
    timeZone: input.timeZone,
    ...(s ? { plan: planSnapshot(s) } : {}),
    eventId,
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  b.set(doc(db, 'companies', id, 'usage', 'counters'), {
    sites: 0,
    employees: 0,
    assets: 0,
    recurringSchedules: 0,
    staffLinks: 0,
    last: '',
    revision: 0,
    updatedAt: serverTimestamp(),
  });
  if (s) b.set(doc(db, 'platformSubs', id), subDoc(s, eventId, uid));
  const t = token();
  b.set(doc(db, 'companies', id, 'invitations', t), {
    companyId: id,
    email,
    role: 'owner',
    siteIds: [],
    status: 'pending',
    expiresAt: Timestamp.fromMillis(Date.now() + 14 * 86400000),
    createdAt: serverTimestamp(),
    createdBy: uid,
    note: 'Company owner invitation from Sharaco',
  });
  await b.commit();
  return {
    id,
    link: `${adminBase}#/join?c=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`,
  };
}

/* ------------------------------------------------------------- invoices */
export async function listInvoices(db: Firestore) {
  const r = await getDocs(
    query(collection(db, 'platformInvoices'), limit(500)),
  );
  return r.docs.map((d) => {
    const x = d.data();
    return {
      ...(x as Invoice),
      id: d.id,
      periodStart: dt(x.periodStart)!,
      periodEnd: dt(x.periodEnd)!,
      paidAt: dt(x.paidAt),
    };
  });
}
/** Manual invoices only; provider-sourced records require the trusted backend. */
export async function saveInvoice(
  db: Firestore,
  uid: string,
  input: {
    id?: string;
    companyId: string;
    number: string;
    amount: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    status: Invoice['status'];
  },
) {
  if (!input.companyId) throw new PlatformError('Choose the company.');
  if (!input.number.trim())
    throw new PlatformError('Enter the invoice number.');
  if (!(input.amount >= 0))
    throw new PlatformError('Enter an amount of zero or more.');
  if (!/^[A-Z]{3}$/.test(input.currency))
    throw new PlatformError('Use a three-letter currency code.');
  const from = new Date(input.periodStart + 'T00:00:00Z'),
    to = new Date(input.periodEnd + 'T00:00:00Z');
  if (!(to > from))
    throw new PlatformError('The period end must be after its start.');
  const ref = input.id
    ? doc(db, 'platformInvoices', input.id)
    : doc(collection(db, 'platformInvoices'));
  const b = writeBatch(db);
  const eventId = event(
    db,
    b,
    uid,
    input.status === 'paid' ? 'invoice.paid_manual' : 'invoice.saved',
    input.companyId,
    `${input.number} ${input.currency} ${input.amount} (${input.status})`,
  );
  b.set(ref, {
    companyId: input.companyId,
    number: input.number.trim().slice(0, 40),
    amount: Math.round(input.amount * 100) / 100,
    currency: input.currency,
    periodStart: Timestamp.fromDate(from),
    periodEnd: Timestamp.fromDate(to),
    status: input.status,
    source: 'manual',
    paidAt: input.status === 'paid' ? serverTimestamp() : null,
    eventId,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
  await b.commit();
}

/* ------------------------------------------------------------- events & support */
export async function listEvents(db: Firestore, max = 200) {
  const r = await getDocs(
    query(collection(db, 'platformEvents'), orderBy('at', 'desc'), limit(max)),
  );
  return r.docs.map(
    (d) =>
      ({ id: d.id, ...d.data() }) as {
        id: string;
        type: string;
        subject: string;
        actorUid: string;
        at?: Timestamp;
        detail: string;
      },
  );
}
export async function requestSupport(
  db: Firestore,
  uid: string,
  c: string,
  reason: string,
) {
  if (!reason.trim()) throw new PlatformError('Explain why access is needed.');
  await setDoc(doc(db, 'companies', c, 'supportGrants', uid), {
    uid,
    reason: reason.trim().slice(0, 500),
    status: 'requested',
    requestedAt: serverTimestamp(),
    expiresAt: null,
    decidedBy: '',
  });
}
export async function myGrant(db: Firestore, uid: string, c: string) {
  const s = await getDoc(doc(db, 'companies', c, 'supportGrants', uid)).catch(
    () => null,
  );
  return s?.exists()
    ? (s.data() as {
        status: string;
        expiresAt: Timestamp | null;
        reason: string;
      })
    : null;
}
/** Setup summary readable only with an approved, unexpired grant. */
export async function supportSummary(db: Firestore, c: string) {
  const s = await getDoc(doc(db, 'companies', c, 'settings', 'onboarding'));
  return s.exists()
    ? (s.data() as { steps?: Record<string, boolean>; pack?: string })
    : { steps: {}, pack: '' };
}
/** Payment provider adapter: deliberately disabled until a trusted backend and provider are approved. */
export const paymentAdapter = {
  active: false,
  provider: null as string | null,
  reason:
    'Online payments need a trusted backend to verify provider webhooks (paid Firebase plan or another approved server). Not activated.',
};
