---
id: import.templates
title: Import templates, column mapping and validation rules
module: Bulk Import
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Data & Imports
description: What each import template contains, how columns are matched and exactly how rows are classified.
routes: [/import]
permissions:
  - Company owner or admin
screenshots: [admin-import.png, phase8-03-import-preview.png]
diagrams: [wf-45]
related: [import.overview, import.opening-stock, ts.import-failed, ts.duplicate-code]
sources:
  - packages/shared/src/importing.ts
  - packages/shared/src/operations.ts
  - apps/admin-web/src/management/ImportCenter.tsx
keywords: [template, columns, mapping, header, code, reference, status, date format, YYYY-MM-DD]
---

## The template

Each module's template has the same fields as the **Add …** form for that record type: **Code**,
**Name**, the module's own fields, **Notes** and **Status**. Reference fields end in **(code)** —
for example *Site (code)* — and take the code of the other record, not its name. The second row of
the template explains each column: *Required*, the date format (*YYYY-MM-DD*), time format (*HH:MM*)
or the allowed options.

## Column mapping

When you upload a file, each header is matched to a field if it equals the field's label or key
(ignoring upper/lower case, spaces and the "(code)" suffix). You can override every mapping.
Columns you leave as *— not in file —* get their default value for new records.

## How rows are classified

| Status | Meaning | Imported? |
| --- | --- | --- |
| *New* | No record with this code exists and the row is valid | Yes |
| *Match found (no change)* | A record with this code exists with the same values | No (nothing to do) |
| *Update candidate* | A record with this code exists but some values differ | Only if you tick **Also update…**; only the listed columns change |
| *Duplicate in file* | The same code appears on an earlier row | No |
| *Invalid* | Required value missing, wrong option or date, unknown reference code, formula cell… | No |
| *Skipped (empty)* | The row is empty | No |

Validation rules:

- **Codes** are converted to upper case and must use letters, numbers, `-` or `_`.
- **Options** (for example status) are matched without regard to upper/lower case.
- **Dates** must be real calendar dates written `YYYY-MM-DD`. Excel date cells are read as dates.
- **References** must name an existing record of the right type by its code.
- **Formulas are refused.** Only typed values are accepted — a spreadsheet can never smuggle
  instructions into the data.

> **Note:** The preview table shows up to 300 rows; the counts always cover the whole file. Use the
> **Download error report** button for the complete list of problems with row numbers.
