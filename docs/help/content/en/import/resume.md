---
id: import.resume
title: Repeat imports, resuming an interrupted import and undoing an import
module: Bulk Import
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Data & Imports
description: Why importing the same file twice never creates duplicates, how to finish an import that stopped, and how to undo imported records.
routes: [/import]
permissions:
  - Company owner or admin
screenshots: [admin-import.png]
diagrams: [wf-45]
related: [import.overview, ts.import-failed, ts.duplicate-code]
sources:
  - apps/admin-web/src/management/importStore.ts
  - apps/admin-web/src/management/ImportCenter.tsx
keywords: [resume, partial, stopped, interrupted, rollback, undo, repeat, already imported, idempotent]
---

## The same file twice

Every import is identified by the module and a fingerprint (SHA-256) of the file. When you upload a
file that was already imported you see *This exact file was already imported on …*. Validating it
again shows the rows as *Match found* — nothing new is created. Even if two people import the same
codes at the same moment, a code can only be claimed once, so duplicates are impossible.

## An import that stopped

If you pressed **Stop**, closed the browser or lost the connection, the import is saved as
*Partial* in **Import history**, with each finished row recorded.

1. Upload **the same file** again. The message *An earlier import of this file did not finish* appears.
2. **Validate (dry run)**.
3. **Import** — rows that were already created are skipped; the rest are imported.

Rows that failed (for example because a plan limit was reached) are listed with their reason. Fix
the cause and run the file again.

## Undoing an import

Imported records are normal records — there is no separate "import copy". To undo:

- **Master records** (sites, employees, assets…): archive them from their list.
- **Opening stock**: post a reversal of the opening transaction.

> **Warning:** One-click rollback is deliberately not offered. Within minutes imported records can
> be used by tasks, schedules, stock transactions or assignments; deleting them automatically could
> damage that work. Archiving keeps the history intact.
