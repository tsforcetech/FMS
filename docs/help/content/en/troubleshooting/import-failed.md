---
id: ts.import-failed
title: Import failed or rows need attention
module: Troubleshooting
category: technical-support
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Support
description: The Import Center rejects a file or reports rows with errors.
routes: []
screenshots: [phase8-03-import-preview.png]
diagrams: [wf-45]
related: [import.overview, import.templates, import.resume, ts.duplicate-code, ts.read-only]
sources:
  - packages/shared/src/importing.ts
  - apps/admin-web/src/management/ImportCenter.tsx
  - apps/admin-web/src/management/importStore.ts
keywords: ["import error", "The file is larger than 5 MB", "Old .xls files are not supported", "formulas are not accepted — paste values only", "appears earlier in this file", "Missing column", "error report"]
---

## Symptom

**File-level errors** (nothing imported):

- *The file is larger than 5 MB. Split it into smaller files.*
- *The file has 2,500 rows. Import at most 2,000 rows per file.*
- *Upload an Excel (.xlsx) or CSV (.csv) file. Old .xls files are not supported.*
- *This is not a valid Excel (.xlsx) file.* / *The Excel file could not be read. Save it again as .xlsx and retry.*
- *The file is empty.* / *The file has a header row but no data rows.*
- *Your subscription is read-only, so data cannot be imported.*

**Row errors** (shown in the preview and the error report):

- *Missing column: …*
- *Code: formulas are not accepted — paste values only*
- *Code X appears earlier in this file*
- *Store code: no store with code “…”*
- *Opening balance already recorded for this store and material*

![Import preview with row errors](screens/phase8-03-import-preview.png)

## Likely cause

The file is not in the template format, has formulas, duplicates, or refers to codes that do not
exist yet (for example locations before their site).

## How to check

Select **Validate (dry run)** — nothing is saved — and read each row's status. Use **Download error
report** for the full list.

## Resolution

1. Start from the **Excel template** or CSV template of the module.
2. Paste values only (no formulas). Save as .xlsx or .csv.
3. Import parent records first (sites before locations, materials before opening stock).
4. Fix the rows and upload the **same file** again. *An earlier import of this file did not finish.
   Validate and import again to resume — finished rows are skipped.*

{{diagram wf-45}}

## Who can fix it

Company **owner** or **admin**.

## Related

[Import overview](article:import.overview) · [Resume an import](article:import.resume)
