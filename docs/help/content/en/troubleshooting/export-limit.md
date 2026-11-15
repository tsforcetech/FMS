---
id: ts.export-limit
title: Export too large
module: Troubleshooting
category: technical-support
audience: public
apps: [admin, customer]
roles: [owner, admin, site_manager, supervisor, viewer, customer]
version: '0.8'
reviewed: '2026-11-15'
owner: Support
description: An Excel, CSV or PDF export is refused because it has too many rows, or exports are not in your plan.
routes: []
screenshots: [phase8-04-export-dialog.png]
diagrams: [wf-44]
related: [exports.overview, exports.limits, customer.history, ts.read-only]
sources:
  - apps/admin-web/src/management/exportStore.ts
  - apps/admin-web/src/management/planGate.ts
keywords: ["export", "too many rows", "readable PDF", "limit 10,000", "in-browser limit of 100,000", "Narrow the filters", "not included in your plan"]
---

## Symptom

- *12,500 rows are too many for a readable PDF (limit 10,000). Use Excel, or narrow the filters.*
- *120,000 rows exceed the in-browser limit of 100,000. Narrow the filters and export in parts.*
- *Excel/PDF export is not included in your plan (…). Contact Sharaco to upgrade.*

![The export dialog](screens/phase8-04-export-dialog.png)

## Likely cause

Exports are built in your browser. PDF is limited to 10,000 rows; Excel and CSV to 100,000 rows.
Some plans do not include exports.

## How to check

Look at the row count in the export dialog and the filters on the list.

## Resolution

- PDF too large: choose **Excel**, or filter (date range, site, status).
- Over 100,000 rows: export in parts, for example one month or one site at a time.
- Not in plan: the owner checks **Administration → Plan & usage** and contacts Sharaco.

{{diagram wf-44}}

## Who can fix it

The **user** (filters, format); **owner** (plan).

## Related

[Export limits](article:exports.limits)
