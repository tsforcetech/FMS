import assert from 'node:assert/strict';
import { planSiteMigration } from './site-migration-plan.mjs';
const s = { schemaVersion: 1, clientId: 'c', contractId: 'ct', name: 'Site' };
const c = {
  status: 'active',
  clientId: 'c',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
};
assert.equal(planSiteMigration('s', s, c, {}).action, 'REVIEW_REQUIRED');
assert.equal(planSiteMigration('s', s, null, {}).issues.length, 1);
assert.equal(
  planSiteMigration('s', s, { ...c, clientId: 'wrong' }, {}).issues.length,
  1,
);
assert.equal(
  planSiteMigration(
    's',
    s,
    { ...c, endDate: '2026-02-31' },
    {},
    { action: 'draft_allocation', allocationType: 'service_coverage' },
  ).issues.length,
  1,
);
assert.equal(
  planSiteMigration(
    's',
    s,
    c,
    {},
    { action: 'draft_allocation', allocationType: 'exclusive_occupancy' },
  ).issues.length,
  1,
);
assert.equal(
  planSiteMigration('s', s, c, {}, { action: 'detach_only' }).issues.length,
  1,
);
assert.equal(
  planSiteMigration(
    's',
    { ...s, contractId: '' },
    null,
    {},
    { action: 'detach_only' },
  ).action,
  'DETACH_ONLY',
);
console.log('Migration planner: 7 cases passed');
