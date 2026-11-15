---
id: train.export
title: 'Quick start: export a list to Excel or PDF'
module: Training & Quick Starts
category: reports
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Download any list or report as Excel, PDF or CSV with the filters you set.
routes: [/tasks, /management]
permissions:
  - Company owner or admin; the plan must include Excel/PDF export
screenshots:
  [phase8-04-export-dialog.png, admin-tasks.png, admin-management.png]
diagrams: [wf-44]
related: [exports.overview, exports.limits, ts.export-limit]
sources:
  - apps/admin-web/src/ui/ExportMenu.tsx
  - packages/shared/src/exporting.ts
keywords: [download, excel, pdf, csv, spreadsheet, export]
---

1. Open the list or report, for example **Task management → Task register**.
2. Set the filters (site, status, period).
3. Select **Export**.
4. Choose the **Format**: _Excel (.xlsx)_, _PDF_ or _CSV_.
5. Choose the **Scope**: _On screen_ or _All matching records_.
6. Tick the **Columns** you need.
7. Select **Export XLSX** (or PDF / CSV) and wait for the progress bar.
8. Open the downloaded file. The _Report details_ sheet shows the filters and who generated it.

![Export panel](screens/phase8-04-export-dialog.png)

> **Tip:** Arabic text is not shaped correctly in PDFs — use Excel for Arabic.

Full guide: [Export to Excel, PDF or CSV](article:exports.overview).

![The Task management → Task register screen](screens/admin-tasks.png)

![The Reports & analytics → Management dashboard screen](screens/admin-management.png)
