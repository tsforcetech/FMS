// Emulator test for the Blaze scheduled function: provisions the scheduler
// service account in the demo company, runs the deployed handler code
// (functions/lib/index.js) once, and checks that a SERVER run was recorded
// through the security rules and that a second run creates nothing new.
// Run after scripts/phase1-browser-test.mjs inside emulators:exec (it needs
// the demo company's active recurring schedule).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw Error('emulators only');
process.env.GCLOUD_PROJECT = 'demo-facilityos';
const C = 'local-company-a';
execFileSync(
  process.execPath,
  [
    'scripts/provision-scheduler.mjs',
    '--project',
    'demo-facilityos',
    '--confirm-project',
    'demo-facilityos',
    '--company',
    C,
  ],
  { stdio: 'inherit' },
);
const require = createRequire(import.meta.url);
const { scheduledTaskGenerator } = require('../functions/lib/index.js');
const db = getFirestore(
  initializeApp({ projectId: 'demo-facilityos' }, 'test'),
);
const runs = async () =>
  (
    await db
      .collection(`companies/${C}/schedulerRuns`)
      .where('mode', '==', 'server')
      .get()
  ).docs.map((d) => d.data());
await scheduledTaskGenerator.run({
  scheduleTime: new Date().toISOString(),
  jobName: 'test',
});
const first = await runs();
assert.equal(first.length, 1, 'one server run recorded');
assert.equal(first[0].status, 'ok', JSON.stringify(first[0].errors));
assert.equal(first[0].actorUid, 'facilityos-scheduler');
await scheduledTaskGenerator.run({
  scheduleTime: new Date().toISOString(),
  jobName: 'test',
});
const both = await runs();
assert.equal(both.length, 2, 'two server runs');
assert.ok(
  both.some(
    (r) =>
      r.status === 'ok' && r.created === 0 && r.existing >= first[0].created,
  ),
  'second run creates nothing new',
);
// Revoked: the function skips the company.
execFileSync(
  process.execPath,
  [
    'scripts/provision-scheduler.mjs',
    '--project',
    'demo-facilityos',
    '--confirm-project',
    'demo-facilityos',
    '--company',
    C,
    '--revoke',
  ],
  { stdio: 'inherit' },
);
await scheduledTaskGenerator.run({
  scheduleTime: new Date().toISOString(),
  jobName: 'test',
});
assert.equal((await runs()).length, 2, 'revoked: no further run');
console.log(
  JSON.stringify({
    passed: 4,
    first: {
      created: first[0].created,
      existing: first[0].existing,
      scheduleCount: first[0].scheduleCount,
    },
  }),
);
process.exit(0);
