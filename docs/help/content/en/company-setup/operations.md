---
id: setup.operations
title: Check system health on Operational monitoring
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Platform Operations
description: Use the health checks, open-work counts and recent scheduler runs to see whether FacilityOS is generating and processing work as expected.
routes: [/operations]
permissions:
  - Company owner or admin
screenshots: [admin-operations.png, phase4-17-scheduler-monitor.png]
diagrams: [wf-26]
related: [scheduling.generation, ts.scheduler-not-active, ts.task-overdue, ts.no-eligible-staff, cases.customer-requests, cases.sla]
sources:
  - apps/admin-web/src/management/Operations.tsx
  - apps/admin-web/src/management/reportsStore.ts
keywords: [health, monitoring, scheduler, overdue, breached, intake, status, Attention]
---

**Administration → Operational monitoring** is a quick daily check that work is flowing: the
scheduler is generating tasks, nothing is badly overdue and customer requests are being taken in.

## Before you start

Read the banner **What this page can and cannot see**: the checks read the records the system
writes (scheduler runs, tasks, cases, requests). Mobile devices keep their offline queue on the
device; sync conflicts appear as task exceptions and on the device's Sync screen, not here.

## Steps

1. Open **Administration → Operational monitoring**.
2. Read **Health checks**. Each line shows **OK** or **Attention**:
   - *Task generation ran in the last 26 hours* (otherwise *No scheduler run recorded*).
   - *Recent scheduler runs succeeded* (*No errors in recent runs* when fine).
   - *No overdue tasks in the last 30 days*.
   - *No cases past their resolution target* (otherwise *N breached*).
   - *Customer requests taken in* (otherwise *N waiting for intake*).
3. Read **Open work**: *Open tasks (30 days)*, *Awaiting approval*, *Open work orders* and
   *Open complaints*.
4. Read **Recent scheduler runs**: **Started**, **Window**, **Created**, **Unassigned** and
   **Status** of each run.
5. Act on any **Attention** line (see Troubleshooting) and select the refresh button to re-check.

![Operational monitoring](screens/admin-operations.png)

{{diagram wf-26}}

## Expected result

All health checks show **OK** on a normal day.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *No scheduler run recorded* / *No runs recorded yet* | The scheduler has not run in the last 26 hours. The automatic server job is pending activation. | Open **Administration → Scheduler monitor** and select **Run scheduler now**. See [Scheduler not activated](article:ts.scheduler-not-active). |
| A run with errors | A scheduler run failed for some schedules. | Open **Scheduler monitor** for details and run it again. |
| *N waiting for intake* | Customer requests have not been taken in. | Open **Issues & escalations → Customer requests**. See [Customer requests](article:cases.customer-requests). |
| *N breached* | Cases are past their resolution target. | See [SLA](article:cases.sla). |

![Scheduler monitor with recent runs](screens/phase4-17-scheduler-monitor.png)

## Troubleshooting

- **Overdue tasks:** see [Task overdue](article:ts.task-overdue).
- **Many unassigned tasks in a run:** see [No eligible staff](article:ts.no-eligible-staff).
