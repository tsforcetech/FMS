---
id: ops.release
title: 'Operator runbook: release a new version'
module: Sharaco Platform Administration
category: technical-support
audience: internal
apps: [admin, staff, mobile, customer, platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: Platform Operations
description: Checks, approvals and steps to release Firestore rules and the web and Android apps, and what to verify afterwards.
routes: []
screenshots: [platform-health.png]
prerequisites:
  - Written release authorisation from the product owner
  - Maintainer access to the repository and operator access to the Firebase project
permissions:
  - Repository maintainer and Sharaco operator
related: [ops.backup, ops.usage-reconcile, ops.subscription-sweep, ref.whats-new]
sources:
  - package.json
  - .github/workflows/pages.yml
  - .github/workflows/ci.yml
  - .github/workflows/android.yml
  - docs/phase8-report.md
  - docs/backup-recovery.md
keywords: [release, deploy, rules, indexes, GitHub Pages, Android, merge to main, 256 KB, compiled rules size, regression]
---

FacilityOS is released from the `main` branch. Firestore rules and indexes are deployed by an
operator; the web apps (admin `/FMS/`, staff `/FMS/staff/`, customer `/FMS/customer/`, platform
`/FMS/platform/`) are built and published by the **Publish admin test site** workflow on every push
to `main`; the Android debug app is built by the **Android app** workflow.

> **Warning:** Nothing is merged, deployed or published without explicit authorisation. Paid
> services (Blaze plan, Cloud Functions, payment providers, email services) need separate approval.

## 1. Before the release

1. Make sure the feature branch is up to date with `main`.
2. Run the full regression locally against the emulators:

   ```bash
   npm run format:check
   ```

   ```bash
   npm run check
   ```

   ```bash
   npm run test:rules
   ```

   and the browser suites (`npm run test:browser`, `test:staff-browser`, `test:mobile-runtime`,
   `test:phase7-browser`, `test:phase8-browser`) plus `npm run test:migration`. All must pass.
3. If rules changed, **measure the compiled rules size**. The limit is 256 KB and the emulator does not
   check it; the Phase 8 ruleset sits at about 251.7 KB. Also keep in mind the 1,000-expression
   evaluation limit on deep transactions.
4. Take a [manual backup](article:ops.backup) of each active company.

## 2. Release

1. Deploy rules and indexes (only with authorisation):

   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes --project facilityos-43386
   ```

2. Confirm the live ruleset matches `firebase/firestore.rules` and that indexes are READY.
3. Merge to `main` (fast-forward). Watch the **FacilityOS checks**, **Publish admin test site** and
   **Android app** workflows until they succeed.

## 3. After the release

1. Check that `/FMS/`, `/FMS/staff/`, `/FMS/customer/` and `/FMS/platform/` load (HTTP 200) and show the
   new screens.
2. Sign in as a test admin and run a smoke test of the changed areas.
3. Run follow-up operator tasks, for example the [usage reconciliation](article:ops.usage-reconcile)
   before assigning plans, and the [subscription sweep](article:ops.subscription-sweep).
4. Record the release (date, commit, ruleset id, workflow results) and update **What's new** in the
   Help Center ([What's new](article:ref.whats-new)).

![Operational health listing what is still manual or pending](screens/platform-health.png)

## Still pending activation

Automatic task scheduler (workflow exists, secrets not configured), automatic usage reconciliation and
subscription sweep, online payments, email delivery, MFA enforcement for platform staff, and
automatic backups. Do not describe these as live in release notes.
