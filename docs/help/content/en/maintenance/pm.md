---
id: maintenance.pm
title: Set up a preventive maintenance plan
module: Maintenance & Work Orders
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Maintenance
description: Plan inspections and servicing for an asset or facility on a fixed cycle using a published inspection checklist.
routes: [/pm-plans, /maintenance-calendar]
prerequisites:
  - The asset or facility is registered and active
  - A published inspection or servicing checklist template
  - Technicians set up as active employees
permissions:
  - Company owner or admin
screenshots:
  [
    phase4-10-schedule-builder.png,
    phase4-11-schedule-detail.png,
    phase4-13-calendar-month.png,
    admin-pm-plans.png,
    admin-maintenance-calendar.png,
  ]
diagrams: [wf-31]
related:
  [
    scheduling.recurring,
    scheduling.assignment,
    scheduling.generation,
    maintenance.dashboard,
    maintenance.work-orders,
    maintenance.asset-history,
    assets.register,
    templates.publish,
  ]
sources:
  - apps/admin-web/src/management/Schedules.tsx
  - apps/admin-web/src/management/scheduling.ts
  - apps/admin-web/src/management/Calendar.tsx
keywords:
  [
    PM plan,
    preventive maintenance,
    servicing,
    inspection cycle,
    quarterly service,
    half-yearly,
    maintenance calendar,
    maintenance due,
  ]
---

A **preventive maintenance (PM) plan** is a recurring schedule for maintenance: it uses the same
builder and scheduler as [recurring tasks](article:scheduling.recurring), but is listed under
**Maintenance**, recommends an **asset**, and its tasks are marked _Preventive_ in asset history.

![The Maintenance → Preventive plans screen](screens/admin-pm-plans.png)

![The Maintenance → Maintenance calendar screen](screens/admin-maintenance-calendar.png)

## Before you start

- Register the asset (see [Asset register](article:assets.register)).
- Build and publish the inspection checklist, with readings and limits for the equipment (see
  [Build a checklist template](article:templates.builder)).

## Steps

1. Open **Maintenance → Preventive plans** and select **New PM plan**. The form is titled _New preventive
   maintenance plan_.
2. Enter the name and choose the published **Task template**.
3. Choose the **Site** and the **Asset (recommended)**, or a location or facility.
4. Under **Repeats** choose the cycle — for example _Monthly (date)_, _Quarterly_ or _Half-yearly_ —
   and set the start date, time and duration.
5. Choose the holiday rule and the **Assignment** — usually _Fixed employee(s)_ or a _Least workload_
   pool of technicians (see [Assignment strategies](article:scheduling.assignment)).
6. Check the preview of next occurrences and select **Create schedule**.

![Schedule builder used for a preventive maintenance plan](screens/phase4-10-schedule-builder.png)

{{diagram wf-31}}

## Expected result

- After the scheduler runs, each occurrence becomes a task for the technician.
- Admins receive a _Maintenance due_ in-app notification for PM tasks due today or tomorrow.
- **Maintenance → Maintenance calendar** shows only preventive maintenance.
- Completed PM tasks appear in [Asset maintenance history](article:maintenance.asset-history).

![Plan detail with generated-through date and upcoming occurrences](screens/phase4-11-schedule-detail.png)

![Month calendar used to review planned maintenance](screens/phase4-13-calendar-month.png)

## Common errors

| Message                                 | Why                                     | What to do             |
| --------------------------------------- | --------------------------------------- | ---------------------- |
| _No preventive maintenance plans_       | None created yet.                       | Select **Create one**. |
| _Choose a published template._          | The checklist has no published version. | Publish it first.      |
| _Choose at least one day of the month._ | A monthly rule without a day.           | Pick the day.          |

## Troubleshooting

- **The technician finds a fault during the inspection:** a failed check becomes an issue under
  [Reported issues](article:cases.reported-issues), where you can create a
  [work order](article:maintenance.work-orders) with one click.
- **Change the cycle later:** see [Change a schedule](article:scheduling.changes).
- **No tasks generated:** see [Scheduler not activated](article:ts.scheduler-not-active).
