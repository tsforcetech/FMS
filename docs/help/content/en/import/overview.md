---
id: import.overview
title: Import data from Excel or CSV (Import Center)
module: Bulk Import
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Data & Imports
description: Load sites, locations, employees, assets, materials and other master data from a spreadsheet, with a full preview before anything is saved.
routes: [/import]
prerequisites:
  - Records that the file refers to by code (for example the site of a location) already exist
  - Your plan includes Bulk import and the subscription is not read-only
permissions:
  - Company owner or admin
screenshots: [phase8-03-import-preview.png, admin-import.png]
diagrams: [wf-45]
related:
  [
    import.templates,
    import.opening-stock,
    import.resume,
    ts.import-failed,
    ts.duplicate-code,
    train.import,
  ]
sources:
  - apps/admin-web/src/management/ImportCenter.tsx
  - apps/admin-web/src/management/importStore.ts
  - packages/shared/src/importing.ts
keywords:
  [
    import,
    upload,
    excel,
    csv,
    spreadsheet,
    bulk,
    migrate,
    dry run,
    validate,
    template,
  ]
---

The **Import Center** (**Administration → Import data**) loads master data from an Excel (.xlsx)
or CSV file. Nothing is saved until you have reviewed a full preview and confirmed.

You can import: **Clients**, **Sites**, **Locations** (buildings, floors, rooms), **Facility
types**, **Facilities**, **Departments**, **Designations**, **Employees**, **Teams**, **Asset
categories**, **Assets** (including furniture and equipment), **Suppliers**, **Material
categories**, **Materials**, **Stores**, **Task categories** and **Opening stock**.

## Steps

1. Open **Administration → Import data**.
2. In **1. Choose what to import**, pick the **Module**.
3. Download the **Excel template** (or **CSV**). The first row holds the column names; the second
   row explains each column (required columns are marked). Fill in your data from row 2 onwards,
   replacing the hint row.
4. In **2. Upload and map columns**, choose your file (**.xlsx** or **.csv**, at most 5 MB and
   2,000 data rows).
5. Check the column mapping. FacilityOS matches your headers to fields automatically; change any
   field with its drop-down, or choose _— not in file —_. Required fields are marked **\***.
6. Select **Validate (dry run)**. FacilityOS reads the file, checks every row and looks up codes —
   but writes nothing.
7. In **3. Review and confirm**, read the counts: _New_, _Match found (no change)_, _Update
   candidate_, _Duplicate in file_, _Invalid_, _Skipped (empty)_. Select a count to filter the
   table. Each row shows its source row number and the reason for any problem.
8. If some existing records have different values, decide whether to tick **Also update the …
   existing record(s)** — only the columns in your file change.
9. Download the **error report** if there are invalid or duplicate rows, fix them later in your file.
10. Select **Import N rows**. Rows are saved one by one with a progress counter; you can **Stop**.
    When it finishes a banner shows the result, and the import appears in **Import history**.

![Validation preview with new, duplicate and invalid rows](screens/phase8-03-import-preview.png)

{{diagram wf-45}}

## Expected result

- New records exist with exactly the codes from your file, and appear in their normal lists.
- **Import history** shows the file, module, status (_Completed_ or _Partial_), the counts and who
  ran it.

## How matching works

A row is matched to an existing record **only by its exact code** (codes are unique per record
type in your company and stored in upper case). Names are never used to decide that two records
are the same. References to other records — _Site (code)_, _Department (code)_ and so on — are also
given as codes and must exist already.

> **Warning:** Each row is saved with exactly the same checks as the normal form: required fields,
> valid options and dates, references, plan limits and security rules. A row that a form would
> refuse is refused here too.

## Common errors

| Message                                                                         | Why                                        | What to do                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------- |
| _Upload an Excel (.xlsx) or CSV (.csv) file. Old .xls files are not supported._ | Wrong file type                            | Save as .xlsx or CSV                        |
| _The file is larger than 5 MB._ / _Import at most 2,000 rows per file._         | File too big                               | Split the file                              |
| _Missing column: …_                                                             | A required column is not mapped            | Map it, or add it to the file               |
| _Site (code): no site with code "…"_                                            | The referenced record does not exist       | Create or import it first                   |
| _Code … appears earlier in this file_                                           | The same code twice                        | Keep one row                                |
| _…: formulas are not accepted — paste values only_                              | A cell contains a formula                  | Copy and _Paste values_ in Excel            |
| _Your plan allows …_                                                            | A plan limit was reached during the import | See [Plan & usage](article:saas.plan-usage) |

See also [Import validation failed](article:ts.import-failed) and [Repeat and resumed imports](article:import.resume).
