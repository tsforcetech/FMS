// Creates clearly marked test data (codes start with TST-) in a LIVE company
// through the same data layer and security rules as the admin app, and
// exercises create / edit / archive and the operational actions.
// Usage (credentials only via environment, never on the command line):
//   FOS_EMAIL=... FOS_PASSWORD=... npx tsx scripts/seed-live-demo.ts --company gbh --confirm-live facilityos-43386
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
  getDocs,
  initializeFirestore,
  limit,
  memoryLocalCache,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import {
  defaultValues,
  emptyContent,
  newQuestion,
  makeRule,
  type Kind,
  type Values,
  type VersionContent,
} from '../packages/shared/src';
import {
  saveRecord,
  recordById,
  transferAsset,
  postMovement,
  newMovementId,
} from '../apps/admin-web/src/management/store';
import {
  createDraft,
  saveDraft,
  listVersions,
  createTask,
  getTask,
  transitionTask,
  saveProgress,
  submitTask,
  reportException,
} from '../apps/admin-web/src/management/tasksStore';
import {
  createCase,
  emptyCase,
  getCase,
  transitionCase,
  workOrderFromComplaint,
  escalateFurther,
} from '../apps/admin-web/src/management/casesStore';
import {
  saveSchedule,
  emptySchedule,
  runScheduler,
  listSchedules,
} from '../apps/admin-web/src/management/scheduling';
import {
  linkStaff,
  listStaffLinks,
} from '../apps/admin-web/src/management/staffStore';

const { values: args } = parseArgs({
  options: { company: { type: 'string' }, 'confirm-live': { type: 'string' } },
});
const env = Object.fromEntries(
  readFileSync('.env.live.example', 'utf8')
    .split('\n')
    .map((l) => /^([A-Z_]+)=(.*)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => [m![1], m![2]]),
);
if (!args.company || args['confirm-live'] !== env.VITE_FIREBASE_PROJECT_ID)
  throw new Error(
    `Required: --company ID --confirm-live ${env.VITE_FIREBASE_PROJECT_ID}`,
  );
if (!process.env.FOS_EMAIL || !process.env.FOS_PASSWORD)
  throw new Error('Set FOS_EMAIL and FOS_PASSWORD in the environment.');
const C = args.company;
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db: Firestore = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});
const { user } = await signInWithEmailAndPassword(
  auth,
  process.env.FOS_EMAIL,
  process.env.FOS_PASSWORD,
);
const uid = user.uid;
const results: { step: string; ok: boolean; note?: string }[] = [];
async function step<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    const r = await fn();
    results.push({ step: name, ok: true });
    console.log('✓', name);
    return r;
  } catch (e) {
    results.push({ step: name, ok: false, note: (e as Error).message });
    console.log('✗', name, '—', (e as Error).message);
    return undefined;
  }
}
/** Find by code or create (safe to rerun). */
async function ensure(kind: Kind, code: string, v: Values) {
  const r = await getDocs(
    query(
      collection(db, 'companies', C, kind),
      where('code', '==', code),
      limit(1),
    ),
  );
  if (!r.empty) return r.docs[0].id;
  return saveRecord(db, C, uid, kind, { ...defaultValues(kind), code, ...v });
}
async function edit(kind: Kind, id: string, patch: Values) {
  const rec = (await recordById(db, C, kind, id))!;
  const changed = Object.entries(patch).some(([k, x]) => rec.values[k] !== x);
  if (changed)
    await saveRecord(db, C, uid, kind, { ...rec.values, ...patch }, rec);
}
const archive = (kind: Kind, id: string) =>
  edit(kind, id, { status: 'archived' });
const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (days: number) => iso(new Date(today.getTime() + days * 86400000));
const local = (h: number) =>
  new Date(Date.now() + h * 3600000).toISOString().slice(0, 16);

console.log(`Seeding test data in company ${C} as ${user.email}`);
const S: Record<string, string> = {};
const put = async (key: string, kind: Kind, code: string, v: Values) => {
  const id = await step(`create ${kind} ${code}`, () => ensure(kind, code, v));
  if (id) S[key] = id;
  return id;
};

/* ---------------------------------------------------------------- property */
await put('siteA', 'sites', 'TST-SITE-A', {
  name: 'Al Noor Tower (Test)',
  propertyType: 'Commercial building',
  timeZone: 'Asia/Dubai',
  city: 'Dubai',
  country: 'United Arab Emirates',
  address: 'Sheikh Zayed Road',
  workingDays: 'Sun,Mon,Tue,Wed,Thu',
  opensAt: '08:00',
  closesAt: '18:00',
  contactPerson: 'Facility desk',
  phone: '+971 4 000 0000',
});
await put('siteB', 'sites', 'TST-SITE-B', {
  name: 'Marina Residence (Test)',
  propertyType: 'Residential tower',
  timeZone: 'Asia/Dubai',
  city: 'Dubai',
  country: 'United Arab Emirates',
  address: 'Dubai Marina',
});
await put('towerA', 'locations', 'TST-LOC-A-TWR', {
  name: 'Tower A',
  siteId: S.siteA,
  locationType: 'Building',
});
await put('floor2', 'locations', 'TST-LOC-A-F2', {
  name: 'Floor 2',
  siteId: S.siteA,
  locationType: 'Floor',
  parentId: S.towerA,
});
await put('plant', 'locations', 'TST-LOC-A-PLANT', {
  name: 'Plant Room',
  siteId: S.siteA,
  locationType: 'Room',
  parentId: S.towerA,
});
await put('lobby', 'locations', 'TST-LOC-A-LOBBY', {
  name: 'Main Lobby',
  siteId: S.siteA,
  locationType: 'Zone',
  parentId: S.towerA,
});
await put('podium', 'locations', 'TST-LOC-B-POD', {
  name: 'Podium',
  siteId: S.siteB,
  locationType: 'Floor',
});
await put('ftPool', 'facilityTypes', 'TST-FT-POOL', {
  name: 'Swimming pool (Test)',
});
await put('ftLift', 'facilityTypes', 'TST-FT-LIFT', {
  name: 'Passenger lift (Test)',
});
await put('pool', 'facilities', 'TST-FAC-POOL', {
  name: 'Podium pool',
  siteId: S.siteB,
  locationId: S.podium,
  typeId: S.ftPool,
  condition: 'Good',
});
await put('lift', 'facilities', 'TST-FAC-LIFT1', {
  name: 'Lift L1',
  siteId: S.siteA,
  locationId: S.lobby,
  typeId: S.ftLift,
  condition: 'Good',
});
await step('edit facility condition (history)', () =>
  edit('facilities', S.pool, { condition: 'Fair' }),
);
await step('edit site details', () =>
  edit('sites', S.siteB, {
    contactPerson: 'Residence manager',
    phone: '+971 4 111 1111',
  }),
);

/* ---------------------------------------------------------------- clients & contracts */
await put('client', 'clients', 'TST-CL-GBH', {
  name: 'Gulf Bridge Holdings (Test)',
  clientType: 'Company',
  email: 'facilities@example.com',
  phone: '+971 4 222 2222',
});
await put('client2', 'clients', 'TST-CL-IND', {
  name: 'Ahmed Khan (Test)',
  clientType: 'Individual',
});
await put('contract', 'contracts', 'TST-CT-2026', {
  name: 'Integrated FM 2026 (Test)',
  clientId: S.client,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  status: 'active',
});
await put('alloc', 'contractAllocations', 'TST-AL-A', {
  name: 'Al Noor full coverage',
  contractId: S.contract,
  siteId: S.siteA,
  allocationType: 'service_coverage',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  status: 'active',
});
await step('edit client', () =>
  edit('clients', S.client2, { phone: '+971 50 000 0000' }),
);

/* ---------------------------------------------------------------- people */
await put('depMep', 'departments', 'TST-DEP-MEP', {
  name: 'MEP Services (Test)',
});
await put('depHk', 'departments', 'TST-DEP-HK', {
  name: 'Housekeeping (Test)',
});
await put('depSec', 'departments', 'TST-DEP-SEC', { name: 'Security (Test)' });
await put('desAc', 'designations', 'TST-DES-ACT', {
  name: 'AC Technician',
  departmentId: S.depMep,
});
await put('desEl', 'designations', 'TST-DES-ELEC', {
  name: 'Electrician',
  departmentId: S.depMep,
});
await put('desCl', 'designations', 'TST-DES-CLN', {
  name: 'Cleaner',
  departmentId: S.depHk,
});
await put('desSg', 'designations', 'TST-DES-SG', {
  name: 'Security Guard',
  departmentId: S.depSec,
});
await put('desSup', 'designations', 'TST-DES-SUP', {
  name: 'Site Supervisor',
  departmentId: S.depMep,
});
const emp = (
  name: string,
  dep: string,
  des: string,
  site: string,
  extra: Values = {},
) => ({
  name,
  joiningDate: '2025-06-01',
  employmentType: 'Full-time',
  departmentId: dep,
  designationId: des,
  primarySiteId: site,
  ...extra,
});
await put(
  'ravi',
  'employees',
  'TST-E001',
  emp('Ravi Kumar', S.depMep, S.desAc, S.siteA, { phone: '+971 50 100 0001' }),
);
await put(
  'joseph',
  'employees',
  'TST-E002',
  emp('Joseph Mathew', S.depMep, S.desEl, S.siteA),
);
await put(
  'fatima',
  'employees',
  'TST-E003',
  emp('Fatima Noor', S.depHk, S.desCl, S.siteA),
);
await put(
  'ali',
  'employees',
  'TST-E004',
  emp('Ali Hassan', S.depSec, S.desSg, S.siteB),
);
await put(
  'sanjay',
  'employees',
  'TST-E005',
  emp('Sanjay Patel', S.depMep, S.desSup, S.siteA),
);
await put(
  'me',
  'employees',
  'TST-E900',
  emp('Flowbee Admin (Test employee)', S.depMep, S.desSup, S.siteA, {
    linkedUid: /^[a-zA-Z0-9]+$/.test(uid) ? uid : '',
  }),
);
await step('edit employee', () =>
  edit('employees', S.joseph, { phone: '+971 50 100 0002' }),
);
await put('team', 'teams', 'TST-TEAM-MEP', {
  name: 'MEP Crew A (Test)',
  departmentId: S.depMep,
  siteId: S.siteA,
  leaderId: S.sanjay,
});
for (const [k, e, role] of [
  ['tmRavi', 'ravi', 'Member'],
  ['tmJoseph', 'joseph', 'Deputy lead'],
  ['tmSanjay', 'sanjay', 'Lead'],
] as const)
  await step(`team member ${e}`, async () => {
    const r = await getDocs(
      query(
        collection(db, 'companies', C, 'teamMembers'),
        where('employeeId', '==', S[e]),
        where('teamId', '==', S.team),
        limit(1),
      ),
    );
    S[k] = r.empty
      ? await saveRecord(db, C, uid, 'teamMembers', {
          ...defaultValues('teamMembers'),
          teamId: S.team,
          employeeId: S[e],
          memberRole: role,
          startDate: '2026-01-01',
        })
      : r.docs[0].id;
  });
const assignOnce = async (
  kind: Kind,
  match: Record<string, string>,
  v: Values,
) => {
  let q = query(collection(db, 'companies', C, kind), limit(1));
  for (const [k, x] of Object.entries(match)) q = query(q, where(k, '==', x));
  const r = await getDocs(q);
  return r.empty
    ? saveRecord(db, C, uid, kind, { ...defaultValues(kind), ...v })
    : r.docs[0].id;
};
for (const e of ['ravi', 'joseph', 'fatima', 'sanjay', 'me'])
  await step(`site assignment ${e} → Al Noor`, () =>
    assignOnce(
      'siteAssignments',
      { employeeId: S[e], siteId: S.siteA },
      {
        employeeId: S[e],
        siteId: S.siteA,
        assignmentRole: e === 'sanjay' ? 'Site supervisor' : 'Assigned staff',
        startDate: '2026-01-01',
      },
    ),
  );
await step('site assignment ali → Marina', () =>
  assignOnce(
    'siteAssignments',
    { employeeId: S.ali, siteId: S.siteB },
    {
      employeeId: S.ali,
      siteId: S.siteB,
      assignmentRole: 'Assigned staff',
      startDate: '2026-01-01',
    },
  ),
);
await put('shiftDay', 'shifts', 'TST-SH-DAY', {
  name: 'Day shift (Test)',
  siteId: S.siteA,
  startTime: '07:00',
  endTime: '16:00',
  breakMinutes: '60',
  workingDays: 'Sun,Mon,Tue,Wed,Thu',
});
await put('shiftNight', 'shifts', 'TST-SH-NIGHT', {
  name: 'Night shift (Test)',
  siteId: S.siteB,
  startTime: '22:00',
  endTime: '06:00',
  breakMinutes: '30',
  workingDays: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
});
for (const e of ['ravi', 'joseph', 'fatima', 'sanjay', 'me'])
  await step(`shift assignment ${e}`, () =>
    assignOnce(
      'shiftAssignments',
      { employeeId: S[e], shiftId: S.shiftDay },
      { employeeId: S[e], shiftId: S.shiftDay, startDate: '2026-01-01' },
    ),
  );
await step('shift assignment ali (night)', () =>
  assignOnce(
    'shiftAssignments',
    { employeeId: S.ali, shiftId: S.shiftNight },
    { employeeId: S.ali, shiftId: S.shiftNight, startDate: '2026-01-01' },
  ),
);
await put('hol1', 'holidays', 'TST-HOL-NATDAY', {
  name: 'UAE National Day (Test)',
  holidayDate: '2026-12-02',
});
await put('hol2', 'holidays', 'TST-HOL-B-XMAS', {
  name: 'Marina residence closure (Test)',
  holidayDate: '2026-12-25',
  siteId: S.siteB,
});
await step('leave: Fatima annual leave (approved)', () =>
  assignOnce(
    'leaveRecords',
    { employeeId: S.fatima },
    {
      employeeId: S.fatima,
      leaveType: 'Annual',
      startDate: plus(5),
      endDate: plus(7),
      status: 'approved',
      reason: 'Family visit',
    },
  ),
);

/* ---------------------------------------------------------------- assets */
await put('catHvac', 'assetCategories', 'TST-AC-HVAC', {
  name: 'HVAC equipment (Test)',
  assetClass: 'Equipment',
});
await put('catFurn', 'assetCategories', 'TST-AC-FURN', {
  name: 'Lobby furniture (Test)',
  assetClass: 'Furniture',
});
await put('supplier', 'suppliers', 'TST-SUP-COOL', {
  name: 'Cool Air Trading (Test)',
  supplierType: 'Assets and materials',
  phone: '+971 4 333 3333',
});
const asset = (
  name: string,
  cls: string,
  cat: string,
  loc: string,
  extra: Values = {},
) => ({
  name,
  assetClass: cls,
  categoryId: cat,
  trackingMode: 'individual',
  quantity: '1',
  siteId: S.siteA,
  locationId: loc,
  condition: 'Good',
  supplierId: S.supplier,
  ...extra,
});
await put(
  'ahu',
  'assets',
  'TST-AHU-02',
  asset('AHU-02 Air handling unit', 'Equipment', S.catHvac, S.plant, {
    serialNumber: 'AHU02-2024-778',
    purchaseCost: '48500.00',
  }),
);
await put(
  'chiller',
  'assets',
  'TST-CH-01',
  asset('Chiller CH-1', 'Equipment', S.catHvac, S.plant, {
    serialNumber: 'CH1-2023-001',
  }),
);
await put(
  'sofas',
  'assets',
  'TST-FURN-SOFA',
  asset('Lobby sofas', 'Furniture', S.catFurn, S.lobby, {
    trackingMode: 'batch',
    quantity: '4',
  }),
);
await step('edit asset', () =>
  edit('assets', S.chiller, { condition: 'Fair' }),
);
await step('transfer lobby sofas → Marina podium', async () => {
  const a = (await recordById(db, C, 'assets', S.sofas))!;
  if (a.values.siteId === S.siteB) return;
  await transferAsset(db, C, uid, a, {
    toSiteId: S.siteB,
    toLocationId: S.podium,
    transferDate: iso(today),
    reason: 'Podium lounge refurbishment',
    conditionAfter: 'Good',
    receivedById: S.ali,
    notes: 'Test transfer',
  });
});

/* ---------------------------------------------------------------- inventory */
await put('mcClean', 'materialCategories', 'TST-MC-CLN', {
  name: 'Cleaning chemicals (Test)',
});
await put('mcElec', 'materialCategories', 'TST-MC-ELEC', {
  name: 'Electrical spares (Test)',
});
await put('cleaner', 'materials', 'TST-MAT-CLN', {
  name: 'Floor cleaner 5L',
  categoryId: S.mcClean,
  unit: 'bottle',
  reorderLevel: '5',
});
await put('led', 'materials', 'TST-MAT-LED', {
  name: 'LED tube 18W',
  categoryId: S.mcElec,
  unit: 'each',
  reorderLevel: '20',
});
await put('storeA', 'stores', 'TST-ST-A', {
  name: 'Al Noor main store (Test)',
  siteId: S.siteA,
  locationId: S.plant,
});
await put('storeB', 'stores', 'TST-ST-B', {
  name: 'Marina store (Test)',
  siteId: S.siteB,
});
const already = async (ref: string) =>
  !(
    await getDocs(
      query(
        collection(db, 'companies', C, 'stockMovements'),
        where('reference', '==', ref),
        limit(1),
      ),
    )
  ).empty;
const mv = (ref: string, v: Partial<Parameters<typeof postMovement>[3]>) =>
  step(`stock ${v.movementType} ${ref}`, async () => {
    if (await already(ref)) return;
    await postMovement(
      db,
      C,
      uid,
      {
        movementType: 'receipt',
        materialId: '',
        fromStoreId: '',
        toStoreId: '',
        quantity: 1,
        movementDate: iso(today),
        reason: '',
        reference: ref,
        notes: 'Test data',
        issuedToEmployeeId: '',
        issuedToLocationId: '',
        reversesId: '',
        ...v,
      } as Parameters<typeof postMovement>[3],
      newMovementId(db, C),
    );
  });
await mv('TST-OPEN-LED', {
  movementType: 'opening',
  materialId: S.led,
  toStoreId: S.storeA,
  quantity: 40,
});
await mv('TST-OPEN-CLN', {
  movementType: 'opening',
  materialId: S.cleaner,
  toStoreId: S.storeA,
  quantity: 12,
});
await mv('TST-GRN-LED', {
  movementType: 'receipt',
  materialId: S.led,
  toStoreId: S.storeA,
  quantity: 60,
});
await mv('TST-ISS-LED', {
  movementType: 'issue',
  materialId: S.led,
  fromStoreId: S.storeA,
  quantity: 6,
  issuedToEmployeeId: S.joseph,
  issuedToLocationId: S.floor2,
});
await mv('TST-TRF-CLN', {
  movementType: 'transfer',
  materialId: S.cleaner,
  fromStoreId: S.storeA,
  toStoreId: S.storeB,
  quantity: 4,
});
await mv('TST-ADJ-CLN', {
  movementType: 'adjustment_out',
  materialId: S.cleaner,
  fromStoreId: S.storeA,
  quantity: 1,
  reason: 'Damaged bottle',
});
await step('stock reversal of the receipt', async () => {
  const r = await getDocs(
    query(
      collection(db, 'companies', C, 'stockMovements'),
      where('reference', '==', 'TST-GRN-LED'),
      limit(1),
    ),
  );
  const orig = r.docs[0];
  if (!orig) throw new Error('receipt missing');
  const { reversalId, reversalOf } = await import('../packages/shared/src');
  const { getDoc, doc } = await import('firebase/firestore');
  if (
    (
      await getDoc(
        doc(db, 'companies', C, 'stockMovements', reversalId(orig.id)),
      )
    ).exists()
  )
    return;
  const o = orig.data() as Parameters<typeof reversalOf>[0];
  await postMovement(
    db,
    C,
    uid,
    reversalOf({ ...o, id: orig.id }, iso(today), 'Wrong delivery note'),
    reversalId(orig.id),
  );
});

/* ---------------------------------------------------------------- tasks */
await put('tcHvac', 'taskCategories', 'TST-TC-HVAC', {
  name: 'HVAC inspections (Test)',
  departmentId: S.depMep,
});
await put('tcHk', 'taskCategories', 'TST-TC-HK', {
  name: 'Housekeeping (Test)',
  departmentId: S.depHk,
});
await put('tplAc', 'taskTemplates', 'TST-TPL-AC', {
  name: 'AC daily inspection (Test)',
  categoryId: S.tcHvac,
  departmentId: S.depMep,
  defaultPriority: 'high',
});
await put('tplClean', 'taskTemplates', 'TST-TPL-LOBBY', {
  name: 'Lobby cleaning (Test)',
  categoryId: S.tcHk,
  departmentId: S.depHk,
  defaultPriority: 'medium',
});
async function publish(templateId: string, content: VersionContent) {
  const versions = await listVersions(db, C, templateId);
  const live = versions.find((v) => v.state === 'published');
  if (live) return live.id;
  const draftId =
    versions.find((v) => v.state === 'draft')?.id ||
    (await createDraft(db, C, uid, templateId, content));
  const v = (await listVersions(db, C, templateId)).find(
    (x) => x.id === draftId,
  )!;
  await saveDraft(db, C, uid, v, content, true);
  return draftId;
}
const raci = (des: string, sup: string) => [
  {
    id: 'r1',
    letter: 'R' as const,
    kind: 'designation' as const,
    refId: des,
    label: 'Performs',
    siteId: '',
  },
  {
    id: 'r2',
    letter: 'A' as const,
    kind: 'designation' as const,
    refId: sup,
    label: 'Approves',
    siteId: '',
  },
];
const acContent: VersionContent = (() => {
  const c = emptyContent('AC daily inspection');
  const q1 = {
    ...newQuestion('s1', 'qr'),
    id: 'q1',
    label: 'Scan the unit QR label',
    required: false,
  };
  const q2 = {
    ...newQuestion('s1', 'pass_fail', [q1]),
    id: 'q2',
    label: 'Unit cooling normally',
  };
  const q3 = {
    ...newQuestion('s1', 'text', [q1, q2]),
    id: 'q3',
    label: 'Describe the fault',
    showIf: { questionId: 'q2', equals: 'fail' },
  };
  const q4 = {
    ...newQuestion('s1', 'temperature', [q1, q2, q3]),
    id: 'q4',
    label: 'Supply air temperature',
    min: -10,
    max: 60,
    expectedMin: 12,
    expectedMax: 18,
  };
  const q5 = {
    ...newQuestion('s2', 'yes_no', [q1, q2, q3, q4]),
    id: 'q5',
    label: 'Drain pan clean and dry',
  };
  const q6 = {
    ...newQuestion('s2', 'photo', [q1, q2, q3, q4, q5]),
    id: 'q6',
    label: 'Photo of the filter',
    required: false,
  };
  return {
    ...c,
    instructions:
      'Isolate power before opening panels. Report leaks immediately.',
    priority: 'high',
    estimatedMinutes: 25,
    sections: [
      { id: 's1', title: 'Cooling' },
      { id: 's2', title: 'Condition' },
    ],
    questions: [q1, q2, q3, q4, q5, q6],
    raci: raci(S.desAc, S.desSup),
  };
})();
const cleanContent: VersionContent = (() => {
  const c = emptyContent('Lobby cleaning');
  const q1 = {
    ...newQuestion('s1', 'pass_fail'),
    id: 'q1',
    label: 'Floor mopped and dry',
  };
  const q2 = {
    ...newQuestion('s1', 'pass_fail', [q1]),
    id: 'q2',
    label: 'Glass doors clean',
  };
  const q3 = {
    ...newQuestion('s1', 'yes_no', [q1, q2]),
    id: 'q3',
    label: 'Wet-floor signs used',
  };
  return {
    ...c,
    approvalRequired: false,
    estimatedMinutes: 30,
    questions: [q1, q2, q3],
    raci: raci(S.desCl, S.desSup),
  };
})();
S.vAc =
  (await step('publish AC template v1', () => publish(S.tplAc, acContent))) ||
  '';
S.vClean =
  (await step('publish lobby cleaning template v1', () =>
    publish(S.tplClean, cleanContent),
  )) || '';
const findTask = async (title: string) =>
  (
    await getDocs(
      query(
        collection(db, 'companies', C, 'tasks'),
        where('title', '==', title),
        limit(1),
      ),
    )
  ).docs[0]?.id;
const mkTask = async (
  title: string,
  v: Partial<Parameters<typeof createTask>[3]>,
) =>
  (await findTask(title)) ||
  createTask(db, C, uid, {
    versionId: S.vAc,
    title,
    siteId: S.siteA,
    locationId: S.plant,
    facilityId: '',
    assetId: S.ahu,
    departmentId: S.depMep,
    assigneeIds: [S.ravi],
    teamId: '',
    priority: 'high',
    plannedStart: '',
    dueAt: local(4),
    notes: 'Test data',
    ...v,
  });
const tA = await step('task: assigned (AC inspection – Floor 2)', () =>
  mkTask('TST AC inspection – Floor 2', { locationId: S.floor2 }),
);
const tB = await step('task: started and progress saved', async () => {
  const id = await mkTask('TST Chiller check', {
    assetId: S.chiller,
    assigneeIds: [S.me],
  });
  const t = (await getTask(db, C, id))!;
  if (t.status === 'assigned') {
    await transitionTask(db, C, uid, t, 'start');
    await saveProgress(db, C, uid, (await getTask(db, C, id))!, {
      q2: 'pass',
      q4: '15',
    });
  }
  return id;
});
await step('task: submitted for approval with an exception', async () => {
  const id = await mkTask('TST AHU-02 inspection (submitted)', {
    assigneeIds: [S.me],
  });
  let t = (await getTask(db, C, id))!;
  if (t.status === 'assigned') await transitionTask(db, C, uid, t, 'start');
  t = (await getTask(db, C, id))!;
  if (t.status === 'in_progress')
    await submitTask(
      db,
      C,
      uid,
      t,
      {
        q2: 'fail',
        q3: 'Water dripping from the drain pan',
        q4: '24',
        q5: 'no',
      },
      'Leak found, work order requested',
    );
});
await step('task: paused', async () => {
  const id = await mkTask('TST Plant room round (paused)', {
    assigneeIds: [S.me],
  });
  let t = (await getTask(db, C, id))!;
  if (t.status === 'assigned') await transitionTask(db, C, uid, t, 'start');
  t = (await getTask(db, C, id))!;
  if (t.status === 'in_progress') await transitionTask(db, C, uid, t, 'pause');
});
await step('task: completed without approval (lobby cleaning)', async () => {
  const id = await mkTask('TST Lobby cleaning – morning', {
    versionId: S.vClean,
    locationId: S.lobby,
    assetId: '',
    departmentId: S.depHk,
    assigneeIds: [S.me],
    priority: 'medium',
    dueAt: local(1),
  });
  let t = (await getTask(db, C, id))!;
  if (t.status === 'assigned') await transitionTask(db, C, uid, t, 'start');
  t = (await getTask(db, C, id))!;
  if (t.status === 'in_progress')
    await submitTask(db, C, uid, t, { q1: 'pass', q2: 'pass', q3: 'yes' }, '');
});
await step('task: reassigned', async () => {
  const id = await mkTask('TST Electrical panel check', {
    assigneeIds: [S.ravi],
    assetId: '',
    locationId: S.floor2,
  });
  const t = (await getTask(db, C, id))!;
  if (t.assigneeIds[0] !== S.joseph)
    await transitionTask(db, C, uid, t, 'assign', { assigneeIds: [S.joseph] });
});
await step('task: cancelled with reason', async () => {
  const id = await mkTask('TST Pool water test (cancelled)', {
    siteId: S.siteB,
    locationId: S.podium,
    facilityId: S.pool,
    assetId: '',
    assigneeIds: [S.ali],
  });
  const t = (await getTask(db, C, id))!;
  if (t.status !== 'cancelled')
    await transitionTask(db, C, uid, t, 'cancel', {
      note: 'Pool closed for maintenance',
    });
});
await step('task: overdue (pending, unassigned)', () =>
  mkTask('TST Fire extinguisher check (overdue)', {
    assigneeIds: [],
    assetId: '',
    locationId: S.lobby,
    dueAt: local(-6),
    priority: 'critical',
  }),
);
await step('task: issue reported during work', async () => {
  const t = (await getTask(db, C, tB!))!;
  await reportException(
    db,
    C,
    uid,
    t,
    {
      type: 'Water leakage',
      severity: 'critical',
      description: 'Water pooling under chiller CH-1',
    },
    'TSTexChiller',
  );
});
void tA;

/* ---------------------------------------------------------------- schedules */
const sched = async (
  code: string,
  v: Partial<ReturnType<typeof emptySchedule>>,
) => {
  const list = await listSchedules(db, C);
  const found = list.find((s) => s.code === code);
  if (found) return found.id;
  return saveSchedule(db, C, uid, {
    ...emptySchedule(v.purpose || 'routine', 'Asia/Dubai', iso(today)),
    code,
    ...v,
  } as ReturnType<typeof emptySchedule>);
};
await step('recurring task: weekday AC round (round-robin MEP)', () =>
  sched('TST-SCH-AC', {
    name: 'TST Weekday AC round',
    templateId: S.tplAc,
    versionId: S.vAc,
    siteId: S.siteA,
    locationId: S.plant,
    assetId: S.ahu,
    departmentId: S.depMep,
    rule: makeRule({ type: 'weekdays' }),
    localTime: '08:30',
    durationMinutes: 45,
    workingDays: [0, 1, 2, 3, 4],
    priority: 'high',
    assignment: {
      strategy: 'round_robin',
      pool: 'department',
      refId: S.depMep,
      employeeIds: [],
      siteOnly: true,
    },
  }),
);
await step('preventive maintenance plan: monthly chiller service', () =>
  sched('TST-PM-CH1', {
    purpose: 'maintenance',
    name: 'TST Chiller CH-1 monthly service',
    templateId: S.tplAc,
    versionId: S.vAc,
    siteId: S.siteA,
    locationId: S.plant,
    assetId: S.chiller,
    departmentId: S.depMep,
    rule: makeRule({ type: 'monthly_dates', monthDays: [1] }),
    localTime: '09:00',
    durationMinutes: 120,
    priority: 'high',
    assignment: {
      strategy: 'fixed',
      pool: 'employee',
      refId: '',
      employeeIds: [S.ravi, S.joseph],
      siteOnly: false,
    },
  }),
);
await step('scheduler run (manual)', async () => {
  const r = await runScheduler(db, C, uid, { mode: 'manual' });
  console.log(
    `   created ${r.created}, existing ${r.existing}, unassigned ${r.unassigned}`,
  );
});

/* ---------------------------------------------------------------- SLA, work orders, complaints, escalations */
await put('slaHigh', 'slaPolicies', 'TST-SLA-HIGH', {
  name: 'High priority (Test)',
  priority: 'high',
  appliesTo: 'all',
  responseMinutes: '60',
  resolutionMinutes: '480',
  hoursMode: 'calendar',
});
await put('slaCrit', 'slaPolicies', 'TST-SLA-CRIT', {
  name: 'Critical – business hours (Test)',
  priority: 'critical',
  appliesTo: 'all',
  responseMinutes: '30',
  resolutionMinutes: '240',
  hoursMode: 'business',
  siteId: S.siteA,
});
await step('work order from the reported issue', () =>
  createCase(db, C, uid, 'workOrders', {
    ...emptyCase('workOrders'),
    title: 'Water pooling under chiller CH-1',
    description: 'Reported during the chiller check',
    priority: 'high',
    severity: 'critical',
    category: 'Plumbing',
    siteId: S.siteA,
    locationId: S.plant,
    assetId: S.chiller,
    departmentId: S.depMep,
    sourceType: 'task_exception',
    sourceId: 'TSTexChiller',
    reportedBy: 'Flowbee Admin',
  }),
);
await step(
  'work order full lifecycle (assign → start → hold → resume → resolve → verify → close)',
  async () => {
    const { id } = await createCase(db, C, uid, 'workOrders', {
      ...emptyCase('workOrders'),
      title: 'TST Replace corridor LED tubes – Floor 2',
      priority: 'high',
      category: 'Electrical',
      siteId: S.siteA,
      locationId: S.floor2,
      departmentId: S.depMep,
      sourceType: 'staff',
      sourceId: 'TSTwoLed',
      reportedBy: 'Floor 2 tenant',
    });
    const g = async () => (await getCase(db, C, 'workOrders', id))!;
    const go = async (
      a: string,
      o: Parameters<typeof transitionCase>[5] = {},
    ) => {
      const w = await g();
      const def = (await import('../packages/shared/src')).caseDefinitions
        .workOrders.actions[a];
      if (def.from.includes(w.status))
        await transitionCase(db, C, uid, w, a, o);
    };
    await go('review');
    await go('assign', { assigneeIds: [S.joseph] });
    await go('start');
    await go('hold', { note: 'Waiting for spare tubes from store' });
    await go('resume');
    await go('note', { note: 'Assistance requested: ladder needed' });
    await go('resolve', { note: 'Replaced 6 tubes' });
    await go('verify');
    await go('close');
  },
);
await step('material issued against a work order', async () => {
  const r = await getDocs(
    query(
      collection(db, 'companies', C, 'workOrders'),
      where('sourceId', '==', 'TSTwoLed'),
      limit(1),
    ),
  );
  if (await already('TST-WO-LED')) return;
  await postMovement(
    db,
    C,
    uid,
    {
      movementType: 'issue',
      materialId: S.led,
      fromStoreId: S.storeA,
      toStoreId: '',
      quantity: 6,
      movementDate: iso(today),
      reason: '',
      reference: 'TST-WO-LED',
      notes: 'Issued for work order',
      issuedToEmployeeId: S.joseph,
      issuedToLocationId: S.floor2,
      reversesId: '',
      workOrderId: r.docs[0].id,
    },
    newMovementId(db, C),
  );
});
await step('open work order assigned to the test employee', async () => {
  const { id } = await createCase(db, C, uid, 'workOrders', {
    ...emptyCase('workOrders'),
    title: 'TST Lift L1 door sensor fault',
    priority: 'critical',
    category: 'Electrical',
    siteId: S.siteA,
    locationId: S.lobby,
    facilityId: S.lift,
    departmentId: S.depMep,
    sourceType: 'staff',
    sourceId: 'TSTwoLift',
    reportedBy: 'Reception',
  });
  const w = (await getCase(db, C, 'workOrders', id))!;
  if (w.status === 'reported')
    await transitionCase(db, C, uid, w, 'assign', { assigneeIds: [S.me] });
});
let complaintId = '';
await step('complaint: register → assign → work order', async () => {
  const { id } = await createCase(db, C, uid, 'complaints', {
    ...emptyCase('complaints'),
    title: 'TST Lobby too warm in the afternoon',
    description: 'Tenants report 27°C in the lobby after 2 pm',
    priority: 'high',
    category: 'HVAC',
    siteId: S.siteA,
    locationId: S.lobby,
    sourceType: 'client',
    reportedBy: 'Gulf Bridge Holdings',
    clientId: S.client,
    contractId: S.contract,
    sourceId: 'TSTcmpLobby',
  });
  complaintId = id;
  let c = (await getCase(db, C, 'complaints', id))!;
  if (c.status === 'open')
    await transitionCase(db, C, uid, c, 'assign', { assigneeIds: [S.ravi] });
  c = (await getCase(db, C, 'complaints', id))!;
  await workOrderFromComplaint(db, C, uid, c);
});
await step('escalation: raise → acknowledge → escalate further', async () => {
  const c = (await getCase(db, C, 'complaints', complaintId))!;
  const e = await escalateFurther(
    db,
    C,
    uid,
    c,
    S.depMep,
    'Repeated complaints from the client',
  );
  const esc = (await getCase(db, C, 'escalations', e.id))!;
  if (esc.status === 'raised')
    await transitionCase(db, C, uid, esc, 'acknowledge');
  await escalateFurther(
    db,
    C,
    uid,
    (await getCase(db, C, 'escalations', e.id))!,
    S.depSec,
    'Needs building management decision',
  );
});

/* ---------------------------------------------------------------- archive actions */
for (const [kind, code, v] of [
  ['departments', 'TST-ARCH-DEP', { name: 'Old department (Test, archived)' }],
  [
    'designations',
    'TST-ARCH-DES',
    { name: 'Old designation (Test, archived)' },
  ],
  [
    'facilityTypes',
    'TST-ARCH-FT',
    { name: 'Old facility type (Test, archived)' },
  ],
  [
    'assetCategories',
    'TST-ARCH-AC',
    { name: 'Old asset category (Test, archived)', assetClass: 'Tool' },
  ],
  [
    'suppliers',
    'TST-ARCH-SUP',
    { name: 'Old supplier (Test, archived)', supplierType: 'Services' },
  ],
  [
    'materialCategories',
    'TST-ARCH-MC',
    { name: 'Old material category (Test, archived)' },
  ],
  [
    'taskCategories',
    'TST-ARCH-TC',
    { name: 'Old task category (Test, archived)' },
  ],
  [
    'clients',
    'TST-ARCH-CL',
    { name: 'Former client (Test, archived)', clientType: 'Company' },
  ],
  ['teams', 'TST-ARCH-TEAM', { name: 'Old team (Test, archived)' }],
  [
    'holidays',
    'TST-ARCH-HOL',
    { name: 'Cancelled holiday (Test, archived)', holidayDate: '2026-12-31' },
  ],
] as [Kind, string, Values][])
  await step(`archive ${kind} ${code}`, async () => {
    const id = await ensure(kind, code, v);
    await archive(kind, id);
  });

/* ---------------------------------------------------------------- staff access for this login */
await step(
  'link this login to the test employee (staff portal / mobile)',
  async () => {
    const links = await listStaffLinks(db, C);
    if (links.some((l) => l.uid === uid)) return;
    await linkStaff(db, C, uid, {
      uid,
      employeeId: S.me,
      siteIds: [S.siteA, S.siteB],
      allSites: false,
      note: 'Test: admin can also use the staff portal',
    });
  },
);

const failed = results.filter((r) => !r.ok);
console.log(
  `\nDone: ${results.length - failed.length} succeeded, ${failed.length} failed.`,
);
for (const f of failed) console.log('  ✗', f.step, '—', f.note);
process.exit(failed.length ? 1 : 0);
