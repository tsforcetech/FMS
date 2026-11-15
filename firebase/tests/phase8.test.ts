import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { beforeAll, afterAll, it, expect, describe } from 'vitest';
import {
  autoMap,
  classifyRows,
  defaultValues,
  examplePlans,
  parseCsv,
  starterPacks,
  stockReconciliation,
  summarize,
  type Kind,
  type Values,
} from '../../packages/shared/src';
import {
  saveRecord,
  listBalances,
} from '../../apps/admin-web/src/management/store';
import {
  executeImport,
  getSession,
  listSessions,
  loadContext,
  saveDryRun,
} from '../../apps/admin-web/src/management/importStore';
import {
  getOnboarding,
  installPack,
  saveOnboarding,
} from '../../apps/admin-web/src/management/onboardingStore';
import { listSchedules } from '../../apps/admin-web/src/management/scheduling';
import { listVersions } from '../../apps/admin-web/src/management/tasksStore';
import {
  acceptInvitation,
  createInvitation,
  decideGrant,
} from '../../apps/admin-web/src/management/tenantSaas';
import {
  loadAttendance,
  loadMovements,
} from '../../apps/admin-web/src/management/reportsStore';
import {
  assignPlan,
  lifecycle,
  listCompanies,
  registerCompany,
  requestSupport,
  saveInvoice,
  savePlan,
  supportSummary,
} from '../../apps/platform-web/src/store';

let env: RulesTestEnvironment;
const tenant = (uid: string) =>
  env
    .authenticatedContext(uid, { email: `${uid}@t.test`, email_verified: true })
    .firestore() as unknown as Firestore;
const platform = (uid: string, role: string, verified = true) =>
  env
    .authenticatedContext(uid, {
      platformRole: role,
      email_verified: verified,
      email: `${uid}@sharaco.test`,
    })
    .firestore() as unknown as Firestore;
const person = (uid: string, email: string, verified = true) =>
  env
    .authenticatedContext(uid, { email, email_verified: verified })
    .firestore() as unknown as Firestore;
const meta = {
  schemaVersion: 1,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  createdBy: 'operator',
  updatedBy: 'operator',
};
let owner: Firestore, admin: Firestore, ownerB: Firestore;
let pOwner: Firestore,
  pBilling: Firestore,
  pSupport: Firestore,
  pViewer: Firestore;

beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw new Error('Emulator required');
  env = await initializeTestEnvironment({
    projectId: 'demo-facilityos-phase8',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firebase/firestore.rules', 'utf8'),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const f = c.firestore();
    for (const id of ['a', 'b'])
      await setDoc(doc(f, 'companies', id), {
        ...meta,
        companyId: id,
        name: id.toUpperCase(),
        status: 'active',
        timeZone: 'Asia/Dubai',
      });
    for (const [co, uid, role] of [
      ['a', 'ownera', 'owner'],
      ['a', 'admina', 'admin'],
      ['a', 'staffa', 'staff'],
      ['b', 'ownerb', 'owner'],
    ])
      await setDoc(doc(f, 'companies', co, 'members', uid), {
        ...meta,
        companyId: co,
        uid,
        role,
        status: 'active',
      });
  });
  owner = tenant('ownera');
  admin = tenant('admina');
  ownerB = tenant('ownerb');
  pOwner = platform('powner', 'owner');
  pBilling = platform('pbilling', 'billing');
  pSupport = platform('psupport', 'support');
  pViewer = platform('pviewer', 'viewer');
});
afterAll(async () => {
  await env?.cleanup();
});
let seq = 0;
const create = (kind: Kind, v: Values = {}, db = owner, c = 'a') =>
  saveRecord(db, c, c === 'a' ? 'ownera' : 'ownerb', kind, {
    ...defaultValues(kind),
    code: `P8X${++seq}`,
    name: `Record ${seq}`,
    ...v,
  });
const usage = (db: Firestore, c = 'a') =>
  getDoc(doc(db, 'companies', c, 'usage', 'counters'));
async function setUsage(c: string, counts: Record<string, number>) {
  await env.withSecurityRulesDisabled(async (x) => {
    await setDoc(doc(x.firestore(), 'companies', c, 'usage', 'counters'), {
      sites: 0,
      employees: 0,
      assets: 0,
      recurringSchedules: 0,
      staffLinks: 0,
      ...counts,
      last: '',
      revision: 1,
      updatedAt: Timestamp.now(),
    });
  });
}

describe('platform identity and plans', () => {
  it('only verified platform-claim accounts reach platform data; tenant admins never do', async () => {
    for (const db of [owner, admin, tenant('nobody')]) {
      await assertFails(getDocs(collection(db, 'platformEvents')));
      await assertFails(getDocs(collection(db, 'platformSubs')));
      await assertFails(
        addDoc(collection(db, 'platformEvents'), {
          type: 'x',
          subject: 'a',
          actorUid: 'ownera',
          at: serverTimestamp(),
          detail: '',
        }),
      );
      await assertFails(getDocs(collection(db, 'companies')));
    }
    // A claim without a verified email is not enough.
    await assertFails(
      getDocs(collection(platform('pnv', 'owner', false), 'platformEvents')),
    );
    await assertSucceeds(getDocs(collection(pViewer, 'companies')));
    // Platform staff never read tenant operational data.
    for (const db of [pOwner, pBilling, pSupport, pViewer]) {
      await assertFails(getDocs(collection(db, 'companies', 'a', 'sites')));
      await assertFails(getDocs(collection(db, 'companies', 'a', 'tasks')));
      await assertFails(getDocs(collection(db, 'companies', 'a', 'employees')));
    }
  });
  it('plans are versioned, audited and writable by owner/billing only', async () => {
    const r = await savePlan(pBilling, 'pbilling', {
      code: 'STARTER',
      name: 'Starter',
      description: '',
      status: 'active',
      terms: {
        ...examplePlans[1].terms,
        limits: { ...examplePlans[1].terms.limits, sites: 2 },
      },
    });
    expect(r).toEqual({ id: 'starter', version: 1 });
    const r2 = await savePlan(pBilling, 'pbilling', {
      id: 'starter',
      code: 'STARTER',
      name: 'Starter',
      description: 'v2',
      status: 'active',
      terms: examplePlans[1].terms,
    });
    expect(r2.version).toBe(2);
    await expect(
      savePlan(pSupport, 'psupport', {
        code: 'X1',
        name: 'X',
        description: '',
        status: 'active',
        terms: examplePlans[0].terms,
      }),
    ).rejects.toThrow();
    await expect(
      savePlan(owner, 'ownera', {
        code: 'X2',
        name: 'X',
        description: '',
        status: 'active',
        terms: examplePlans[0].terms,
      }),
    ).rejects.toThrow();
    // Without its audit event in the same batch, a plan write is refused.
    await assertFails(
      setDoc(doc(pOwner, 'platformPlans', 'sneaky'), {
        code: 'S',
        name: 'S',
        status: 'active',
        currentVersion: 1,
        eventId: 'none',
      }),
    );
    // Versions are immutable.
    await assertFails(
      updateDoc(doc(pOwner, 'platformPlanVersions', 'starter_v1'), {
        terms: examplePlans[3].terms,
      }),
    );
  });
  it('forged audit events and browser payment records are refused', async () => {
    const old = await addDoc(collection(pBilling, 'platformEvents'), {
      type: 't',
      subject: 'a',
      actorUid: 'pbilling',
      at: serverTimestamp(),
      detail: '',
    });
    // Reusing an earlier event (not written in this request) fails.
    await assertFails(
      setDoc(doc(pBilling, 'platformSubs', 'a'), {
        companyId: 'a',
        eventId: old.id,
        state: 'running',
      }),
    );
    // An event attributed to someone else fails.
    await assertFails(
      addDoc(collection(pBilling, 'platformEvents'), {
        type: 't',
        subject: 'a',
        actorUid: 'powner',
        at: serverTimestamp(),
        detail: '',
      }),
    );
    // Events are append-only.
    await assertFails(updateDoc(old, { detail: 'changed' }));
    // Provider payment records can only come from the trusted backend.
    await assertFails(
      setDoc(doc(pOwner, 'platformPayments', 'p1'), {
        companyId: 'a',
        amount: 100,
        status: 'succeeded',
      }),
    );
    const b = writeBatch(pBilling);
    const ev = doc(collection(pBilling, 'platformEvents'));
    b.set(ev, {
      type: 'invoice',
      subject: 'a',
      actorUid: 'pbilling',
      at: serverTimestamp(),
      detail: '',
    });
    b.set(doc(pBilling, 'platformInvoices', 'forged'), {
      companyId: 'a',
      amount: 1,
      status: 'paid',
      source: 'provider',
      eventId: ev.id,
    });
    await assertFails(b.commit());
    // Tenants cannot mark anything paid.
    await assertFails(
      setDoc(doc(owner, 'platformInvoices', 'x'), {
        companyId: 'a',
        amount: 1,
        status: 'paid',
        source: 'manual',
        eventId: 'x',
      }),
    );
  });
});

describe('subscriptions, suspension and entitlements', () => {
  let company: Awaited<ReturnType<typeof listCompanies>>[number];
  it('refuses a plan until usage counters exist, then activates with an entitlement snapshot', async () => {
    company = (await listCompanies(pOwner)).find((c) => c.id === 'a')!;
    await expect(
      assignPlan(pBilling, 'pbilling', company, 'starter_v1'),
    ).rejects.toThrow(/usage counters/);
    // Tenants can never create or reset their own counters.
    await assertFails(
      setDoc(doc(owner, 'companies', 'a', 'usage', 'counters'), {
        sites: 0,
        employees: 0,
        assets: 0,
        recurringSchedules: 0,
        staffLinks: 0,
        last: '',
        revision: 0,
        updatedAt: serverTimestamp(),
      }),
    );
    await setUsage('a', { sites: 1 }); // trusted reconciliation
    await assignPlan(pBilling, 'pbilling', company, 'starter_v1');
    const co = (await getDoc(doc(owner, 'companies', 'a'))).data()!;
    expect(co.plan).toMatchObject({
      planName: 'Starter',
      access: 'full',
      limits: { sites: 2 },
    });
    // Tenant admins cannot change their own plan or status.
    await assertFails(
      updateDoc(doc(owner, 'companies', 'a'), { 'plan.limits.sites': 999 }),
    );
    await assertFails(
      updateDoc(doc(owner, 'companies', 'a'), { status: 'active', name: 'A' }),
    );
    // Viewers and support cannot change subscriptions.
    await expect(lifecycle(pViewer, 'pviewer', 'a', 'renew')).rejects.toThrow();
    await expect(
      lifecycle(pSupport, 'psupport', 'a', 'suspend'),
    ).rejects.toThrow();
  });
  it('enforces the site limit at the write boundary, including concurrent creates', async () => {
    await create('sites'); // 2 of 2
    expect((await usage(owner)).data()!.sites).toBe(2);
    await expect(create('sites')).rejects.toThrow(/plan allows 2/);
    // Bypassing the client: a raw create without a usage bump is refused by the rules.
    await assertFails(
      setDoc(doc(owner, 'companies', 'a', 'sites', 'raw1'), {
        companyId: 'a',
        schemaVersion: 2,
        code: 'RAW1',
        name: 'Raw',
        notes: '',
        status: 'active',
        refCount: 0,
        witnessKind: '',
        witnessId: '',
        revision: 1,
        createdAt: serverTimestamp(),
        createdBy: 'ownera',
        updatedAt: serverTimestamp(),
        updatedBy: 'ownera',
      }),
    );
    // Concurrency: one slot left → exactly one of two simultaneous creates wins.
    await setUsage('a', { sites: 1 });
    const results = await Promise.allSettled([
      create('sites'),
      create('sites'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await usage(owner)).data()!.sites).toBe(2);
    // Tenants cannot lower their own counters.
    const u = (await usage(owner)).data()!;
    await assertFails(
      updateDoc(doc(owner, 'companies', 'a', 'usage', 'counters'), {
        sites: 0,
        last: 'sites/x',
        revision: u.revision + 1,
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it('plan features gate the customer portal', async () => {
    await env.withSecurityRulesDisabled(async (x) => {
      await setDoc(doc(x.firestore(), 'companies', 'a', 'members', 'custa'), {
        ...meta,
        companyId: 'a',
        uid: 'custa',
        role: 'customer',
        status: 'active',
      });
      await updateDoc(doc(x.firestore(), 'companies', 'a'), {
        'plan.features.customerPortal': false,
      });
    });
    const client = await create('clients');
    await assertFails(
      setDoc(doc(owner, 'companies', 'a', 'customerLinks', 'custa'), {
        companyId: 'a',
        schemaVersion: 1,
        uid: 'custa',
        clientId: client,
        clientName: 'C',
        contactName: '',
        allocationIds: [],
        places: [],
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: 'ownera',
        updatedAt: serverTimestamp(),
        updatedBy: 'ownera',
        revision: 1,
      }),
    );
    await env.withSecurityRulesDisabled(async (x) =>
      updateDoc(doc(x.firestore(), 'companies', 'a'), {
        'plan.features.customerPortal': true,
      }),
    );
  });
  it('suspension is read-only and never loses data; reactivation restores writes', async () => {
    const before = (await getDocs(collection(owner, 'companies', 'a', 'sites')))
      .size;
    await lifecycle(pBilling, 'pbilling', 'a', 'suspend');
    const co = (await getDoc(doc(owner, 'companies', 'a'))).data()!;
    expect(co.status).toBe('read_only');
    expect(co.plan.status).toBe('suspended');
    expect(
      (await getDocs(collection(owner, 'companies', 'a', 'sites'))).size,
    ).toBe(before);
    await expect(create('departments')).rejects.toThrow();
    // Exports stay possible (audit log entry) while read-only.
    await assertSucceeds(
      addDoc(collection(owner, 'companies', 'a', 'exportLogs'), {
        companyId: 'a',
        report: 'records.sites',
        format: 'xlsx',
        scope: 'all',
        rows: before,
        filters: '',
        by: 'ownera',
        at: serverTimestamp(),
      }),
    );
    await lifecycle(pBilling, 'pbilling', 'a', 'reactivate');
    expect((await getDoc(doc(owner, 'companies', 'a'))).data()!.status).toBe(
      'active',
    );
    await create('departments');
  });
  it('renewal, trial extension and plan change are recorded with history', async () => {
    await lifecycle(pBilling, 'pbilling', 'a', 'change_plan', {
      versionId: 'starter_v2',
    });
    await lifecycle(pBilling, 'pbilling', 'a', 'renew');
    const s = (await getDoc(doc(pViewer, 'platformSubs', 'a'))).data()!;
    expect(s.versionId).toBe('starter_v2');
    expect(s.revision).toBeGreaterThanOrEqual(5);
    const events = (
      await getDocs(collection(pViewer, 'platformEvents'))
    ).docs.map((d) => d.data().type);
    expect(events).toEqual(
      expect.arrayContaining([
        'subscription.assigned',
        'subscription.suspend',
        'subscription.reactivate',
        'subscription.change_plan',
        'subscription.renew',
      ]),
    );
    // Billing records: manual only; tenant sees only its own.
    await saveInvoice(pBilling, 'pbilling', {
      companyId: 'a',
      number: 'INV-1',
      amount: 1200,
      currency: 'AED',
      periodStart: '2026-01-01',
      periodEnd: '2027-01-01',
      status: 'paid',
    });
    await saveInvoice(pBilling, 'pbilling', {
      companyId: 'b',
      number: 'INV-2',
      amount: 99,
      currency: 'AED',
      periodStart: '2026-01-01',
      periodEnd: '2026-02-01',
      status: 'issued',
    });
    const { where, query } = await import('firebase/firestore');
    expect(
      (
        await getDocs(
          query(
            collection(owner, 'platformInvoices'),
            where('companyId', '==', 'a'),
          ),
        )
      ).size,
    ).toBe(1);
    await assertFails(
      getDocs(
        query(
          collection(owner, 'platformInvoices'),
          where('companyId', '==', 'b'),
        ),
      ),
    );
  });
});

describe('registration, invitations and support access', () => {
  it('registers a tenant with zero usage and an owner invitation, in one audited batch', async () => {
    const r = await registerCompany(
      pOwner,
      'powner',
      {
        id: 'newco',
        name: 'New Co',
        timeZone: 'Asia/Dubai',
        ownerEmail: 'boss@newco.test',
        versionId: 'starter_v2',
      },
      'https://x/FMS/',
    );
    expect(r.link).toMatch(/#\/join\?c=newco&t=/);
    await expect(
      registerCompany(
        pBilling,
        'pbilling',
        {
          id: 'other',
          name: 'O',
          timeZone: 'Asia/Dubai',
          ownerEmail: 'o@o.test',
          versionId: '',
        },
        '',
      ),
    ).rejects.toThrow();
    const token = decodeURIComponent(r.link.split('t=')[1]);
    // Wrong email or unverified email cannot accept.
    await expect(
      acceptInvitation(person('intruder', 'intruder@x.test'), 'newco', token, {
        uid: 'intruder',
        email: 'intruder@x.test',
        emailVerified: true,
        displayName: null,
      }),
    ).rejects.toThrow();
    const unverified = person('boss', 'boss@newco.test', false);
    await assertFails(
      setDoc(doc(unverified, 'companies', 'newco', 'members', 'boss'), {
        ...meta,
        createdAt: serverTimestamp(),
        companyId: 'newco',
        uid: 'boss',
        role: 'owner',
        status: 'active',
        inviteId: token,
      }),
    );
    const boss = person('boss', 'boss@newco.test');
    expect(
      await acceptInvitation(boss, 'newco', token, {
        uid: 'boss',
        email: 'boss@newco.test',
        emailVerified: true,
        displayName: 'Boss',
      }),
    ).toBe('owner');
    expect(
      (await getDoc(doc(boss, 'companies', 'newco', 'members', 'boss'))).data()!
        .role,
    ).toBe('owner');
    expect(
      (
        await getDoc(doc(boss, 'companies', 'newco', 'usage', 'counters'))
      ).data()!.sites,
    ).toBe(0);
    // An accepted invitation cannot be reused.
    await expect(
      acceptInvitation(person('boss2', 'boss@newco.test'), 'newco', token, {
        uid: 'boss2',
        email: 'boss@newco.test',
        emailVerified: true,
        displayName: null,
      }),
    ).rejects.toThrow();
  });
  it('tenant invitations cannot escalate roles', async () => {
    const r = await createInvitation(admin, 'a', 'admina', {
      email: 'tech@a.test',
      role: 'technician',
      siteIds: [],
      note: '',
      days: 7,
    });
    // Admins cannot invite admins; nobody invites an owner from the tenant side.
    await expect(
      createInvitation(admin, 'a', 'admina', {
        email: 'x@a.test',
        role: 'admin',
        siteIds: [],
        note: '',
        days: 7,
      }),
    ).rejects.toThrow();
    await expect(
      createInvitation(owner, 'a', 'ownera', {
        email: 'y@a.test',
        role: 'owner',
        siteIds: [],
        note: '',
        days: 7,
      }),
    ).rejects.toThrow();
    await createInvitation(owner, 'a', 'ownera', {
      email: 'z@a.test',
      role: 'admin',
      siteIds: [],
      note: '',
      days: 7,
    });
    // The invitee cannot pick a higher role than the invitation.
    const tech = person('tech', 'tech@a.test');
    const b = writeBatch(tech);
    b.update(doc(tech, 'companies', 'a', 'invitations', r.token), {
      status: 'accepted',
      acceptedBy: 'tech',
      acceptedAt: serverTimestamp(),
    });
    b.set(doc(tech, 'companies', 'a', 'members', 'tech'), {
      ...meta,
      createdAt: serverTimestamp(),
      companyId: 'a',
      uid: 'tech',
      role: 'admin',
      status: 'active',
      inviteId: r.token,
    });
    await assertFails(b.commit());
    expect(
      await acceptInvitation(tech, 'a', r.token, {
        uid: 'tech',
        email: 'tech@a.test',
        emailVerified: true,
        displayName: 'Tech',
      }),
    ).toBe('technician');
    // Staff can't create invitations; other companies can't see them.
    await assertFails(
      addDoc(collection(tenant('staffa'), 'companies', 'a', 'invitations'), {
        email: 'q@q.test',
      }),
    );
    await assertFails(
      getDocs(collection(ownerB, 'companies', 'a', 'invitations')),
    );
  });
  it('support access needs a tenant-approved, time-boxed grant and never reaches operational data', async () => {
    await saveOnboarding(owner, 'a', 'ownera', {
      steps: { company: true },
      pack: 'business_center',
    });
    await expect(supportSummary(pSupport, 'a')).rejects.toThrow();
    await assertFails(
      getDoc(doc(pSupport, 'companies', 'a', 'usage', 'counters')),
    );
    await requestSupport(
      pSupport,
      'psupport',
      'a',
      'Customer asked for setup help',
    );
    await expect(supportSummary(pSupport, 'a')).rejects.toThrow();
    // The support agent cannot approve their own request; 72h is the maximum.
    await assertFails(
      updateDoc(doc(pSupport, 'companies', 'a', 'supportGrants', 'psupport'), {
        status: 'approved',
        expiresAt: Timestamp.fromMillis(Date.now() + 3600000),
        decidedBy: 'psupport',
      }),
    );
    await expect(
      decideGrant(owner, 'a', 'ownera', 'psupport', true, 100),
    ).rejects.toThrow();
    await assertFails(
      updateDoc(doc(owner, 'companies', 'a', 'supportGrants', 'psupport'), {
        status: 'approved',
        expiresAt: Timestamp.fromMillis(Date.now() + 100 * 3600000),
        decidedBy: 'ownera',
      }),
    );
    await decideGrant(owner, 'a', 'ownera', 'psupport', true, 24);
    expect((await supportSummary(pSupport, 'a')).pack).toBe('business_center');
    await assertSucceeds(
      getDoc(doc(pSupport, 'companies', 'a', 'usage', 'counters')),
    );
    await assertFails(getDocs(collection(pSupport, 'companies', 'a', 'sites')));
    await assertFails(getDocs(collection(pSupport, 'companies', 'a', 'tasks')));
    // A grant for company A gives nothing in company B.
    await assertFails(
      getDoc(doc(pSupport, 'companies', 'b', 'settings', 'onboarding')),
    );
    await decideGrant(owner, 'a', 'ownera', 'psupport', false);
    await expect(supportSummary(pSupport, 'a')).rejects.toThrow();
  });
});

describe('import center', () => {
  const csv = (rows: string[][]) =>
    new TextEncoder().encode(rows.map((r) => r.join(',')).join('\r\n'));
  it('dry run writes nothing; import creates; repeat import creates no duplicates', async () => {
    const rows = parseCsv(
      new TextDecoder().decode(
        csv([
          ['Code', 'Name', 'Status'],
          ['IMP-HK', 'Housekeeping', 'active'],
          ['IMP-MEP', 'MEP', 'active'],
          ['IMP-HK', 'Dup', 'active'],
          ['bad code!', 'X', 'active'],
        ]),
      ),
    );
    const map = autoMap('departments', rows[0]);
    const ctx = await loadContext(
      ownerB,
      'b',
      'departments',
      rows.slice(1),
      map,
    );
    const preview = classifyRows('departments', rows.slice(1), map, ctx);
    expect(summarize(preview)).toMatchObject({
      new: 2,
      duplicate: 1,
      invalid: 1,
    });
    const session = await saveDryRun(ownerB, 'b', 'ownerb', {
      module: 'departments',
      fileName: 'deps.csv',
      fileHash: 'hash1',
      mapping: map,
      rows: preview,
      counts: summarize(preview),
    });
    expect(
      (await getDocs(collection(ownerB, 'companies', 'b', 'departments'))).size,
    ).toBe(0);
    const r = await executeImport(ownerB, 'b', 'ownerb', session, preview, {
      applyUpdates: false,
      progress: () => undefined,
    });
    expect(r.status).toBe('completed');
    expect(
      (await getDocs(collection(ownerB, 'companies', 'b', 'departments'))).size,
    ).toBe(2);
    // Same file again → every row matches; nothing new is created.
    const again = classifyRows(
      'departments',
      rows.slice(1),
      map,
      await loadContext(ownerB, 'b', 'departments', rows.slice(1), map),
    );
    expect(summarize(again)).toMatchObject({ new: 0, match: 2 });
    const s2 = await saveDryRun(ownerB, 'b', 'ownerb', {
      module: 'departments',
      fileName: 'deps.csv',
      fileHash: 'hash1',
      mapping: map,
      rows: again,
      counts: summarize(again),
    });
    expect(s2.status).toBe('completed'); // repeat import detected from the file hash
    await executeImport(
      ownerB,
      'b',
      'ownerb',
      (await getSession(ownerB, 'b', s2.id))!,
      again,
      { applyUpdates: false, progress: () => undefined },
    );
    expect(
      (await getDocs(collection(ownerB, 'companies', 'b', 'departments'))).size,
    ).toBe(2);
    // Other companies and staff cannot read import history.
    await assertFails(
      getDocs(collection(owner, 'companies', 'b', 'importSessions')),
    );
    expect((await listSessions(ownerB, 'b')).length).toBeGreaterThan(0);
  });
  it('partial failure is reported and resume finishes without duplicates', async () => {
    const data = [
      ['Code', 'Name', 'Status'],
      ...Array.from({ length: 6 }, (_, i) => [
        `RES-${i}`,
        `Dept ${i}`,
        'active',
      ]),
    ];
    const map = autoMap('departments', data[0]);
    const preview = classifyRows(
      'departments',
      data.slice(1),
      map,
      await loadContext(ownerB, 'b', 'departments', data.slice(1), map),
    );
    const s = await saveDryRun(ownerB, 'b', 'ownerb', {
      module: 'departments',
      fileName: 'resume.csv',
      fileHash: 'hash2',
      mapping: map,
      rows: preview,
      counts: summarize(preview),
    });
    const stop = new AbortController();
    const first = await executeImport(ownerB, 'b', 'ownerb', s, preview, {
      applyUpdates: false,
      progress: (d) => d === 3 && stop.abort(),
      signal: stop.signal,
    });
    expect(first.status).toBe('partial');
    const fresh = (await getSession(ownerB, 'b', s.id))!;
    expect(fresh.rows.filter((r) => r.result === 'created')).toHaveLength(3);
    const second = await executeImport(ownerB, 'b', 'ownerb', fresh, preview, {
      applyUpdates: false,
      progress: () => undefined,
    });
    expect(second.status).toBe('completed');
    const names = (
      await getDocs(collection(ownerB, 'companies', 'b', 'departments'))
    ).docs
      .map((d) => d.data().code)
      .filter((c: string) => c.startsWith('RES-'));
    expect(names.sort()).toEqual([
      'RES-0',
      'RES-1',
      'RES-2',
      'RES-3',
      'RES-4',
      'RES-5',
    ]);
  });
  it('updates only on request, only the changed columns', async () => {
    const data = [
      ['Code', 'Name', 'Status'],
      ['IMP-HK', 'Housekeeping Dept', 'active'],
    ];
    const map = autoMap('departments', data[0]);
    const preview = classifyRows(
      'departments',
      data.slice(1),
      map,
      await loadContext(ownerB, 'b', 'departments', data.slice(1), map),
    );
    expect(preview[0]).toMatchObject({ status: 'update', changes: ['name'] });
    const s = await saveDryRun(ownerB, 'b', 'ownerb', {
      module: 'departments',
      fileName: 'upd.csv',
      fileHash: 'hash3',
      mapping: map,
      rows: preview,
      counts: summarize(preview),
    });
    await executeImport(ownerB, 'b', 'ownerb', s, preview, {
      applyUpdates: false,
      progress: () => undefined,
    });
    const { query, where } = await import('firebase/firestore');
    const get = async () =>
      (
        await getDocs(
          query(
            collection(ownerB, 'companies', 'b', 'departments'),
            where('code', '==', 'IMP-HK'),
          ),
        )
      ).docs[0].data();
    expect((await get()).name).toBe('Housekeeping');
    const s2 = await saveDryRun(ownerB, 'b', 'ownerb', {
      module: 'departments',
      fileName: 'upd.csv',
      fileHash: 'hash3b',
      mapping: map,
      rows: preview,
      counts: summarize(preview),
    });
    await executeImport(ownerB, 'b', 'ownerb', s2, preview, {
      applyUpdates: true,
      progress: () => undefined,
    });
    expect((await get()).name).toBe('Housekeeping Dept');
  });
  it('opening stock goes through the ledger and reconciles', async () => {
    const site = await create('sites', {}, ownerB, 'b');
    const store = await create(
      'stores',
      { code: 'ST1', siteId: site },
      ownerB,
      'b',
    );
    const mcat = await create('materialCategories', {}, ownerB, 'b');
    const mat = await create(
      'materials',
      { code: 'MAT1', unit: 'each', categoryId: mcat },
      ownerB,
      'b',
    );
    void store;
    void mat;
    const data = [
      ['Store code', 'Material code', 'Quantity', 'Date'],
      ['ST1', 'MAT1', '40', '2026-11-01'],
      ['ST1', 'NOPE', '1', '2026-11-01'],
    ];
    const map = autoMap('openingStock', data[0]);
    const preview = classifyRows(
      'openingStock',
      data.slice(1),
      map,
      await loadContext(ownerB, 'b', 'openingStock', data.slice(1), map),
    );
    expect(preview.map((r) => r.status)).toEqual(['new', 'invalid']);
    const s = await saveDryRun(ownerB, 'b', 'ownerb', {
      module: 'openingStock',
      fileName: 'stock.csv',
      fileHash: 'hash4',
      mapping: map,
      rows: preview,
      counts: summarize(preview),
    });
    await executeImport(ownerB, 'b', 'ownerb', s, preview, {
      applyUpdates: false,
      progress: () => undefined,
    });
    // Re-import: the existing opening balance is a match, never a second opening.
    const again = classifyRows(
      'openingStock',
      data.slice(1),
      map,
      await loadContext(ownerB, 'b', 'openingStock', data.slice(1), map),
    );
    expect(again[0].status).toBe('match');
    const balances = (await listBalances(ownerB, 'b')).rows;
    expect(balances.map((b) => b.quantity)).toEqual([40]);
    const moves = await loadMovements(ownerB, 'b', {
      from: new Date('2026-01-01'),
      to: new Date(Date.now() + 86400000),
    });
    const recon = stockReconciliation(
      moves.rows,
      new Date('2026-01-01'),
      new Date(Date.now() + 86400000),
    );
    expect(recon[0]).toMatchObject({ opening: 0, received: 40, closing: 40 });
  });
});

describe('onboarding and starter packs', () => {
  it('installs a pack idempotently, as drafts, without schedules', async () => {
    const pack = starterPacks.find((p) => p.id === 'business_center')!;
    const sel = {
      departments: pack.departments.map((d) => d.code),
      designations: pack.designations.map((d) => d.code),
      categories: pack.categories.map((c) => c.code),
      templates: pack.templates.slice(0, 3).map((t) => t.code),
    };
    const first = await installPack(
      ownerB,
      'b',
      'ownerb',
      pack,
      sel,
      () => undefined,
    );
    expect(first.created).toBe(
      pack.departments.length +
        pack.designations.length +
        pack.categories.length +
        3,
    );
    const second = await installPack(
      ownerB,
      'b',
      'ownerb',
      pack,
      sel,
      () => undefined,
    );
    expect(second).toEqual({ created: 0, skipped: first.created });
    const templates = (
      await getDocs(collection(ownerB, 'companies', 'b', 'taskTemplates'))
    ).docs;
    expect(templates).toHaveLength(3);
    for (const t of templates) {
      const v = await listVersions(ownerB, 'b', t.id);
      expect(v.map((x) => x.state)).toEqual(['draft']);
    }
    expect(await listSchedules(ownerB, 'b')).toHaveLength(0);
    await saveOnboarding(ownerB, 'b', 'ownerb', {
      steps: { roles: true },
      pack: pack.id,
    });
    expect(await getOnboarding(ownerB, 'b')).toEqual({
      steps: { roles: true },
      pack: pack.id,
    });
    await assertFails(
      getDoc(doc(tenant('staffa'), 'companies', 'a', 'settings', 'onboarding')),
    );
  });
});

describe('exports', () => {
  it('reads all matching records beyond the 3,000-row display cap', async () => {
    await env.withSecurityRulesDisabled(async (x) => {
      const f = x.firestore();
      for (let i = 0; i < 3105; i += 500) {
        const b = writeBatch(f);
        for (let j = i; j < Math.min(i + 500, 3105); j++)
          b.set(doc(f, 'companies', 'b', 'attendance', `e1_${j}`), {
            companyId: 'b',
            employeeId: 'e1',
            date: '2026-11-10',
            siteId: 's',
            checkInAt: Timestamp.now(),
            checkOutAt: null,
            status: 'checked_in',
            lateMinutes: 0,
            correction: null,
            checkInLocation: null,
          });
        await b.commit();
      }
    });
    const screen = await loadAttendance(
      ownerB,
      'b',
      '2026-11-01',
      '2026-11-30',
    );
    expect(screen.rows).toHaveLength(3000);
    expect(screen.truncated).toBe(true);
    const all = await loadAttendance(
      ownerB,
      'b',
      '2026-11-01',
      '2026-11-30',
      100000,
    );
    expect(all.rows).toHaveLength(3105);
    expect(all.truncated).toBe(false);
  }, 120000);
  it('export audit entries are append-only, attributed and company-scoped', async () => {
    const ref = await addDoc(
      collection(owner, 'companies', 'a', 'exportLogs'),
      {
        companyId: 'a',
        report: 'reports.tasks',
        format: 'pdf',
        scope: 'all',
        rows: 10,
        filters: 'Site: All',
        by: 'ownera',
        at: serverTimestamp(),
      },
    );
    await assertFails(updateDoc(ref, { rows: 1 }));
    await assertFails(
      addDoc(collection(owner, 'companies', 'a', 'exportLogs'), {
        companyId: 'a',
        report: 'x',
        format: 'pdf',
        scope: 'all',
        rows: 1,
        filters: '',
        by: 'someoneelse',
        at: serverTimestamp(),
      }),
    );
    await assertFails(
      addDoc(collection(tenant('staffa'), 'companies', 'a', 'exportLogs'), {
        companyId: 'a',
        report: 'x',
        format: 'pdf',
        scope: 'all',
        rows: 1,
        filters: '',
        by: 'staffa',
        at: serverTimestamp(),
      }),
    );
    await assertFails(
      getDocs(collection(ownerB, 'companies', 'a', 'exportLogs')),
    );
  });
});
