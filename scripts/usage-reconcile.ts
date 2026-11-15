// Trusted usage reconciliation (Phase 8). Counts the ACTIVE quota-limited
// records of each company with the Admin SDK and writes them to
// companies/{c}/usage/counters. Creating records bumps the counters
// atomically in the apps (security-rule enforced); archiving is reflected
// here. Dry run unless --apply. Run before assigning a plan to an existing
// company, and regularly afterwards (pending automation: needs a trusted
// scheduled backend, which Spark does not provide).
//
//   npx tsx scripts/usage-reconcile.ts --project facilityos-43386 --confirm-project facilityos-43386 [--company gbh] [--apply]
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { parseArgs } from 'node:util';

const kinds = [
  'sites',
  'employees',
  'assets',
  'recurringSchedules',
  'staffLinks',
] as const;
const inactive = ['archived', 'revoked', 'resigned', 'terminated'];
const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    'confirm-project': { type: 'string' },
    company: { type: 'string' },
    apply: { type: 'boolean', default: false },
  },
});
const { project, company, apply } = values;
if (!project || project !== values['confirm-project'])
  throw new Error(
    'Required: --project ID --confirm-project ID [--company ID] [--apply]',
  );
const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (project.startsWith('demo-') !== emulator)
  throw new Error(
    'demo-* projects only with the emulators, real projects only without them.',
  );
initializeApp(
  emulator
    ? { projectId: project }
    : { credential: applicationDefault(), projectId: project },
);
const db = getFirestore();
const ids = company
  ? [company]
  : (await db.collection('companies').select().get()).docs.map((d) => d.id);
const report: Record<string, Record<string, number>> = {};
for (const c of ids) {
  const counts: Record<string, number> = {};
  for (const k of kinds) {
    const total = (
      await db.collection(`companies/${c}/${k}`).count().get()
    ).data().count;
    let off = 0;
    for (const s of inactive)
      off += (
        await db
          .collection(`companies/${c}/${k}`)
          .where('status', '==', s)
          .count()
          .get()
      ).data().count;
    counts[k] = total - off;
  }
  report[c] = counts;
  if (apply) {
    const ref = db.doc(`companies/${c}/usage/counters`);
    await db.runTransaction(async (tx) => {
      const s = await tx.get(ref);
      tx.set(ref, {
        ...counts,
        last: '',
        revision: (s.data()?.revision || 0) + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }
}
console.log(JSON.stringify({ applied: apply, report }, null, 2));
