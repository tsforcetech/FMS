---
id: reports.dashboard
title: Use the management dashboard
module: Reports & Analytics
category: reports
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.7'
reviewed: '2026-11-15'
owner: Reporting
description: See open, overdue and completed work, on-time rate, rework, critical cases and sites needing attention for a chosen period.
routes: [/management]
permissions:
  - Company owner or admin
screenshots: [phase7-07-admin-management-dashboard.png]
diagrams: [wf-43]
related: [reports.tasks, reports.sla, reports.maintenance, tasks.dashboard, exports.overview, exports.limits]
sources:
  - apps/admin-web/src/management/Reports.tsx
  - apps/admin-web/src/management/reportsStore.ts
  - packages/shared/src/reports.ts
keywords: [management dashboard, KPI, operations at a glance, on-time completion, rework, critical cases, sites needing attention, period, partial period]
---

The **Management dashboard** summarises operations for a period: how much work is open, late and
done, how well it was done, and where problems are. Every figure uses the same definitions as the
detailed reports.

## Steps

1. Open **Reports & analytics → Management dashboard**.
2. Choose the period — **7 days**, **30 days**, **This month** or **Custom** — and optionally a **Site**.
3. Read **Operations at a glance**:
   - **Open tasks**, **Overdue now**, **Awaiting approval**, **Completed**;
   - **On-time completion** — completed no later than the due time;
   - **Rework (extra attempts)** — submissions that had to be redone;
   - **Open critical cases** — critical work orders, complaints and escalations still open.
4. **Sites needing attention** lists sites with their **Tasks**, **Completed** and **Overdue**.
5. **Cases raised in period** counts **Work orders**, **Complaints** (and how many came **From customer
   portal**) and **Escalations**.
6. Use **Export** to download the summary as Excel or PDF.

![Management dashboard for the last 30 days](screens/phase7-07-admin-management-dashboard.png)

{{diagram wf-43}}

## Definitions used everywhere

- Tasks are counted by **due date** in the period; cases by **creation date**.
- **Cancelled** tasks are left out of all rates.
- **Completed** means approved, or completed without approval.
- **Overdue** means open, not awaiting approval, and past the due time.
- Times are shown in the company time zone.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Partial period* | The period has more records than an interactive report reads at once (3,000). | Narrow the dates or choose a site. Exports read every record. |

## Troubleshooting

- **Figures differ from the task dashboard:** the task dashboard shows *now*; this dashboard shows the
  chosen period.
- **Need the rows behind a number:** open [Task performance](article:reports.tasks) or
  [SLA performance](article:reports.sla) for the same period.
