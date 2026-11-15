---
id: ops.subscription-sweep
title: 'Operator runbook: run the subscription sweep'
module: Sharaco Platform Administration
category: technical-support
audience: internal
apps: [platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: Platform Operations
description: Recompute every subscription status from its dates and apply read-only access to lapsed companies.
routes: []
screenshots: [platform-subscriptions.png]
prerequisites:
  - Operator Application Default Credentials for the project
  - Node.js and repository dependencies (npm ci)
permissions:
  - Sharaco operator with project credentials
diagrams: [wf-05, wf-07]
related:
  [platform.subscriptions, saas.read-only, ops.usage-reconcile, platform.audit]
sources:
  - scripts/subscription-sweep.ts
  - packages/shared/src/saas.ts
keywords:
  [
    sweep,
    expiry,
    grace,
    past due,
    expired,
    read only,
    subscription-sweep,
    lapsed,
  ]
---

Subscription statuses depend on dates (trial end, renewal due 14 days before period end, grace,
past due, expired). The console computes them for display, but the **company snapshot** that the
security rules read is only updated by an administrative action or by this sweep.
`scripts/subscription-sweep.ts` recomputes every subscription, updates each company's plan snapshot,
and sets the company to `read_only` when the status is _Suspended_, _Cancelled_ or _Expired_ (or back
to `active` otherwise). **Data is never deleted.** It is a dry run unless `--apply` is given.

> **Note:** Automatic runs need a trusted scheduled backend — **pending approval**. Until then lapsed
> subscriptions only become read-only when an operator runs the sweep.

{{diagram wf-05}}

## Steps

1. Sign in: `gcloud auth application-default login`.
2. Dry run:

   ```bash
   npx tsx scripts/subscription-sweep.ts --project facilityos-43386 --confirm-project facilityos-43386
   ```

3. Review the `changes` list: each entry shows the company and `from`/`to` (plan status / company
   status). Confirm that companies about to become read-only really have lapsed and have no payment
   waiting to be recorded.
4. Apply:

   ```bash
   npx tsx scripts/subscription-sweep.ts --project facilityos-43386 --confirm-project facilityos-43386 --apply
   ```

5. Each change writes _subscription.sweep_ to the platform audit log (By: _trusted-operator_). Inform
   affected companies through the normal account channel (no automatic email).

{{diagram wf-07}}

![Subscriptions list with computed statuses](screens/platform-subscriptions.png)

## Notes

- Companies whose company status is an operator lockout (_suspended_ or _archived_ on the company
  record itself) are skipped.
- Recommended cadence while manual: daily on working days.
- To restore a company after payment, record the invoice and **Renew** or **Reactivate** in the console
  — do not edit Firestore by hand.
