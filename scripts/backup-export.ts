// Manual JSON backup of one company (Phase 7). Run by the platform operator
// with Application Default Credentials (`gcloud auth application-default
// login`); never shipped to browsers and needs no paid Firebase services.
//
//   npx tsx scripts/backup-export.ts --project facilityos-43386 \
//     --confirm-project facilityos-43386 --company gbh --out ~/fos-backups
//
// Reads every company collection in pages of 500 ordered by document ID and
// writes one JSON file (timestamps as ISO strings, references as paths) plus a
// manifest with per-collection counts and a SHA-256 of the data file. It only
// reads: it never writes to Firestore. Keep the output private — it contains
// personal data (employees, attendance, customer requests).
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import {
  getFirestore,
  FieldPath,
  Timestamp,
  GeoPoint,
  DocumentReference,
} from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const collections = [
  'members',
  'auditLogs',
  'codeClaims',
  'sites',
  'locations',
  'facilities',
  'facilityTypes',
  'clients',
  'contracts',
  'contractAllocations',
  'occupancyCalendars',
  'employees',
  'departments',
  'designations',
  'teams',
  'teamMembers',
  'shifts',
  'shiftAssignments',
  'siteAssignments',
  'leaveRecords',
  'holidays',
  'assets',
  'assetCategories',
  'assetTransfers',
  'materials',
  'materialCategories',
  'suppliers',
  'stores',
  'stockBalances',
  'stockMovements',
  'taskCategories',
  'taskTemplates',
  'templateVersions',
  'tasks',
  'taskEvents',
  'taskSubmissions',
  'taskApprovals',
  'taskExceptions',
  'taskEvidence',
  'recurringSchedules',
  'schedulerRuns',
  'slaPolicies',
  'workOrders',
  'complaints',
  'escalations',
  'caseEvents',
  'notifications',
  'notificationPreferences',
  'staffLinks',
  'employeeLinks',
  'attendance',
  'customerLinks',
  'serviceRequests',
  'maintenanceCosts',
  'complianceRecords',
  'settings',
];

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    'confirm-project': { type: 'string' },
    company: { type: 'string' },
    out: { type: 'string', default: './backups' },
  },
});
const { project, company, out } = values;
if (!project || project !== values['confirm-project'] || !company)
  throw new Error(
    'Required: --project ID --confirm-project ID --company ID [--out DIR]',
  );
if (!/^[a-zA-Z0-9_-]{1,128}$/.test(company)) throw new Error('Invalid company');

initializeApp({ credential: applicationDefault(), projectId: project });
const db = getFirestore();

function plain(v: unknown): unknown {
  if (v instanceof Timestamp) return { $ts: v.toDate().toISOString() };
  if (v instanceof GeoPoint) return { $geo: [v.latitude, v.longitude] };
  if (v instanceof DocumentReference) return { $ref: v.path };
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [
        k,
        plain(x),
      ]),
    );
  return v;
}

const root = db.doc(`companies/${company}`);
const companySnap = await root.get();
if (!companySnap.exists) throw new Error('Company not found.');
const data: Record<string, Record<string, unknown>> = {
  company: { [company]: plain(companySnap.data()) as Record<string, unknown> },
};
const counts: Record<string, number> = {};
for (const name of collections) {
  const rows: Record<string, unknown> = {};
  let last: string | undefined;
  for (;;) {
    let q = root.collection(name).orderBy(FieldPath.documentId()).limit(500);
    if (last) q = q.startAfter(last);
    const page = await q.get();
    for (const d of page.docs) rows[d.id] = plain(d.data());
    if (page.size < 500) break;
    last = page.docs[page.size - 1].id;
  }
  counts[name] = Object.keys(rows).length;
  if (counts[name]) data[name] = rows;
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.resolve(out!);
await mkdir(dir, { recursive: true, mode: 0o700 });
const body = JSON.stringify({
  project,
  company,
  exportedAt: new Date().toISOString(),
  data,
});
const file = path.join(dir, `${company}-${stamp}.json`);
await writeFile(file, body, { mode: 0o600 });
const manifest = {
  project,
  company,
  file: path.basename(file),
  sha256: createHash('sha256').update(body).digest('hex'),
  counts,
  note: 'Read-only export. Restoring is a reviewed operator procedure: see docs/backup-recovery.md.',
};
await writeFile(
  file.replace(/\.json$/, '.manifest.json'),
  JSON.stringify(manifest, null, 2),
  { mode: 0o600 },
);
console.log(
  JSON.stringify({
    file,
    total: Object.values(counts).reduce((s, x) => s + x, 0),
    counts,
  }),
);
