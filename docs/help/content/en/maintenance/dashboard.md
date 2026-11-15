---
id: maintenance.dashboard
title: Read the maintenance dashboard
module: Maintenance & Work Orders
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Maintenance
description: See active preventive plans, upcoming and overdue preventive maintenance, and open or late work orders in one place.
routes: [/maintenance]
permissions:
  - Company owner or admin
screenshots: [phase4-16-work-order.png]
diagrams: [wf-31]
related: [maintenance.pm, maintenance.work-orders, maintenance.asset-history, cases.sla, reports.maintenance, scheduling.generation]
sources:
  - apps/admin-web/src/management/Cases.tsx
keywords: [maintenance overview, PM, preventive maintenance, overdue PM, open work orders, past SLA]
---

The **Maintenance dashboard** gives the maintenance lead a single view of planned and corrective work.

## Steps

1. Open **Maintenance → Maintenance dashboard**.
2. Read **Maintenance overview**:
   - **Active PM plans** — preventive maintenance plans that are active (select it to open
     **Preventive plans**);
   - **Upcoming (next 10)** — generated preventive maintenance tasks still ahead;
   - **Overdue PM tasks** — preventive tasks past their due time and not finished;
   - **Open work orders**;
   - **Work orders past SLA** — open work orders whose resolution target has passed.
3. Use **Upcoming preventive maintenance** and **Overdue preventive maintenance** (up to 10 each) to
   open the tasks.

![A corrective work order opened from the maintenance area](screens/phase4-16-work-order.png)

{{diagram wf-31}}

## Expected result

You can see which inspections are coming, which are late and how many repairs are open.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *No generated maintenance occurrences ahead. Create a PM plan and run the scheduler.* | No PM plan exists, or the scheduler has not generated its tasks. | Create a [PM plan](article:maintenance.pm) and run the scheduler. |
| *Nothing overdue.* | All preventive tasks are on time. | No action needed. |

## Troubleshooting

- **Upcoming list is empty although plans exist:** the scheduler generates only a few days ahead and
  may not be activated yet (see [How tasks are generated](article:scheduling.generation)).
- **Costs and trends** are in [Maintenance reports](article:reports.maintenance).
