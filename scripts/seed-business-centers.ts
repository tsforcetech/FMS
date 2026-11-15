// GBH business-centre structure (live, idempotent, through the app's data layer):
// sites → floors → rooms (101–120, 201–220, …) and common areas, room
// furniture (table + chair per room), common facilities and equipment,
// cleaning staff, shifts, tenants, inspection templates and daily schedules.
//   FOS_EMAIL=... FOS_PASSWORD=... npx tsx scripts/seed-business-centers.ts --company gbh --confirm-live facilityos-43386
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
import { saveRecord } from '../apps/admin-web/src/management/store';
import {
  createDraft,
  saveDraft,
  listVersions,
} from '../apps/admin-web/src/management/tasksStore';
import {
  createCase,
  emptyCase,
} from '../apps/admin-web/src/management/casesStore';
import {
  saveSchedule,
  emptySchedule,
  runScheduler,
  listSchedules,
} from '../apps/admin-web/src/management/scheduling';
import {
  listStaffLinks,
  updateStaffScope,
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
  throw new Error('Set FOS_EMAIL and FOS_PASSWORD.');
const C = args.company;
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: memoryLocalCache() });
const { user } = await signInWithEmailAndPassword(
  auth,
  process.env.FOS_EMAIL,
  process.env.FOS_PASSWORD,
);
const uid = user.uid;
let ok = 0,
  created = 0;
const failed: string[] = [];
async function step<T>(name: string, fn: () => Promise<T>) {
  try {
    const r = await fn();
    ok++;
    return r;
  } catch (e) {
    failed.push(`${name} — ${(e as Error).message}`);
    console.log('✗', name, '—', (e as Error).message);
    return undefined;
  }
}
const byCode = async (kind: Kind, code: string) =>
  (
    await getDocs(
      query(
        collection(db, 'companies', C, kind),
        where('code', '==', code),
        limit(1),
      ),
    )
  ).docs[0]?.id;
async function ensure(kind: Kind, code: string, v: Values) {
  const id = await step(`${kind} ${code}`, async () => {
    const found = await byCode(kind, code);
    if (found) return found;
    created++;
    return saveRecord(db, C, uid, kind, { ...defaultValues(kind), code, ...v });
  });
  return id || '';
}
const find = async (kind: Kind, match: Record<string, string>) => {
  let q = query(collection(db, 'companies', C, kind), limit(1));
  for (const [k, x] of Object.entries(match)) q = query(q, where(k, '==', x));
  return (await getDocs(q)).docs[0]?.id;
};
const once = (
  kind: Kind,
  match: Record<string, string>,
  v: Values,
  label: string,
) =>
  step(
    label,
    async () =>
      (await find(kind, match)) ||
      saveRecord(db, C, uid, kind, { ...defaultValues(kind), ...v }),
  );

console.log(`Business-centre data for ${C} as ${user.email}`);
/* ---------------------------------------------------------------- shared masters */
const ft: Record<string, string> = {};
for (const [k, name] of [
  ['PANTRY', 'Pantry'],
  ['MEET', 'Meeting room'],
  ['LIFT', 'Lift'],
  ['GAME', 'Game centre'],
  ['COMMON', 'Common area'],
])
  ft[k] = await ensure('facilityTypes', `BC-FT-${k}`, { name });
const catRoom = await ensure('assetCategories', 'BC-AC-ROOMFURN', {
  name: 'Room furniture',
  assetClass: 'Furniture',
});
const catMeet = await ensure('assetCategories', 'BC-AC-MEETFURN', {
  name: 'Meeting room furniture',
  assetClass: 'Furniture',
});
const catPantry = await ensure('assetCategories', 'BC-AC-PANTRY', {
  name: 'Pantry appliances',
  assetClass: 'Equipment',
});
const catGame = await ensure('assetCategories', 'BC-AC-GAME', {
  name: 'Recreation equipment',
  assetClass: 'Equipment',
});
const depHk =
  (await byCode('departments', 'TST-DEP-HK')) ||
  (await ensure('departments', 'BC-DEP-HK', { name: 'Housekeeping' }));
const depMep =
  (await byCode('departments', 'TST-DEP-MEP')) ||
  (await ensure('departments', 'BC-DEP-MEP', { name: 'MEP Services' }));
const desCl =
  (await byCode('designations', 'TST-DES-CLN')) ||
  (await ensure('designations', 'BC-DES-CLN', {
    name: 'Cleaner',
    departmentId: depHk,
  }));
const desRec = await ensure('designations', 'BC-DES-REC', {
  name: 'Receptionist',
  departmentId: depHk,
});
const joseph = (await byCode('employees', 'TST-E002')) || '';
const fatima = (await byCode('employees', 'TST-E003')) || '';

/* ---------------------------------------------------------------- buildings */
const centres = [
  {
    key: 'MUT',
    name: 'Muteena Business Centre',
    area: 'Muteena, Deira',
    floors: 3,
  },
  {
    key: 'TRC',
    name: 'Trade Centre Business Centre',
    area: 'Trade Centre, Dubai',
    floors: 3,
  },
  {
    key: 'RAK',
    name: 'Ras Al Khor Business Centre',
    area: 'Ras Al Khor',
    floors: 2,
  },
];
const cleaners: Record<string, { name: string; code: string }> = {
  MUT: { name: 'Mary Joseph', code: 'BC-E101' },
  TRC: { name: 'Imran Ali', code: 'BC-E102' },
  RAK: { name: 'Suresh Nair', code: 'BC-E103' },
};
const out: Record<
  string,
  { site: string; floors: string[]; lobby: string; game: string; rooms: number }
> = {};
for (const c of centres) {
  console.log(`— ${c.name}`);
  const site = await ensure('sites', `${c.key}-BC`, {
    name: c.name,
    propertyType: 'Commercial building',
    timeZone: 'Asia/Dubai',
    city: 'Dubai',
    country: 'United Arab Emirates',
    address: c.area,
    workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
    opensAt: '08:00',
    closesAt: '20:00',
    contactPerson: `${c.name} reception`,
  });
  const floors: string[] = [];
  let lobby = '',
    game = '',
    rooms = 0;
  for (let f = 1; f <= c.floors; f++) {
    const floor = await ensure('locations', `${c.key}-F${f}`, {
      name: `Floor ${f}`,
      siteId: site,
      locationType: 'Floor',
      floorNumber: String(f),
    });
    floors.push(floor);
    for (let r = 1; r <= 20; r++) {
      const no = `${f}${String(r).padStart(2, '0')}`;
      const room = await ensure('locations', `${c.key}-${no}`, {
        name: `Room ${no}`,
        siteId: site,
        parentId: floor,
        locationType: 'Room',
        floorNumber: String(f),
      });
      if (!room) continue;
      rooms++;
      await ensure('assets', `${c.key}-${no}-TBL`, {
        name: `Office table – Room ${no}`,
        assetClass: 'Furniture',
        categoryId: catRoom,
        trackingMode: 'individual',
        quantity: '1',
        siteId: site,
        locationId: room,
        condition: 'Good',
      });
      await ensure('assets', `${c.key}-${no}-CHR`, {
        name: `Office chair – Room ${no}`,
        assetClass: 'Furniture',
        categoryId: catRoom,
        trackingMode: 'individual',
        quantity: '1',
        siteId: site,
        locationId: room,
        condition: 'Good',
      });
    }
    // Common spaces on every floor.
    const pantry = await ensure('locations', `${c.key}-F${f}-PANTRY`, {
      name: `Pantry – Floor ${f}`,
      siteId: site,
      parentId: floor,
      locationType: 'Room',
      floorNumber: String(f),
    });
    const meet = await ensure('locations', `${c.key}-F${f}-MEET`, {
      name: `Meeting room – Floor ${f}`,
      siteId: site,
      parentId: floor,
      locationType: 'Room',
      floorNumber: String(f),
    });
    const common = await ensure('locations', `${c.key}-F${f}-COMMON`, {
      name: `Common area – Floor ${f}`,
      siteId: site,
      parentId: floor,
      locationType: 'Zone',
      floorNumber: String(f),
    });
    await ensure('facilities', `${c.key}-F${f}-PANTRY-F`, {
      name: `Pantry – Floor ${f}`,
      siteId: site,
      locationId: pantry,
      typeId: ft.PANTRY,
      condition: 'Good',
    });
    await ensure('facilities', `${c.key}-F${f}-MEET-F`, {
      name: `Meeting room – Floor ${f}`,
      siteId: site,
      locationId: meet,
      typeId: ft.MEET,
      condition: 'Good',
    });
    await ensure('facilities', `${c.key}-F${f}-COMMON-F`, {
      name: `Common area – Floor ${f}`,
      siteId: site,
      locationId: common,
      typeId: ft.COMMON,
      condition: 'Good',
    });
    await ensure('assets', `${c.key}-F${f}-MEET-TBL`, {
      name: `Conference table – Floor ${f}`,
      assetClass: 'Furniture',
      categoryId: catMeet,
      trackingMode: 'individual',
      quantity: '1',
      siteId: site,
      locationId: meet,
      condition: 'Good',
    });
    await ensure('assets', `${c.key}-F${f}-MEET-CHR`, {
      name: `Meeting chairs – Floor ${f}`,
      assetClass: 'Furniture',
      categoryId: catMeet,
      trackingMode: 'batch',
      quantity: '8',
      siteId: site,
      locationId: meet,
      condition: 'Good',
    });
    await ensure('assets', `${c.key}-F${f}-FRIDGE`, {
      name: `Pantry refrigerator – Floor ${f}`,
      assetClass: 'Equipment',
      categoryId: catPantry,
      trackingMode: 'individual',
      quantity: '1',
      siteId: site,
      locationId: pantry,
      condition: 'Good',
    });
    await ensure('assets', `${c.key}-F${f}-MICRO`, {
      name: `Pantry microwave – Floor ${f}`,
      assetClass: 'Equipment',
      categoryId: catPantry,
      trackingMode: 'individual',
      quantity: '1',
      siteId: site,
      locationId: pantry,
      condition: 'Good',
    });
    if (f === 1) {
      lobby = await ensure('locations', `${c.key}-F1-LIFT`, {
        name: 'Lift lobby',
        siteId: site,
        parentId: floor,
        locationType: 'Zone',
        floorNumber: '1',
      });
      game = await ensure('locations', `${c.key}-F1-GAME`, {
        name: 'Game centre',
        siteId: site,
        parentId: floor,
        locationType: 'Room',
        floorNumber: '1',
      });
      await ensure('facilities', `${c.key}-LIFT-1`, {
        name: 'Passenger lift',
        siteId: site,
        locationId: lobby,
        typeId: ft.LIFT,
        condition: 'Good',
      });
      await ensure('facilities', `${c.key}-GAME`, {
        name: 'Game centre',
        siteId: site,
        locationId: game,
        typeId: ft.GAME,
        condition: 'Good',
      });
      await ensure('assets', `${c.key}-GAME-POOL`, {
        name: 'Pool table',
        assetClass: 'Equipment',
        categoryId: catGame,
        trackingMode: 'individual',
        quantity: '1',
        siteId: site,
        locationId: game,
        condition: 'Good',
      });
      await ensure('assets', `${c.key}-GAME-TT`, {
        name: 'Table tennis table',
        assetClass: 'Equipment',
        categoryId: catGame,
        trackingMode: 'individual',
        quantity: '1',
        siteId: site,
        locationId: game,
        condition: 'Good',
      });
    }
  }
  out[c.key] = { site, floors, lobby, game, rooms };
  // People and shift for the centre.
  const cl = cleaners[c.key];
  const cleaner = await ensure('employees', cl.code, {
    name: cl.name,
    joiningDate: '2025-09-01',
    employmentType: 'Full-time',
    departmentId: depHk,
    designationId: desCl,
    primarySiteId: site,
  });
  await ensure('employees', `${cl.code}R`, {
    name: `${c.key === 'MUT' ? 'Aisha Rahman' : c.key === 'TRC' ? 'Noura Saeed' : 'Priya Menon'}`,
    joiningDate: '2025-09-01',
    employmentType: 'Full-time',
    departmentId: depHk,
    designationId: desRec,
    primarySiteId: site,
  });
  const shift = await ensure('shifts', `${c.key}-SH-DAY`, {
    name: `${c.name} day shift`,
    siteId: site,
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: '60',
    workingDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
  });
  for (const e of [cleaner, fatima, joseph].filter(Boolean)) {
    await once(
      'siteAssignments',
      { employeeId: e, siteId: site },
      {
        employeeId: e,
        siteId: site,
        assignmentRole: 'Assigned staff',
        startDate: '2026-01-01',
      },
      `site assignment ${c.key}`,
    );
  }
  await once(
    'shiftAssignments',
    { employeeId: cleaner, shiftId: shift },
    { employeeId: cleaner, shiftId: shift, startDate: '2026-01-01' },
    `shift ${c.key}`,
  );
}

/* ---------------------------------------------------------------- tenants (client occupancy of rooms) */
const tenants: [string, string, string, string[]][] = [
  ['BC-CL-ALPHA', 'Alpha Trading LLC', 'MUT', ['101', '102']],
  ['BC-CL-NOVA', 'Nova Consulting FZE', 'TRC', ['201']],
  ['BC-CL-DESERT', 'Desert Tech Solutions', 'RAK', ['105', '106']],
];
for (const [code, name, key, rooms] of tenants) {
  const client = await ensure('clients', code, { name, clientType: 'Company' });
  const contract = await ensure('contracts', `${code}-LEASE`, {
    name: `${name} – office lease 2026`,
    clientId: client,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'active',
  });
  for (const no of rooms) {
    const loc = await byCode('locations', `${key}-${no}`);
    if (loc)
      await ensure('contractAllocations', `${code}-${no}`, {
        name: `Room ${no}`,
        contractId: contract,
        siteId: out[key].site,
        locationId: loc,
        allocationType: 'exclusive_occupancy',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'active',
      });
  }
}

/* ---------------------------------------------------------------- templates and daily schedules */
const tc = await ensure('taskCategories', 'BC-TC-HK', {
  name: 'Business centre housekeeping',
  departmentId: depHk,
});
const tcM = await ensure('taskCategories', 'BC-TC-MEP', {
  name: 'Business centre technical checks',
  departmentId: depMep,
});
const raci = (des: string) => [
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
    kind: 'department' as const,
    refId: depHk,
    label: 'Housekeeping supervisor',
    siteId: '',
  },
];
function content(
  title: string,
  minutes: number,
  qs: [string, 'pass_fail' | 'yes_no' | 'qr' | 'photo', boolean?][],
  approval = false,
): VersionContent {
  const questions: VersionContent['questions'] = [];
  for (const [label, type, optional] of qs)
    questions.push({
      ...newQuestion('s1', type, questions),
      label,
      required: !optional,
    });
  return {
    ...emptyContent(title),
    estimatedMinutes: minutes,
    approvalRequired: approval,
    questions,
    raci: raci(desCl),
  };
}
async function publish(
  code: string,
  name: string,
  cat: string,
  c: VersionContent,
) {
  const tpl = await ensure('taskTemplates', code, {
    name,
    categoryId: cat,
    departmentId: depHk,
    defaultPriority: 'medium',
  });
  const versions = await listVersions(db, C, tpl);
  const live = versions.find((v) => v.state === 'published');
  if (live) return { tpl, version: live.id };
  const id =
    versions.find((v) => v.state === 'draft')?.id ||
    (await createDraft(db, C, uid, tpl, c));
  const v = (await listVersions(db, C, tpl)).find((x) => x.id === id)!;
  await saveDraft(db, C, uid, v, c, true);
  return { tpl, version: id };
}
const roomCheck = await step('publish room inspection', () =>
  publish(
    'BC-TPL-ROOM',
    'Floor rooms daily inspection',
    tc,
    content('Floor rooms daily inspection', 40, [
      ['All rooms on the floor cleaned', 'pass_fail'],
      ['Tables in good condition', 'pass_fail'],
      ['Chairs in good condition', 'pass_fail'],
      ['Lights and AC working in all rooms', 'yes_no'],
      ['Corridor and common area clean', 'pass_fail'],
      ['Photo of any damage', 'photo', true],
    ]),
  ),
);
const pantry = await step('publish pantry cleaning', () =>
  publish(
    'BC-TPL-PANTRY',
    'Pantry cleaning',
    tc,
    content('Pantry cleaning', 20, [
      ['Counters and sink cleaned', 'pass_fail'],
      ['Refrigerator clean, no expired food', 'pass_fail'],
      ['Microwave clean', 'pass_fail'],
      ['Waste bins emptied', 'yes_no'],
    ]),
  ),
);
const amenity = await step('publish meeting room / game centre check', () =>
  publish(
    'BC-TPL-AMENITY',
    'Meeting room and game centre check',
    tc,
    content('Meeting room and game centre check', 20, [
      ['Meeting rooms clean and chairs arranged', 'pass_fail'],
      ['Screens and lighting working', 'yes_no'],
      ['Game centre clean, equipment in place', 'pass_fail'],
    ]),
  ),
);
const lift = await step('publish lift daily check', () =>
  publish(
    'BC-TPL-LIFT',
    'Lift daily check',
    tcM,
    content(
      'Lift daily check',
      15,
      [
        ['Scan the lift QR label', 'qr', true],
        ['Lift levels correctly at every floor', 'pass_fail'],
        ['Doors open and close smoothly', 'pass_fail'],
        ['Emergency phone/alarm working', 'yes_no'],
      ],
      true,
    ),
  ),
);
const existing = new Set((await listSchedules(db, C)).map((s) => s.code));
const plan = async (
  code: string,
  v: Partial<ReturnType<typeof emptySchedule>>,
) =>
  step(`schedule ${code}`, async () => {
    if (existing.has(code)) return;
    created++;
    await saveSchedule(db, C, uid, {
      ...emptySchedule(
        'routine',
        'Asia/Dubai',
        new Date().toISOString().slice(0, 10),
      ),
      code,
      workingDays: [1, 2, 3, 4, 5, 6],
      holidayPolicy: 'skip',
      ...v,
    } as ReturnType<typeof emptySchedule>);
  });
const housekeeping = () => ({
  strategy: 'round_robin' as const,
  pool: 'designation' as const,
  refId: desCl,
  employeeIds: [],
  siteOnly: true,
});
for (const c of centres) {
  const o = out[c.key];
  if (roomCheck)
    for (let f = 0; f < o.floors.length; f++)
      await plan(`${c.key}-SCH-F${f + 1}`, {
        name: `${c.key} Floor ${f + 1} – rooms daily inspection`,
        templateId: roomCheck.tpl,
        versionId: roomCheck.version,
        siteId: o.site,
        locationId: o.floors[f],
        departmentId: depHk,
        rule: makeRule({ type: 'daily' }),
        localTime: '08:30',
        durationMinutes: 60,
        assignment: housekeeping(),
      });
  if (pantry)
    await plan(`${c.key}-SCH-PANTRY`, {
      name: `${c.key} pantries – cleaning`,
      templateId: pantry.tpl,
      versionId: pantry.version,
      siteId: o.site,
      departmentId: depHk,
      rule: makeRule({ type: 'daily' }),
      localTime: '11:00',
      durationMinutes: 45,
      assignment: housekeeping(),
    });
  if (amenity)
    await plan(`${c.key}-SCH-AMENITY`, {
      name: `${c.key} meeting rooms & game centre`,
      templateId: amenity.tpl,
      versionId: amenity.version,
      siteId: o.site,
      locationId: o.game,
      departmentId: depHk,
      rule: makeRule({ type: 'daily' }),
      localTime: '16:00',
      durationMinutes: 30,
      assignment: housekeeping(),
    });
  if (lift)
    await plan(`${c.key}-SCH-LIFT`, {
      name: `${c.key} lift – daily check`,
      templateId: lift.tpl,
      versionId: lift.version,
      siteId: o.site,
      locationId: o.lobby,
      departmentId: depMep,
      rule: makeRule({ type: 'daily' }),
      localTime: '07:45',
      durationMinutes: 20,
      priority: 'high',
      assignment: {
        strategy: joseph ? 'fixed' : 'unassigned',
        pool: 'employee',
        refId: '',
        employeeIds: joseph ? [joseph] : [],
        siteOnly: false,
      },
    });
}
const run = await step('scheduler run', () =>
  runScheduler(db, C, uid, { mode: 'manual' }),
);
if (run)
  console.log(
    `   tasks created ${run.created}, existing ${run.existing}, unassigned ${run.unassigned}`,
  );

/* ---------------------------------------------------------------- a few realistic issues */
const room = async (key: string, no: string) =>
  (await byCode('locations', `${key}-${no}`)) || '';
await step('complaint: Room 112 AC not cooling', async () =>
  createCase(db, C, uid, 'complaints', {
    ...emptyCase('complaints'),
    title: 'Room 112 – AC not cooling',
    description: 'Tenant reports the room stays above 26°C after noon.',
    priority: 'high',
    category: 'HVAC',
    siteId: out.MUT.site,
    locationId: await room('MUT', '112'),
    sourceType: 'client',
    sourceId: 'BCcmpMUT112',
    reportedBy: 'Tenant – Room 112',
  }),
);
await step('work order: broken chair in Room 205', async () =>
  createCase(db, C, uid, 'workOrders', {
    ...emptyCase('workOrders'),
    title: 'Room 205 – office chair broken (gas lift)',
    priority: 'medium',
    category: 'Furniture',
    siteId: out.TRC.site,
    locationId: await room('TRC', '205'),
    assetId: (await byCode('assets', 'TRC-205-CHR')) || '',
    sourceType: 'staff',
    sourceId: 'BCwoTRC205',
    reportedBy: 'Reception',
  }),
);
await step('work order: lift door sensor', async () =>
  createCase(db, C, uid, 'workOrders', {
    ...emptyCase('workOrders'),
    title: 'Lift – door sensor intermittent',
    priority: 'high',
    category: 'Electrical',
    siteId: out.RAK.site,
    locationId: out.RAK.lobby,
    facilityId: (await byCode('facilities', 'RAK-LIFT-1')) || '',
    sourceType: 'staff',
    sourceId: 'BCwoRAKLIFT',
    reportedBy: 'Security',
  }),
);

/* ---------------------------------------------------------------- staff access for this login */
await step('add the centres to this login’s staff scope', async () => {
  const l = (await listStaffLinks(db, C)).find((x) => x.uid === uid);
  if (!l || l.allSites) return;
  const ids = [
    ...new Set([...l.siteIds, ...centres.map((c) => out[c.key].site)]),
  ].slice(0, 10);
  if (ids.length !== l.siteIds.length)
    await updateStaffScope(db, C, uid, l, { siteIds: ids });
});

const totals = centres
  .map(
    (c) =>
      `${c.name}: ${out[c.key].floors.length} floors, ${out[c.key].rooms} rooms`,
  )
  .join('; ');
console.log(`\n${totals}`);
console.log(
  `Done: ${ok} steps ok (${created} new records), ${failed.length} failed.`,
);
for (const f of failed) console.log('  ✗', f);
process.exit(failed.length ? 1 : 0);
