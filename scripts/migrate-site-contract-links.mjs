// Explicit trusted offline workflow. Default is read-only dry-run. No browser or CI caller.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, FieldPath } from 'firebase-admin/firestore';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { planSiteMigration, fingerprint } from './site-migration-plan.mjs';
const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    company: { type: 'string' },
    decisions: { type: 'string' },
    report: { type: 'string' },
    apply: { type: 'boolean', default: false },
    'approved-report': { type: 'string' },
    'confirm-project': { type: 'string' },
  },
});
const { project, company } = values;
if (
  !project ||
  !company ||
  !values.report ||
  !/^[a-zA-Z0-9_-]{1,128}$/.test(company)
)
  throw Error('Provide explicit --project, --company and --report');
if (
  values.apply &&
  (!values['approved-report'] || values['confirm-project'] !== project)
)
  throw Error(
    'Apply requires an approved dry-run report and matching project confirmation',
  );
if (project.startsWith('demo-') !== !!process.env.FIRESTORE_EMULATOR_HOST)
  throw Error('Project and emulator mode do not match');
initializeApp({
  projectId: project,
  ...(process.env.FIRESTORE_EMULATOR_HOST
    ? {}
    : { credential: applicationDefault() }),
});
const db = getFirestore(),
  root = db.doc('companies/' + company);
if (!(await root.get()).exists) throw Error('Company missing');
const decisions = values.decisions
  ? JSON.parse(await readFile(values.decisions, 'utf8'))
  : {};
const approved = values.apply
  ? JSON.parse(await readFile(values['approved-report'], 'utf8'))
  : null;
if (
  approved &&
  (approved.project !== project ||
    approved.company !== company ||
    approved.mode !== 'DRY_RUN')
)
  throw Error('Approved report has a different scope or mode');
const report = {
  project,
  company,
  mode: values.apply ? 'APPLY' : 'DRY_RUN',
  generatedAt: new Date().toISOString(),
  rows: [],
  writes: 0,
};
let cursor;
for (;;) {
  let query = root
    .collection('sites')
    .orderBy(FieldPath.documentId())
    .limit(50);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  if (page.empty) break;
  for (const doc of page.docs) {
    const site = doc.data();
    const [contract, client] = await Promise.all([
      site.contractId
        ? root.collection('contracts').doc(site.contractId).get()
        : null,
      site.clientId
        ? root.collection('clients').doc(site.clientId).get()
        : null,
    ]);
    const row = planSiteMigration(
      doc.id,
      site,
      contract?.data(),
      client?.data(),
      decisions[doc.id],
    );
    if (row.action === 'DRAFT_ALLOCATION' && row.allocation.locationId) {
      const loc = await root
        .collection('locations')
        .doc(row.allocation.locationId)
        .get();
      if (
        !loc.exists ||
        loc.data().siteId !== doc.id ||
        loc.data().status === 'archived'
      )
        row.issues.push('Invalid location/site relationship');
    }
    if (
      values.apply &&
      ['DETACH_ONLY', 'DRAFT_ALLOCATION'].includes(row.action) &&
      !row.issues.length
    ) {
      const signed = approved.rows.find((r) => r.siteId === doc.id);
      if (!signed || fingerprint(signed) !== fingerprint(row))
        throw Error('Dry-run plan changed: ' + doc.id);
      await db.runTransaction(async (tx) => {
        const backup = root.collection('siteMigrations').doc(doc.id),
          current = await tx.get(doc.ref),
          saved = await tx.get(backup);
        if (saved.exists) {
          if (current.data().schemaVersion === 2) return;
          throw Error('Migration backup exists with inconsistent site state');
        }
        if (fingerprint(current.data()) !== row.sourceHash)
          throw Error('Site changed since dry-run');
        const deltas = new Map();
        const add = (path, n) => deltas.set(path, (deltas.get(path) || 0) + n);
        if (site.status !== 'archived') {
          if (site.clientId) add('clients/' + site.clientId, -1);
          if (site.contractId) add('contracts/' + site.contractId, -1);
        }
        if (row.action === 'DRAFT_ALLOCATION') {
          if (site.status === 'archived')
            throw Error('Archived site requires manual review');
          const a = row.allocation;
          add('contracts/' + a.contractId, 1);
          add(
            a.locationId ? 'locations/' + a.locationId : 'sites/' + doc.id,
            1,
          );
        }
        const parents = new Map();
        for (const [path] of deltas)
          parents.set(
            path,
            await tx.get(
              root.collection(path.split('/')[0]).doc(path.split('/')[1]),
            ),
          );
        let allocation, claim;
        if (row.allocation) {
          allocation = root
            .collection('contractAllocations')
            .doc(row.allocationId);
          claim = root
            .collection('codeClaims')
            .doc('contractAllocations_' + row.allocation.code);
          const existing = await tx.get(allocation),
            existingClaim = await tx.get(claim);
          if (existing.exists || existingClaim.exists)
            throw Error(
              'Allocation or code already exists without a matching migration checkpoint',
            );
          const liveContract = await tx.get(
            root.collection('contracts').doc(row.allocation.contractId),
          );
          if (fingerprint(liveContract.data()) !== fingerprint(contract.data()))
            throw Error('Contract changed since dry-run');
        }
        for (const [path, delta] of deltas) {
          const p = parents.get(path);
          if (
            !p.exists ||
            !Number.isSafeInteger(p.data().refCount) ||
            p.data().refCount + delta < 0
          )
            throw Error('Invalid reference count: ' + path);
        }
        const now = FieldValue.serverTimestamp(),
          actor = 'trusted-site-migration';
        tx.create(backup, {
          companyId: company,
          sourceHash: row.sourceHash,
          plan: row,
          originalSite: current.data(),
          migratedAt: now,
          actor,
        });
        for (const [path, delta] of deltas)
          if (delta && path !== 'sites/' + doc.id)
            tx.update(parents.get(path).ref, {
              refCount: parents.get(path).data().refCount + delta,
              updatedAt: now,
              updatedBy: actor,
            });
        const updated = {
          ...current.data(),
          schemaVersion: 2,
          revision: current.data().revision + 1,
          refCount:
            current.data().refCount + (deltas.get('sites/' + doc.id) || 0),
          updatedAt: now,
          updatedBy: actor,
        };
        delete updated.clientId;
        delete updated.contractId;
        tx.set(doc.ref, updated);
        if (row.allocation) {
          const data = {
            ...row.allocation,
            companyId: company,
            schemaVersion: 1,
            createdAt: now,
            createdBy: actor,
            updatedAt: now,
            updatedBy: actor,
            revision: 1,
            refCount: 0,
            witnessKind: '',
            witnessId: '',
          };
          tx.create(allocation, data);
          tx.create(claim, {
            companyId: company,
            kind: 'contractAllocations',
            recordId: row.allocationId,
            code: data.code,
          });
          tx.create(allocation.collection('history').doc('1'), {
            companyId: company,
            revision: 1,
            actorUid: actor,
            occurredAt: now,
            snapshot: row.allocation,
          });
        }
      });
      report.writes++;
    }
    report.rows.push(row);
  }
  cursor = page.docs.at(-1);
}
await writeFile(values.report, JSON.stringify(report, null, 2) + '\n', {
  mode: 0o600,
});
console.log(
  JSON.stringify({
    mode: report.mode,
    sites: report.rows.length,
    migratedSites: report.writes,
    reviewRequired: report.rows.filter(
      (r) => r.action === 'REVIEW_REQUIRED' || r.issues.length,
    ).length,
  }),
);
