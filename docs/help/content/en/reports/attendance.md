---
id: reports.attendance
title: Review attendance
module: Reports & Analytics
category: reports
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.7'
reviewed: '2026-11-15'
owner: Reporting
description: See check-ins and check-outs by site local time, lateness, missed check-outs and supervisor corrections.
routes: [/report-attendance]
permissions:
  - Company owner or admin
screenshots: [phase6-02-attendance.png, admin-report-attendance.png]
diagrams: [wf-38]
related: [mobile.attendance, people.shifts, people.employees, exports.overview]
sources:
  - apps/admin-web/src/management/Reports.tsx
  - apps/admin-web/src/management/reportsStore.ts
  - packages/shared/src/reports.ts
keywords:
  [
    attendance report,
    check-in,
    check-out,
    late,
    missed check-out,
    corrected,
    GPS not shown,
    location evidence,
  ]
---

Staff check in and out with the **mobile app** (see [Mobile attendance](article:mobile.attendance)).
The **Attendance** report shows those records for a period. Times are server timestamps shown in the
site's local time.

> **Note:** Location coordinates are never shown in reports. The export shows only whether location
> evidence exists.

![The Reports & analytics → Attendance screen](screens/admin-report-attendance.png)

## Steps

1. Open **Reports & analytics → Attendance**.
2. Choose the period and optionally a site.
3. Read the totals — **Check-ins**, **Late**, **Missed check-out**, **Corrected** — and the table **By
   employee** with **Late minutes**, **Missed check-out** and **Corrected**.
4. Use **Export** for Excel or PDF.

![Mobile attendance screen where staff check in and out](screens/phase6-02-attendance.png)

{{diagram wf-38}}

## Flags

| Flag             | Meaning                                          |
| ---------------- | ------------------------------------------------ |
| Late             | Checked in after the shift start.                |
| Missed check-out | Checked in but never checked out.                |
| Corrected        | A supervisor corrected the record with a reason. |

## Common errors

| Message          | Why                      | What to do                            |
| ---------------- | ------------------------ | ------------------------------------- |
| _Partial period_ | More than 3,000 records. | Narrow the period or site, or export. |

## Troubleshooting

- **Lateness looks wrong:** it depends on the employee's shift; check their shift assignment.
- **No records:** attendance needs the mobile app; the web portals do not record attendance.
