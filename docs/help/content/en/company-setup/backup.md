---
id: setup.backup
title: Understand backup and recovery
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Platform Operations
description: What is and is not backed up today, and how to protect your company's data with exports.
routes: [/backup]
permissions:
  - Company owner or admin
screenshots: [admin-backup.png]
related: [setup.retention, setup.audit, exports.overview, faq.general]
sources:
  - apps/admin-web/src/management/Operations.tsx
keywords: [backup, recovery, restore, point-in-time recovery, PITR, export, disaster recovery, Spark plan]
---

**Administration → Backup & recovery** shows honestly how your data is protected. Read it before
you rely on FacilityOS for records you must keep.

> **Warning:** There is **no automatic backup today**. The project runs on the free Firebase
> Spark plan, where managed backups, point-in-time recovery and scheduled exports are not
> available, and none are configured. Accidental deletion or corruption can only be recovered from
> a manual export.

## Before you start

Nothing to prepare — this page is read-only.

## Steps

1. Open **Administration → Backup & recovery**.
2. Read the table (**Protection**, **Status**, **Notes**):

   | Protection | Status |
   | --- | --- |
   | Managed Firestore backups / PITR | *Not configured* — requires the paid Blaze plan; upgrading needs separate approval |
   | Scheduled Firestore export | *Not configured* — requires Blaze |
   | Manual JSON export | *Available, operator-run* — a snapshot of one company taken by the operator |
   | Security rules and indexes | *Versioned in Git* |
   | Application code | *Versioned in Git* — every release can be rebuilt |

3. Protect your own business records as well: export important lists and reports regularly with
   **Export** (Excel or PDF) and keep the files in your company's document store. See
   [Exports](article:exports.overview).
4. Ask Sharaco or your operator when the last manual snapshot was taken before major changes such
   as bulk imports.

![Backup & recovery status](screens/admin-backup.png)

## Expected result

You know that recovery depends on manual snapshots and your own exports, and you have a routine
for exporting key records.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Not configured* | Managed backups need a paid Firebase plan that is not enabled. | Discuss with Sharaco. Paid infrastructure is enabled only with separate approval. |

## Troubleshooting

- **I deleted or archived something by mistake:** most records are archived, not deleted, and can
  be edited back to *Active*. Stock and asset movements are never deleted; correct them with a
  reversal or a new transfer.
- **I need a restore:** contact Sharaco support. Restores are an operator procedure from a manual
  snapshot.
