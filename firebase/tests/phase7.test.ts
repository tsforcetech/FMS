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
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { beforeAll, afterAll, it, expect, describe } from 'vitest';
import {
  defaultValues,
  emptyContent,
  newQuestion,
  toLocal,
  type Kind,
  type Values,
} from '../../packages/shared/src';
import { saveRecord } from '../../apps/admin-web/src/management/store';
import {
  createDraft,
  saveDraft,
  listVersions,
  createTask,
  getTask,
  transitionTask,
  submitTask,
} from '../../apps/admin-web/src/management/tasksStore';
import { linkStaff } from '../../apps/admin-web/src/management/staffStore';
import {
  getCase,
  transitionCase,
  workOrderFromComplaint,
} from '../../apps/admin-web/src/management/casesStore';
import {
  saveCustomerLink,
  resolveCustomer,
  listMyRequests,
  createServiceRequest,
  newRequestId,
  getMyRequest,
  intakeRequest,
  addRemark,
  requestReopen,
  confirmResolution,
  reconcileRequest,
  listServiceRequests,
  teamReply,
  type CustomerLink,
} from '../../apps/admin-web/src/management/customerStore';
import {
  recordCost,
  loadCosts,
  saveCompliance,
  listCompliance,
  saveRetention,
  getRetention,
  defaultRetention,
  taskCounts,
  loadTasks,
  loadAudit,
} from '../../apps/admin-web/src/management/reportsStore';

let env: RulesTestEnvironment;
const fs = (uid: string) =>
  env.authenticatedContext(uid).firestore() as unknown as Firestore;
let owner: Firestore, sup: Firestore, tech: Firestore;
let cust1: Firestore, cust2: Firestore, cust3: Firestore;
const meta = {
  schemaVersion: 1,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  createdBy: 'operator',
  updatedBy: 'operator',
};
const members: [string, string, string][] = [
  ['a', 'ownera', 'owner'],
  ['a', 'supa', 'supervisor'],
  ['a', 'techa', 'technician'],
  ['a', 'cust1', 'customer'], // client A, all allocations
  ['a', 'cust2', 'customer'], // client B (shares the site)
  ['a', 'cust3', 'customer'], // client A, scoped to Office 201 only
  ['a', 'custx', 'customer'], // not linked
  ['b', 'ownerb', 'owner'],
];
beforeAll(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
    throw new Error('Emulator required');
  env = await initializeTestEnvironment({
    projectId: 'demo-facilityos-phase7',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync('firebase/firestore.rules', 'utf8'),
    },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    for (const companyId of ['a', 'b'])
      await setDoc(doc(c.firestore(), 'companies', companyId), {
        ...meta,
        companyId,
        name: companyId.toUpperCase(),
        status: 'active',
        timeZone: 'Asia/Dubai',
      });
    for (const [companyId, uid, role] of members)
      await setDoc(doc(c.firestore(), 'companies', companyId, 'members', uid), {
        ...meta,
        companyId,
        uid,
        role,
        status: 'active',
      });
  });
  owner = fs('ownera');
  sup = fs('supa');
  tech = fs('techa');
  cust1 = fs('cust1');
  cust2 = fs('cust2');
  cust3 = fs('cust3');
});
afterAll(async () => {
  await env?.cleanup();
});

let seq = 0;
const create = (kind: Kind, v: Values = {}) =>
  saveRecord(owner, 'a', 'ownera', kind, {
    ...defaultValues(kind),
    code: `P7X${++seq}`,
    name: `Record ${seq}`,
    ...v,
  });
const today = () => toLocal(new Date(), 'Asia/Dubai').date;
const year = new Date().getFullYear();

type World = Awaited<ReturnType<typeof world>>;
async function world() {
  const site = await create('sites', { name: 'Muteena Business Centre' });
  const o201 = await create('locations', { siteId: site, name: 'Office 201' });
  const o202 = await create('locations', { siteId: site, name: 'Office 202' });
  const o203 = await create('locations', { siteId: site, name: 'Office 203' });
  const clientA = await create('clients', { name: 'Alpha Trading' });
  const clientB = await create('clients', { name: 'Beta Consulting' });
  const contract = (clientId: string) =>
    create('contracts', {
      clientId,
      startDate: `${year - 1}-01-01`,
      endDate: `${year}-12-31`,
    });
  const kA = await contract(clientA);
  const kB = await contract(clientB);
  const alloc = (contractId: string, locationId: string, y = year) =>
    create('contractAllocations', {
      contractId,
      siteId: site,
      locationId,
      allocationType: 'exclusive_occupancy',
      startDate: `${y}-01-01`,
      endDate: `${y}-12-31`,
    });
  const aA201 = await alloc(kA, o201);
  const aA203 = await alloc(kA, o203);
  const aB202 = await alloc(kB, o202);
  const aAold = await alloc(kA, o202, year - 1); // expired last year
  return {
    site,
    o201,
    o202,
    o203,
    clientA,
    clientB,
    kA,
    kB,
    aA201,
    aA203,
    aB202,
    aAold,
  };
}
let w: World;
let link1: CustomerLink, link2: CustomerLink, link3: CustomerLink;
const linkOf = async (db: Firestore, uid: string) => {
  const r = await resolveCustomer(db, 'a', uid);
  if (!('link' in r)) throw new Error(`no link for ${uid}: ${r.reason}`);
  return r.link;
};
const raise = (
  db: Firestore,
  uid: string,
  link: CustomerLink,
  allocationId: string,
  description = 'AC is leaking water onto the desk',
  id = newRequestId(db, 'a'),
) =>
  createServiceRequest(
    db,
    'a',
    uid,
    link,
    {
      id,
      allocationId,
      category: 'Air conditioning',
      priority: 'high',
      description,
    },
    { todayLocal: today() },
  );

describe('phase 7 customer portal security', () => {
  it('links customer logins explicitly and never links staff', async () => {
    w = await world();
    await saveCustomerLink(owner, 'a', 'ownera', {
      uid: 'cust1',
      clientId: w.clientA,
      contactName: 'Alpha front desk',
      allocationIds: [],
    });
    await saveCustomerLink(owner, 'a', 'ownera', {
      uid: 'cust2',
      clientId: w.clientB,
      contactName: 'Beta office',
      allocationIds: [],
    });
    await saveCustomerLink(owner, 'a', 'ownera', {
      uid: 'cust3',
      clientId: w.clientA,
      contactName: 'Alpha 201 only',
      allocationIds: [w.aA201],
    });
    await expect(
      saveCustomerLink(owner, 'a', 'ownera', {
        uid: 'techa',
        clientId: w.clientA,
        contactName: '',
        allocationIds: [],
      }),
    ).rejects.toThrow(/not a customer/);
    // Admin-only: a supervisor cannot link customers.
    await assertFails(
      setDoc(doc(sup, 'companies', 'a', 'customerLinks', 'custx'), {
        companyId: 'a',
        uid: 'custx',
      }),
    );
    link1 = await linkOf(cust1, 'cust1');
    link2 = await linkOf(cust2, 'cust2');
    link3 = await linkOf(cust3, 'cust3');
    expect(link1.places.map((p) => p.locationName).sort()).toEqual([
      'Office 201',
      'Office 202',
      'Office 203',
    ]);
    expect(link2.places.map((p) => p.locationName)).toEqual(['Office 202']);
    expect(link3.places.map((p) => p.locationName)).toEqual(['Office 201']);
    // Snapshot holds names and dates only.
    expect(Object.keys(link1.places[0]).sort()).toEqual(
      [
        'allocationId',
        'allocationType',
        'contractId',
        'endDate',
        'locationId',
        'locationName',
        'siteId',
        'siteName',
        'startDate',
      ].sort(),
    );
    expect(
      (await resolveCustomer(fs('custx'), 'a', 'custx')) as { reason: string },
    ).toMatchObject({
      reason: 'no-link',
    });
    expect(
      (await resolveCustomer(tech, 'a', 'techa')) as { reason: string },
    ).toMatchObject({
      reason: 'not-customer',
    });
  });

  it('customers cannot read internal records or other links', async () => {
    await assertSucceeds(
      getDoc(doc(cust1, 'companies', 'a', 'customerLinks', 'cust1')),
    );
    await assertFails(
      getDoc(doc(cust1, 'companies', 'a', 'customerLinks', 'cust2')),
    );
    for (const [kind, id] of [
      ['sites', w.site],
      ['locations', w.o201],
      ['clients', w.clientA],
      ['contracts', w.kA],
      ['contractAllocations', w.aA201],
    ] as const)
      await assertFails(getDoc(doc(cust1, 'companies', 'a', kind, id)));
    for (const kind of [
      'tasks',
      'complaints',
      'workOrders',
      'employees',
      'members',
      'maintenanceCosts',
      'attendance',
    ])
      await assertFails(getDocs(collection(cust1, 'companies', 'a', kind)));
    // Another company is invisible.
    await assertFails(getDoc(doc(cust1, 'companies', 'b')));
  });

  it('creates requests only for the customer’s own active allocations', async () => {
    const r = await raise(cust1, 'cust1', link1, w.aA201);
    expect(r.created).toBe(true);
    // Retry with the same id is idempotent.
    expect(
      (
        await raise(
          cust1,
          'cust1',
          link1,
          w.aA201,
          'AC is leaking water onto the desk',
          r.id,
        )
      ).created,
    ).toBe(false);
    // Identical open request is refused as a duplicate.
    const mine = await listMyRequests(cust1, 'a', link1);
    await expect(
      createServiceRequest(
        cust1,
        'a',
        'cust1',
        link1,
        {
          id: newRequestId(cust1, 'a'),
          allocationId: w.aA201,
          category: 'Air conditioning',
          priority: 'high',
          description: 'AC is leaking water onto the desk',
        },
        { todayLocal: today(), existing: mine },
      ),
    ).rejects.toThrow(/already have an open request/);
    // Forging a place that belongs to another client is refused by the rules.
    const forged: CustomerLink = {
      ...link1,
      places: [...link1.places, link2.places[0]],
    };
    await expect(raise(cust1, 'cust1', forged, w.aB202)).rejects.toThrow();
    // A scoped login cannot raise for a sibling office of the same client.
    const forged3: CustomerLink = { ...link3, places: link1.places };
    await expect(raise(cust3, 'cust3', forged3, w.aA203)).rejects.toThrow();
    // Expired allocation: neither the client check nor the rules accept it.
    const old: CustomerLink = {
      ...link1,
      places: [
        {
          ...link1.places[0],
          allocationId: w.aAold,
          locationId: w.o202,
          startDate: `${year - 1}-01-01`,
          endDate: `${year - 1}-12-31`,
        },
      ],
    };
    await expect(raise(cust1, 'cust1', old, w.aAold)).rejects.toThrow(
      /service period has ended/,
    );
    await assertFails(
      setDoc(doc(cust1, 'companies', 'a', 'serviceRequests', 'expired00001'), {
        companyId: 'a',
        schemaVersion: 1,
        clientId: w.clientA,
        contractId: w.kA,
        allocationId: w.aAold,
        siteId: w.site,
        locationId: w.o202,
        reference: 'SR-X',
        category: 'Other',
        priority: 'low',
        description: 'old office',
        status: 'submitted',
        complaintId: '',
        workOrderId: '',
        timeline: [{ label: 'Request submitted', at: Timestamp.now() }],
        resolutionSummary: '',
        remarks: [],
        confirmedAt: null,
        createdBy: 'cust1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'cust1',
        revision: 1,
      }),
    );
    // A customer cannot create a request already marked resolved or linked.
    await assertFails(
      setDoc(doc(cust1, 'companies', 'a', 'serviceRequests', 'forgedst0001'), {
        companyId: 'a',
        schemaVersion: 1,
        clientId: w.clientA,
        contractId: w.kA,
        allocationId: w.aA201,
        siteId: w.site,
        locationId: w.o201,
        reference: 'SR-Y',
        category: 'Other',
        priority: 'low',
        description: 'forged',
        status: 'resolved',
        complaintId: 'cmp_x',
        workOrderId: '',
        timeline: [{ label: 'Request submitted', at: Timestamp.now() }],
        resolutionSummary: '',
        remarks: [],
        confirmedAt: null,
        createdBy: 'cust1',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: 'cust1',
        revision: 1,
      }),
    );
  });

  it('isolates tenants sharing one site: Office 201 never sees Office 202', async () => {
    const b = await raise(
      cust2,
      'cust2',
      link2,
      w.aB202,
      'Lights flickering in 202',
    );
    const a203 = await raise(
      cust1,
      'cust1',
      link1,
      w.aA203,
      'Chair broken in 203',
    );
    // Client A cannot read client B's request, by get or by query.
    await assertFails(
      getDoc(doc(cust1, 'companies', 'a', 'serviceRequests', b.id)),
    );
    await assertFails(
      getDocs(
        query(
          collection(cust1, 'companies', 'a', 'serviceRequests'),
          where('clientId', '==', w.clientB),
        ),
      ),
    );
    // An unfiltered list is refused (it could include other tenants).
    await assertFails(
      getDocs(collection(cust1, 'companies', 'a', 'serviceRequests')),
    );
    expect((await listMyRequests(cust2, 'a', link2)).map((r) => r.id)).toEqual([
      b.id,
    ]);
    // Scoped login (201 only) cannot see the 203 request of its own client.
    await assertFails(
      getDoc(doc(cust3, 'companies', 'a', 'serviceRequests', a203.id)),
    );
    await assertFails(
      getDocs(
        query(
          collection(cust3, 'companies', 'a', 'serviceRequests'),
          where('clientId', '==', w.clientA),
        ),
      ),
    );
    const scoped = await listMyRequests(cust3, 'a', link3);
    expect(scoped.every((r) => r.allocationId === w.aA201)).toBe(true);
    expect(scoped.length).toBe(1);
    // Staff cannot read customer requests.
    await assertFails(
      getDoc(doc(tech, 'companies', 'a', 'serviceRequests', b.id)),
    );
  });

  it('routes into a complaint, syncs customer-safe progress and hides internal notes', async () => {
    const [req] = (await listMyRequests(cust3, 'a', link3)).filter(
      (r) => r.allocationId === w.aA201,
    );
    const complaintId = await intakeRequest(owner, 'a', 'ownera', req);
    // Repeating intake does not create a second complaint.
    const again = await intakeRequest(
      owner,
      'a',
      'ownera',
      (await listServiceRequests(owner, 'a')).find((r) => r.id === req.id)!,
    );
    expect(again).toBe(complaintId);
    let cmp = (await getCase(owner, 'a', 'complaints', complaintId))!;
    expect(cmp.sourceType).toBe('service_request');
    expect(cmp.sourceId).toBe(req.id);
    expect(cmp.clientId).toBe(w.clientA);
    await assertFails(
      getDoc(doc(cust3, 'companies', 'a', 'complaints', complaintId)),
    );
    const dep = await create('departments');
    const des = await create('designations', { departmentId: dep });
    const joseph = await create('employees', {
      name: 'Joseph Mathew',
      joiningDate: '2026-01-05',
      departmentId: dep,
      designationId: des,
      primarySiteId: w.site,
    });
    await transitionCase(owner, 'a', 'ownera', cmp, 'assign', {
      assigneeIds: [joseph],
      note: 'INTERNAL: tenant is difficult, cost 900 AED. Send Joseph, phone 050-123',
    });
    cmp = (await getCase(owner, 'a', 'complaints', complaintId))!;
    await workOrderFromComplaint(owner, 'a', 'ownera', cmp);
    cmp = (await getCase(owner, 'a', 'complaints', complaintId))!;
    let r = (await getMyRequest(cust3, 'a', req.id))!;
    expect(r.status).toBe('in_progress');
    expect(r.complaintId).toBe(complaintId);
    expect(r.workOrderId).toBeTruthy();
    const visible = JSON.stringify(r);
    expect(visible).not.toMatch(/INTERNAL|difficult|900|050-123|Joseph/);
    expect(r.timeline.map((t) => t.label)).toContain('Work order created');
    // Customer remark, and team reply.
    await addRemark(cust3, 'a', 'cust3', req.id, 'Please come after 2pm');
    await teamReply(owner, 'a', 'ownera', req.id, 'Technician booked for 3pm');
    // Customer cannot change status, description or the team's fields directly.
    await assertFails(
      updateDoc(doc(cust3, 'companies', 'a', 'serviceRequests', req.id), {
        status: 'closed',
        revision: r.revision + 2,
        updatedAt: serverTimestamp(),
        updatedBy: 'cust3',
      }),
    );
    r = (await getMyRequest(cust3, 'a', req.id))!;
    await assertFails(
      updateDoc(doc(cust3, 'companies', 'a', 'serviceRequests', req.id), {
        description: 'changed',
        revision: r.revision + 1,
        updatedAt: serverTimestamp(),
        updatedBy: 'cust3',
      }),
    );
    await assertFails(
      updateDoc(doc(cust3, 'companies', 'a', 'serviceRequests', req.id), {
        resolutionSummary: 'done',
        revision: r.revision + 1,
        updatedAt: serverTimestamp(),
        updatedBy: 'cust3',
      }),
    );
    await expect(
      confirmResolution(cust3, 'a', 'cust3', req.id),
    ).rejects.toThrow(/Nothing to confirm/);
    // Resolve the complaint (start it first if needed) → customer sees resolved + summary.
    cmp = (await getCase(owner, 'a', 'complaints', complaintId))!;
    cmp = (await getCase(owner, 'a', 'complaints', complaintId))!;
    await transitionCase(owner, 'a', 'ownera', cmp, 'resolve', {
      note: 'Drain pipe cleared and tested.',
    });
    r = (await getMyRequest(cust3, 'a', req.id))!;
    expect(r.status).toBe('resolved');
    expect(r.resolutionSummary).toBe('Drain pipe cleared and tested.');
    // Reopen request needs a reason, then confirmation is still possible once.
    await requestReopen(
      cust3,
      'a',
      'cust3',
      req.id,
      'Leaking again this morning',
    );
    r = (await getMyRequest(cust3, 'a', req.id))!;
    expect(r.status).toBe('reopen_requested');
    // Reconcile does not override a pending reopen request.
    expect(await reconcileRequest(owner, 'a', 'ownera', r)).toBe(false);
    cmp = (await getCase(owner, 'a', 'complaints', complaintId))!;
    await transitionCase(owner, 'a', 'ownera', cmp, 'reopen', {
      note: 'Customer reports leak again',
    });
    r = (await getMyRequest(cust3, 'a', req.id))!;
    expect(r.status).toBe('in_progress');
  });

  it('a revoked customer loses access immediately', async () => {
    await saveCustomerLink(owner, 'a', 'ownera', {
      uid: 'cust2',
      clientId: w.clientB,
      contactName: 'Beta office',
      allocationIds: [],
      status: 'revoked',
    });
    expect(
      (await resolveCustomer(cust2, 'a', 'cust2')) as { reason: string },
    ).toMatchObject({ reason: 'revoked' });
    await expect(listMyRequests(cust2, 'a', link2)).rejects.toThrow();
    await expect(
      raise(cust2, 'cust2', link2, w.aB202, 'new issue after revoke'),
    ).rejects.toThrow();
  });
});

describe('phase 7 costs, compliance, retention and audit', () => {
  it('records costs append-only and admin-only', async () => {
    await recordCost(owner, 'a', 'ownera', {
      workOrderId: '',
      assetId: '',
      siteId: w.site,
      type: 'vendor',
      amount: 450.5,
      currency: 'AED',
      description: 'AC drain service',
      incurredDate: today(),
    });
    const costs = await loadCosts(owner, 'a', today(), today());
    expect(costs.rows.length).toBe(1);
    await assertFails(
      updateDoc(
        doc(owner, 'companies', 'a', 'maintenanceCosts', costs.rows[0].id),
        { amount: 1 },
      ),
    );
    await expect(
      recordCost(sup, 'a', 'supa', {
        workOrderId: '',
        assetId: '',
        siteId: w.site,
        type: 'labor',
        amount: 10,
        currency: 'AED',
        description: 'x',
        incurredDate: today(),
      }),
    ).rejects.toThrow();
    await assertFails(
      getDocs(collection(sup, 'companies', 'a', 'maintenanceCosts')),
    );
    await assertFails(
      addDoc(collection(owner, 'companies', 'a', 'maintenanceCosts'), {
        companyId: 'a',
        schemaVersion: 1,
        workOrderId: '',
        assetId: '',
        siteId: w.site,
        type: 'vendor',
        amount: -5,
        currency: 'AED',
        description: 'negative',
        incurredDate: today(),
        recordedBy: 'ownera',
        recordedAt: serverTimestamp(),
      }),
    );
  });

  it('compliance needs evidence to be verified; staff cannot read it', async () => {
    const base = {
      category: 'Fire safety',
      title: 'Fire alarm certificate',
      siteId: w.site,
      assetId: '',
      facilityId: '',
      issuer: 'Civil Defence',
      reference: 'FA-2026-001',
      issuedDate: `${year}-01-10`,
      expiryDate: `${year + 1}-01-09`,
      evidenceRef: '',
      verified: true,
      notes: '',
    };
    await expect(saveCompliance(owner, 'a', 'ownera', base)).rejects.toThrow(
      /evidence reference/,
    );
    await saveCompliance(owner, 'a', 'ownera', {
      ...base,
      evidenceRef: 'Drive: /certs/FA-2026-001.pdf',
    });
    const list = await listCompliance(owner, 'a');
    expect(list.rows[0].verifiedBy).toBe('ownera');
    // Forged verification without a verifier is refused.
    await assertFails(
      setDoc(doc(owner, 'companies', 'a', 'complianceRecords', 'forged'), {
        ...base,
        companyId: 'a',
        schemaVersion: 1,
        evidenceRef: 'x',
        verifiedBy: '',
        verifiedAt: null,
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: 'ownera',
        updatedAt: serverTimestamp(),
        updatedBy: 'ownera',
        revision: 1,
      }),
    );
    await assertFails(
      getDocs(collection(tech, 'companies', 'a', 'complianceRecords')),
    );
  });

  it('retention settings are admin-only and validated', async () => {
    await saveRetention(owner, 'a', 'ownera', {
      ...defaultRetention,
      gpsDays: 60,
    });
    expect((await getRetention(owner, 'a')).gpsDays).toBe(60);
    await expect(
      saveRetention(owner, 'a', 'ownera', {
        ...defaultRetention,
        auditDays: 30,
      }),
    ).rejects.toThrow(/at least one year/);
    await expect(
      saveRetention(sup, 'a', 'supa', defaultRetention),
    ).rejects.toThrow();
    await assertFails(
      getDoc(doc(sup, 'companies', 'a', 'settings', 'retention')),
    );
  });
});

describe('phase 7 task timing and reports', () => {
  it('stamps startedAt/submittedAt with server time and refuses forged timing', async () => {
    const dep = await create('departments');
    const des = await create('designations', { departmentId: dep });
    const e1 = await create('employees', {
      joiningDate: '2026-01-05',
      departmentId: dep,
      designationId: des,
      primarySiteId: w.site,
      linkedUid: 'techa',
    });
    await linkStaff(owner, 'a', 'ownera', {
      uid: 'techa',
      employeeId: e1,
      siteIds: [w.site],
      allSites: false,
    });
    const cat = await create('taskCategories');
    const tpl = await create('taskTemplates', { categoryId: cat });
    const content = emptyContent('Room clean');
    const q1 = {
      ...newQuestion('s1', 'pass_fail'),
      id: 'q1',
      label: 'Desk clean',
    };
    const versionId = await createDraft(owner, 'a', 'ownera', tpl, {
      ...content,
      approvalRequired: false,
      questions: [q1],
      raci: [
        {
          id: 'r1',
          letter: 'R',
          kind: 'designation',
          refId: des,
          label: 'Cleaner',
          siteId: '',
        },
      ],
    });
    const [v] = await listVersions(owner, 'a', tpl);
    await saveDraft(owner, 'a', 'ownera', v, v.content, true);
    const id = await createTask(owner, 'a', 'ownera', {
      versionId,
      title: 'Clean Office 201',
      siteId: w.site,
      locationId: w.o201,
      facilityId: '',
      assetId: '',
      departmentId: dep,
      assigneeIds: [e1],
      teamId: '',
      priority: 'medium',
      plannedStart: '',
      dueAt: new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 16),
      notes: '',
    });
    let t = (await getTask(tech, 'a', id))!;
    // Forging a start time is refused.
    await assertFails(
      updateDoc(doc(tech, 'companies', 'a', 'tasks', id), {
        startedAt: Timestamp.fromDate(new Date(Date.now() - 3600000)),
      }),
    );
    await transitionTask(tech, 'a', 'techa', t, 'start');
    t = (await getTask(tech, 'a', id))!;
    expect(t.startedAt).toBeTruthy();
    await submitTask(tech, 'a', 'techa', t, { q1: 'pass' }, '');
    t = (await getTask(tech, 'a', id))!;
    expect(t.submittedAt).toBeTruthy();
    expect(t.submittedAt!.toMillis()).toBeGreaterThanOrEqual(
      t.startedAt!.toMillis(),
    );

    const from = new Date(Date.now() - 86400000),
      to = new Date(Date.now() + 86400000);
    const rows = await loadTasks(owner, 'a', { from, to });
    expect(rows.rows.find((x) => x.id === id)?.startedAt).toBeInstanceOf(Date);
    const counts = await taskCounts(owner, 'a', { from, to }, w.site);
    expect(
      counts.open + counts.completed + counts.awaiting,
    ).toBeGreaterThanOrEqual(1);
    // Staff cannot run company-wide report queries.
    await expect(loadTasks(tech, 'a', { from, to })).rejects.toThrow();
    const audit = await loadAudit(owner, 'a', { from, to });
    expect(audit.some((x) => x.source === 'task' && x.action === 'start')).toBe(
      true,
    );
    expect(audit.some((x) => x.source === 'case')).toBe(true);
  });
});
