---
id: exports.overview
title: Export lists and reports to Excel, PDF or CSV
module: Excel & PDF Exports
category: reports
audience: public
apps: [admin, customer]
roles: [owner, admin, customer]
version: '0.8'
reviewed: '2026-11-15'
owner: Reporting
description: Use the Export button on any list or report to download the rows you are allowed to see as Excel, PDF or CSV.
routes: [/departments, /tasks, /management, /work-orders, /stock-transactions]
prerequisites:
  - Your plan includes Excel/PDF export (see Plan & usage)
permissions:
  - Company owner or admin (customers can export their own service history in the customer portal)
screenshots: [phase8-04-export-dialog.png, phase7-07-admin-management-dashboard.png]
diagrams: [wf-44]
related: [exports.limits, train.export, reports.dashboard, customer.history, saas.plan-usage]
sources:
  - apps/admin-web/src/ui/ExportMenu.tsx
  - apps/admin-web/src/management/exportStore.ts
  - apps/admin-web/src/management/exportSets.ts
  - apps/admin-web/src/management/reportExports.ts
  - packages/shared/src/exporting.ts
  - packages/shared/src/exportFiles.ts
keywords: [download, excel, xlsx, pdf, csv, spreadsheet, print, export all, columns]
---

Every list and report in FacilityOS has the same **Export** button. It downloads exactly the
records that match your current filters and that your role is allowed to see — as an Excel
workbook, a branded PDF or a CSV file.

Where you find it:

- **Master lists** — sites, locations, facilities, clients, contracts, allocations, employees,
  departments, designations, teams, shifts, leave, assets, furniture, equipment, materials,
  suppliers, stores, task categories, task templates, SLA policies.
- **Operational registers** — **Task register**, **Recurring tasks**, **Preventive plans**,
  **Work orders**, **Complaints**, **Escalations**, **Stock balance**, **Stock transactions**,
  **Customer requests** and **Audit history**.
- **Reports & analytics** — management summary, task performance, staff productivity, site
  performance, work orders and maintenance costs, asset performance, inventory reconciliation,
  attendance, SLA performance and the compliance register.
- **Customer portal** — **Service history** (customer-safe columns only).

## Steps

1. Open the list or report and set the filters you want (status, site, period, search…).
2. Select **Export**. The export panel opens.
3. Choose the **Format**: *Excel (.xlsx)*, *PDF* or *CSV*.
4. Choose the **Scope**:
   - *On screen* (or *Current page*) — exactly the rows already loaded on the screen.
   - *All matching records* — FacilityOS reads every record that matches the filters in pages,
     with no 3,000-row display limit. An estimated row count is shown when it is available.
5. Under **Columns**, tick the columns you need. Columns marked *(detail)* are optional extras.
6. Check **Filters applied** and **Period** — they are printed on the file.
7. Select **Export XLSX** / **Export PDF** / **Export CSV**. A progress bar shows the rows read; you
   can **Cancel export** at any time.
8. The file downloads to your device and a message confirms how many rows were exported.

![The export panel with format, scope and columns](screens/phase8-04-export-dialog.png)

{{diagram wf-44}}

## Expected result

- **Excel**: a data sheet with a coloured header row that stays visible while scrolling, filter
  buttons on every column, sized and wrapped columns, real numbers and dates (in the company time
  zone), money with two decimals and a **Total** row where sums make sense. A second sheet,
  **Report details**, records the company, period, filters, row count and who generated it.
- **PDF**: your company logo, report colour and header/footer lines (from **Company setup → Logo &
  preferences**), title, period, filters, generation time, the table with repeated headers, totals
  and "Page n of N". Wide tables are printed in landscape.
- **CSV**: plain comma-separated values in UTF-8 for other systems.
- An entry is written to the company's export log (report, format, scope, row count, filters, user
  and time). The exported data itself is never stored.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Excel/PDF export is not included in your plan* | Your plan has the export feature switched off. | Ask Sharaco to change the plan. |
| *… rows are too many for a readable PDF (limit 10,000)* | PDF has a lower limit than Excel. | Use Excel, or narrow the filters. See [Export limits](article:exports.limits). |
| *… rows exceed the in-browser limit of 100,000* | Very large exports run in your browser. | Export in parts, for example month by month. |
| *Export cancelled.* | You pressed **Cancel export**. | Start again. |

## Troubleshooting

- **The file has fewer columns than the screen:** personal contact columns (phone, email, contact
  person, login IDs) are left out unless your role may see them, and internal columns are never
  included in customer exports.
- **Text starts with an apostrophe in Excel:** values that begin with `=`, `+`, `-` or `@` are
  stored as text with a leading apostrophe so a spreadsheet cannot run them as formulas. This is a
  security protection.
- **Read-only subscription:** exports still work — your data always stays available to download.
