// Trusted subscription sweep (Phase 8). Recomputes every subscription's
// status from its dates (trial → past due → expired, renewal due → grace →
// past due → expired) and updates the company's entitlement snapshot and
// read-only state. Data is never deleted. Dry run unless --apply. Pending
// automation: needs a trusted scheduled backend; run manually until then.
//
//   npx tsx scripts/subscription-sweep.ts --project facilityos-43386 --confirm-project facilityos-43386 [--apply]
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { parseArgs } from 'node:util';
import { planSnapshot, type Subscription } from '../packages/shared/src/saas';

const { values } = parseArgs({
  options: {
    project: { type: 'string' },
    'confirm-project': { type: 'string' },
    apply: { type: 'boolean', default: false },
  },
});
const { project, apply } = values;
if (!project || project !== values['confirm-project'])
  throw new Error('Required: --project ID --confirm-project ID [--apply]');
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
const d = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);
const changes: { company: string; from: string; to: string }[] = [];
for (const s of (await db.collection('platformSubs').get()).docs) {
  const x = s.data();
  const sub = {
    ...x,
    trialEndsAt: d(x.trialEndsAt),
    periodStart: d(x.periodStart),
    periodEnd: d(x.periodEnd),
  } as unknown as Subscription;
  const snap = planSnapshot(sub);
  const coRef = db.doc(`companies/${s.id}`);
  const co = await coRef.get();
  if (
    !co.exists ||
    co.data()!.status === 'suspended' ||
    co.data()!.status === 'archived'
  )
    continue; // operator lockouts are not touched
  const want = snap.access === 'read_only' ? 'read_only' : 'active';
  const was = co.data()!.plan?.status;
  if (was === snap.status && co.data()!.status === want) continue;
  changes.push({
    company: s.id,
    from: `${was}/${co.data()!.status}`,
    to: `${snap.status}/${want}`,
  });
  if (apply) {
    const ev = db.collection('platformEvents').doc();
    const b = db.batch();
    b.set(ev, {
      type: 'subscription.sweep',
      subject: s.id,
      actorUid: 'trusted-operator',
      at: FieldValue.serverTimestamp(),
      detail: `Status ${was} → ${snap.status} (${want})`,
    });
    b.update(coRef, {
      plan: snap,
      status: want,
      eventId: ev.id,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: 'trusted-operator',
    });
    await b.commit();
  }
}
console.log(JSON.stringify({ applied: apply, changes }, null, 2));
