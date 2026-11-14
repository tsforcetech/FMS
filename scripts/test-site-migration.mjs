// Isolated emulator migration verification. Never run against a live project.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080')
  throw Error('Emulator required');
const project = 'demo-facilityos-migration',
  company = 'fixture';
initializeApp({ projectId: project });
const db = getFirestore(),
  root = db.doc('companies/' + company);
await root.set({ companyId: company, status: 'active' });
const meta = {
  schemaVersion: 1,
  createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  updatedAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  createdBy: 'fixture',
  updatedBy: 'fixture',
  revision: 1,
  refCount: 0,
  witnessKind: '',
  witnessId: '',
  notes: '',
};
await root
  .collection('clients')
  .doc('client')
  .set({
    ...meta,
    companyId: company,
    code: 'C1',
    name: 'Fixture client',
    status: 'active',
    refCount: 3,
  });
await root
  .collection('contracts')
  .doc('contract')
  .set({
    ...meta,
    companyId: company,
    code: 'CT1',
    name: 'Fixture contract',
    status: 'active',
    clientId: 'client',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    refCount: 1,
  });
for (const [id, contractId] of [
  ['site', 'contract'],
  ['unassigned', ''],
])
  await root
    .collection('sites')
    .doc(id)
    .set({
      ...meta,
      companyId: company,
      code: id.toUpperCase(),
      name: 'Fixture ' + id,
      status: 'active',
      clientId: 'client',
      contractId,
      timeZone: 'Asia/Dubai',
      propertyType: 'Office',
      address: 'Original address',
      country: 'AE',
      city: 'Dubai',
      workingDays: 'Mon',
      opensAt: '',
      closesAt: '',
      contactPerson: '',
      phone: '',
      description: '',
    });
const folder = 'docs/evidence/correction';
await mkdir(folder, { recursive: true });
const decisions = '/tmp/site-migration-decisions.json';
await writeFile(
  decisions,
  JSON.stringify({
    site: {
      action: 'draft_allocation',
      allocationType: 'service_coverage',
      locationId: '',
    },
    unassigned: { action: 'detach_only' },
  }),
);
const report = folder + '/migration-dry-run.json';
const args = [
  'scripts/migrate-site-contract-links.mjs',
  '--project',
  project,
  '--company',
  company,
  '--decisions',
  decisions,
  '--report',
  report,
];
const run = promisify(execFile);
await run(process.execPath, args, {
  env: { ...process.env, METADATA_SERVER_DETECTION: 'none' },
});
const dry = JSON.parse(await readFile(report, 'utf8'));
assert.equal(dry.writes, 0);
assert.equal(dry.rows.length, 2);
assert.equal(
  (await root.collection('sites').doc('site').get()).data().schemaVersion,
  1,
);
await run(
  process.execPath,
  [
    ...args.slice(0, -1),
    '/tmp/site-migration-applied.json',
    '--apply',
    '--approved-report',
    report,
    '--confirm-project',
    project,
  ],
  { env: { ...process.env, METADATA_SERVER_DETECTION: 'none' } },
);
assert.equal(
  (await root.collection('sites').doc('site').get()).data().schemaVersion,
  2,
);
assert.equal(
  (await root.collection('sites').doc('site').get()).data().clientId,
  undefined,
);
assert.equal(
  (await root.collection('siteMigrations').doc('site').get()).data()
    .originalSite.clientId,
  'client',
);
assert.equal(
  (await root.collection('sites').doc('site').get()).data().address,
  'Original address',
);
assert.equal(
  (await root.collection('clients').doc('client').get()).data().refCount,
  1,
);
assert.equal(
  (await root.collection('contracts').doc('contract').get()).data().refCount,
  1,
);
assert.equal(
  (await root.collection('sites').doc('site').get()).data().refCount,
  1,
);
assert.equal(
  (await root.collection('contractAllocations').doc('legacy_site').get()).data()
    .status,
  'draft',
);
await run(
  process.execPath,
  [
    ...args.slice(0, -1),
    '/tmp/site-migration-replay.json',
    '--apply',
    '--approved-report',
    report,
    '--confirm-project',
    project,
  ],
  { env: { ...process.env, METADATA_SERVER_DETECTION: 'none' } },
);
assert.equal(
  JSON.parse(await readFile('/tmp/site-migration-replay.json', 'utf8')).writes,
  0,
);
assert.equal((await root.collection('contractAllocations').get()).size, 1);
await writeFile(
  folder + '/migration-results.json',
  JSON.stringify(
    {
      environment: 'isolated demo emulator',
      passed: [
        'dry-run writes nothing',
        'full original site backup',
        'physical fields preserved',
        'legacy references detached',
        'reviewed draft allocation created',
        'reference counters reconciled',
        'replay creates no duplicates',
      ],
      productionWrites: 0,
    },
    null,
    2,
  ) + '\n',
);
console.log('Migration: 7 checks passed. No production writes.');
