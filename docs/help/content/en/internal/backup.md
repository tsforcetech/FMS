---
id: ops.backup
title: 'Operator runbook: back up and restore company data'
module: Sharaco Platform Administration
category: technical-support
audience: internal
apps: [platform, admin]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: Platform Operations
description: Take a manual JSON export of one company, store it safely, and follow the reviewed selective-restore procedure.
routes: []
screenshots: [admin-backup.png]
prerequisites:
  - Operator Application Default Credentials for the project
  - Node.js and repository dependencies (npm ci)
  - An encrypted location for backup files
permissions:
  - Sharaco operator with project credentials
related: [setup.backup, ops.release, platform.audit]
sources:
  - scripts/backup-export.ts
  - docs/backup-recovery.md
keywords: [backup, restore, export, JSON, manifest, SHA-256, Spark, PITR, disaster recovery, backup-export]
---

**There is no automatic backup today.** The live project runs on the Firebase Spark plan, which has
no scheduled managed backups, no point-in-time recovery and no `gcloud firestore export`. Enabling
them requires the paid Blaze plan — a separate approval. The protection available now is a manual,
read-only JSON export per company, plus rules, indexes and code in Git.

## Take a backup

1. Sign in: `gcloud auth application-default login`.
2. Run the export (it only reads; it never writes to Firestore):

   ```bash
   npx tsx scripts/backup-export.ts --project facilityos-43386 --confirm-project facilityos-43386 --company <company-id> --out <private-backup-folder>
   ```

3. The script reads every company collection in pages of 500 and writes
   `<company>-<timestamp>.json` (timestamps as `{"$ts": ISO}`, geo points as `{"$geo": [lat, lng]}`)
   and a `.manifest.json` with per-collection counts and the SHA-256 of the data file. Files are
   created owner-readable only.
4. Move the files to encrypted storage. They contain personal data (employees, attendance, GPS,
   customer requests): **never** put them in Git, chat or tickets. Delete them according to the
   retention policy.

Recommended cadence while on Spark: before every release or rules deploy, and weekly.

> **Note:** Firebase Auth accounts are not in the export. An operator can list them separately if
> needed; passwords are never exported in plain text.

![Backup & recovery status page in the admin app](screens/admin-backup.png)

## Restore (reviewed, selective)

A restore tool is deliberately not automated — restoring live data is high-risk.

1. **Stop writes:** announce maintenance; if needed deploy a reviewed temporary rules change for the
   affected company.
2. **Identify scope:** which records and when. Use **Administration → Audit history** and the event
   streams (task events, case events, stock movements, asset transfers).
3. **Choose the export** taken before the damage and check its manifest hash.
4. **Restore selectively** with a reviewed Admin SDK script — only the affected documents, converting
   `$ts`/`$geo` back. Never overwrite a whole company. Recompute stock balances from stock movements
   rather than restoring balances alone.
5. **Verify:** counts against the manifest, the inventory reconciliation report and spot checks in the
   admin app.
6. **Record** the incident and restore in the release log.

## Rules, indexes and apps

Rules and indexes are versioned in `firebase/` and can be redeployed from any commit; the web apps are
rebuilt from `main` by the Pages workflow (see [Release runbook](article:ops.release)).
