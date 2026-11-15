---
id: train.import
title: 'Quick start: import a list from Excel'
module: Training & Quick Starts
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Use the Import Center template to bring in sites, employees, assets or other master data safely.
routes: [/import]
permissions:
  - Company owner or admin; the plan must include Bulk import and the subscription must not be read-only
screenshots: [phase8-03-import-preview.png, admin-import.png]
diagrams: [wf-45]
related: [import.overview, import.templates, import.resume, ts.import-failed]
sources:
  - apps/admin-web/src/management/ImportCenter.tsx
  - packages/shared/src/importing.ts
keywords: [bulk upload, excel import, csv import, template, dry run]
---

1. Open **Administration → Import data** and pick the **Module** (for example _Employees_).
2. Download the **Excel template**.
3. Fill it in from row 2 (replace the hint row). Paste values only — no formulas.
4. Upload the file (.xlsx or .csv, up to 5 MB and 2,000 rows).
5. Check the column mapping.
6. Select **Validate (dry run)** — nothing is saved yet.
7. Review the counts (_New_, _Invalid_, _Duplicate in file_…) and download the error report if needed.
8. Select **Import N rows** and wait for the result banner.

![Validation preview](screens/phase8-03-import-preview.png)

Full guide: [Import data](article:import.overview).

![The Administration → Import data screen](screens/admin-import.png)
