---
id: ops.usage-reconcile
title: 'Operator runbook: reconcile usage counters'
module: Sharaco Platform Administration
category: technical-support
audience: internal
apps: [platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: Platform Operations
description: Recount each company's active sites, employees, assets, recurring schedules and staff logins and write the plan usage counters.
routes: []
screenshots: [phase8-08-platform-company.png]
prerequisites:
  - Operator Application Default Credentials for the project
  - Node.js and repository dependencies (npm ci)
permissions:
  - Sharaco operator with project credentials
related:
  [
    platform.subscriptions,
    saas.plan-usage,
    ops.subscription-sweep,
    platform.audit,
  ]
sources:
  - scripts/usage-reconcile.ts
  - apps/admin-web/src/management/usage.ts
  - packages/shared/src/saas.ts
keywords:
  [
    usage counters,
    quota,
    reconcile,
    archived,
    plan limits,
    usage-reconcile,
    no usage counters,
  ]
---

Creating a quota-limited record in the apps bumps `companies/{company}/usage/counters` in the same
transaction, and the security rules check the plan limit there. Archiving does **not** lower the
counter. `scripts/usage-reconcile.ts` recounts **active** records (excluding statuses _archived_,
_revoked_, _resigned_ and _terminated_) for sites, employees, assets, recurring schedules and staff
links, and writes the counters. It is a **dry run unless `--apply`** is given.

> **Note:** Automatic reconciliation needs a trusted scheduled backend, which the Spark plan does not
> provide — **pending approval**. Until then an operator runs it by hand.

## When to run

- **Before assigning a plan to an existing company** that has no counters (the console refuses with
  _This company has no usage counters yet…_).
- After a company archives many records and asks for the count to be corrected.
- Regularly (for example weekly) for all companies.

## Steps

1. Sign in with your operator account:

   ```bash
   gcloud auth application-default login
   ```

2. Dry run for one company (or omit `--company` for all):

   ```bash
   npx tsx scripts/usage-reconcile.ts --project facilityos-43386 --confirm-project facilityos-43386 --company <company-id>
   ```

3. Review the JSON report (`applied: false`) — counts per company and kind. Compare with what the
   company expects.
4. Apply:

   ```bash
   npx tsx scripts/usage-reconcile.ts --project facilityos-43386 --confirm-project facilityos-43386 --company <company-id> --apply
   ```

5. Check the company page in the platform console: **Usage** now shows the counts. Assign the plan if
   that was the reason for running it.

![Company page with the Usage box after reconciliation](screens/phase8-08-platform-company.png)

## Notes

- The counter document is replaced with the counts and its revision increases; this is safe to
  repeat.
- If a company is currently over a new plan's limit, nothing is deleted; it just cannot add more of
  that kind.
- Against emulators use a `demo-*` project with `FIRESTORE_EMULATOR_HOST` set.
