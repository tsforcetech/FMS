---
id: exports.limits
title: Export limits, security and the export log
module: Excel & PDF Exports
category: reports
audience: public
apps: [admin, customer]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Reporting
description: How large an export can be, which columns are removed for privacy, how formulas are neutralised and how exports are logged.
routes: [/audit]
permissions:
  - Company owner or admin
screenshots: [phase8-04-export-dialog.png, admin-audit.png]
diagrams: [wf-44]
related: [exports.overview, ts.export-limit, setup.audit]
sources:
  - apps/admin-web/src/management/exportStore.ts
  - packages/shared/src/exporting.ts
  - firebase/firestore.rules
keywords:
  [
    limit,
    100000,
    10000,
    truncated,
    formula injection,
    sensitive,
    export log,
    audit,
  ]
---

Exports run in your browser. They read the same records you can open on screen, with the same
permissions — exporting never gives access to anything new.

![The Administration → Audit history screen](screens/admin-audit.png)

## Limits

| Format        | Maximum rows per export |
| ------------- | ----------------------- |
| Excel (.xlsx) | 100,000                 |
| CSV           | 100,000                 |
| PDF           | 10,000                  |

_All matching records_ reads the data in pages of 500 until every matching record is collected.
FacilityOS never silently cuts an export short: if the rows exceed the limit for the format, the
export stops with a message telling you how many rows matched. Interactive reports on screen read
up to 3,000 rows and say so when a period is larger; their **Export** reads the whole period.

> **Tip:** For very large periods export month by month, or use Excel instead of PDF.

The stock reconciliation export needs the complete movement history. If the ledger is larger than
an in-browser export can read, the export stops with a message — contact Sharaco for a server export.

## Privacy and security

- **Company scope** — only your company's records, and only those your role can read.
- **Sensitive columns** — personal contact fields (email, phone, contact person, login IDs) are
  marked sensitive and are only offered to company owners and admins.
- **Internal columns** — for example the linked complaint of a customer request — are never
  included in customer-portal exports.
- **Formula protection** — text beginning with `=`, `+`, `-`, `@`, tab or carriage return is
  prefixed with an apostrophe so spreadsheet programs treat it as text.
- **GPS coordinates** are never included in attendance exports.

## The export log

Each export first writes an entry to the company's export log with: report name, format, scope
(on screen or all), number of rows, the filters as text, the user and the time. Entries cannot be
changed or deleted from the apps, staff cannot write them, and other companies cannot read them.
The exported rows themselves are not stored anywhere.

## Common errors

| Message                          | Why                                                         | What to do                                       |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| Row limit message                | More rows than the format allows                            | Narrow the filters or use Excel                  |
| _Access is no longer available…_ | Your access changed, or the export log could not be written | Sign in again; ask your owner to check your role |
