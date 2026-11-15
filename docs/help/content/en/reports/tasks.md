---
id: reports.tasks
title: Task, staff and site performance reports
module: Reports & Analytics
category: reports
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.7'
reviewed: '2026-11-15'
owner: Reporting
description: Measure generated, completed, overdue and on-time work, rework and exceptions by template, employee and site.
routes: [/report-tasks, /report-staff, /report-sites]
permissions:
  - Company owner or admin
screenshots:
  [
    phase7-07-admin-management-dashboard.png,
    phase8-04-export-dialog.png,
    admin-report-tasks.png,
    admin-report-staff.png,
    admin-report-sites.png,
  ]
diagrams: [wf-43]
related:
  [
    reports.dashboard,
    tasks.lifecycle,
    tasks.assignments,
    tasks.history,
    exports.overview,
  ]
sources:
  - apps/admin-web/src/management/Reports.tsx
  - apps/admin-web/src/management/reportsStore.ts
  - packages/shared/src/reports.ts
keywords:
  [
    task performance,
    staff productivity,
    site performance,
    on-time rate,
    approval rate,
    rework,
    average completion,
    workload,
    recorded duration,
    cancelled excluded,
  ]
---

Three reports cover task work for a period (tasks are counted by **due date**):

- **Task performance** — totals and a breakdown **By checklist template**;
- **Staff productivity** — one row per employee;
- **Site performance** — one row per site, with work orders and complaints.

![The Reports & analytics → Task performance screen](screens/admin-report-tasks.png)

![The Reports & analytics → Staff productivity screen](screens/admin-report-staff.png)

![The Reports & analytics → Site performance screen](screens/admin-report-sites.png)

## Steps

1. Open **Reports & analytics → Task performance** (or **Staff productivity**, **Site performance**).
2. Choose the period (**7 days**, **30 days**, **This month**, **Custom**) and optionally a **Site**.
3. Read the figures:
   - **Task performance:** **Generated**, **Assigned**, **Completed**, **Pending**, **Overdue**,
     **Rejected**, **Rework**, **Exceptions**, **Avg completion**, **On-time rate**, **Approval rate** and
     **Cancelled (excluded)**; per template: **Tasks**, **Completed**, **Overdue**, **On time**,
     **Rework**.
   - **Staff productivity:** **Assigned**, **Completed**, **Pending**, **Overdue**, **Rework**, **On
     time**, **Planned** and **Recorded** minutes.
   - **Site performance:** **Tasks**, **Completed**, **Overdue**, **On time**, **Work orders**,
     **Complaints**.
4. Select **Export** for an Excel or PDF file of the same data.

![Management reporting with period and site filters](screens/phase7-07-admin-management-dashboard.png)

{{diagram wf-43}}

## Definitions

| Measure              | Meaning                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| Completed            | Approved, or completed on a template without approval.                            |
| Overdue              | Open, not awaiting approval, past the due time.                                   |
| On-time rate         | Completed no later than the due time ÷ completed.                                 |
| Rework               | Extra attempts after a reviewer requested rework.                                 |
| Approval rate        | Approved ÷ (approved + rejected).                                                 |
| Avg completion       | Start to submission, only for tasks with both times recorded (coverage is shown). |
| Planned              | Sum of template estimated minutes of the assigned tasks.                          |
| Recorded             | Actual time from start to submission.                                             |
| Cancelled (excluded) | Cancelled tasks are counted but left out of every rate.                           |

![Export dialog for a report](screens/phase8-04-export-dialog.png)

## Common errors

| Message                        | Why                                                    | What to do                                                               |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| _Partial period_               | More than 3,000 records in the period.                 | Narrow the period or choose a site, or export (exports read everything). |
| Avg completion shows few tasks | Tasks completed without a recorded start are left out. | Ask staff to use **Start task** before answering.                        |

## Troubleshooting

- **A person shows zero:** tasks are attributed to their assignees; unassigned tasks are not in Staff
  productivity.
- **Recorded time is much longer than planned:** tasks left _In progress_ overnight count the whole time
  until submission. Ask staff to **Pause**.
