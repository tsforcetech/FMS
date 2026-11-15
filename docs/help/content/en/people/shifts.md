---
id: people.shifts
title: Define shifts and assign employees
module: Employees & Teams
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: People
description: Create working-time patterns in a site's time zone, including overnight shifts, and put employees on a shift rota.
routes: [/shifts]
prerequisites:
  - The site exists with the right time zone
  - Employees exist
permissions:
  - Company owner or admin
screenshots: [admin-shifts.png]
diagrams: [wf-15]
related: [people.employees, people.leave, people.teams, scheduling.assignment, ts.no-eligible-staff]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
  - packages/shared/src/schedule.ts
keywords: [shift, rota, night shift, overnight shift, break, working days, shift assignment, End time must differ from start time]
---

A **shift** is a working-time pattern at a site, for example *Morning 07:00–15:00, Sun–Thu*.
**Shift assignments** put employees on a shift for a period. Schedules that assign work by shift
use them, and an employee whose shift does not cover a day is not eligible for automatic
assignment that day.

## Before you start

- Check the site's **Time zone**. *Shift times use this site's time zone.*
- An end time earlier than the start time is an overnight shift (for example 22:00–06:00).

## Steps

### Create a shift

1. Open **People & teams → Shifts** and select **Add shift**.
2. Enter the **Code** and **Name**.
3. Choose the **Site**. It cannot be changed later.
4. Enter the **Start time**, **End time** and **Break** in minutes (0–600).
5. Tick the **Working days** and optionally add a **Description**.
6. Select **Save shift** (*Shift created.*).

### Assign employees

1. Open the shift and choose the **Assigned employees** tab, or use the **Shift assignments** tab
   of the Shifts page, and select **Add shift assignment**.
2. Choose the **Employee**, the **Effective from** date and, if known, **Effective until**. The
   code is generated automatically.
3. Save. To take someone off the shift, set the assignment to *Ended* with an end date.

![Shifts](screens/admin-shifts.png)

{{diagram wf-15}}

## Expected result

- The shift's **Assigned employees** tab and the employee's **Shifts** tab list the assignment.
- Schedules that use the shift as their pool assign work only to people on it on that day.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *End time must differ from start time* | Start and end are the same. | Change one of the times. Use an earlier end time for an overnight shift. |
| *Select valid working days* | No valid working day is ticked. | Tick at least one day. |
| *Site cannot change after creation. Create a new record instead.* | You changed the site of a saved shift. | Create a new shift at the other site. |
| *End date must follow start date* | The assignment ends before it starts. | Correct the dates. |
| *Ended assignments cannot be reopened. Create a new assignment.* | You tried to reactivate an ended shift assignment. | Create a new assignment. |

## Troubleshooting

- **Tasks unassigned on some days:** the eligible employees have no shift covering that weekday —
  see [No eligible staff](article:ts.no-eligible-staff).
- **Shift times look an hour off:** check the site time zone; daylight-saving changes are handled
  from it.
