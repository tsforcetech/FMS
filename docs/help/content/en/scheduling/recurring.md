---
id: scheduling.recurring
title: Create a recurring cleaning task
module: Recurring Scheduling
category: daily-tasks
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Task Management
description: Set up a schedule that creates a cleaning checklist task for the right person every day, week or month.
routes: [/recurring-tasks]
helpIds: [setup.schedules]
prerequisites:
  - The company time zone and the site are set up
  - A task template whose checklist has been published
  - Active employees who can do the work (with shifts if you assign by shift)
permissions:
  - Company owner or admin (staff and supervisors cannot create schedules)
screenshots: [phase4-10-schedule-builder.png, phase4-11-schedule-detail.png, phase4-17-scheduler-monitor.png]
diagrams: [wf-25, wf-26]
related: [templates.publish, scheduling.assignment, scheduling.generation, scheduling.changes, ts.no-eligible-staff, ts.scheduler-not-active]
sources:
  - apps/admin-web/src/management/Schedules.tsx
  - apps/admin-web/src/management/scheduling.ts
  - packages/shared/src/schedule.ts
keywords: [repeat, recurrence, daily cleaning, weekly, monthly, rota, round robin, least workload, holiday, Choose a published template version]
---

A **recurring task** (schedule) turns one checklist template into a series of tasks, for example
"Common area cleaning every day at 07:00 in Muteena Business Centre". Each occurrence becomes a
normal task with its own due time, assignee, checklist and history.

> **Note:** Creating a schedule does not by itself guarantee that tasks appear on time every day.
> Tasks are created when the scheduler runs. Check **Administration → Scheduler monitor**: if no
> automatic run is shown, an administrator must press **Run scheduler now** (see
> [How tasks are generated](article:scheduling.generation)).

## Before you start

- Publish the checklist you want to use: **Task management → Task templates** → open the template →
  publish its draft. Draft templates are not offered when you create a schedule.
- Make sure the people who will do the work are active employees. If you plan to assign by
  department, designation, team, shift or site, they must belong to it.

## Steps

1. Open **Task management → Recurring tasks** and select **New recurring task**.
2. Enter a **Schedule name** and choose the **Task template**. Only templates with a published
   version appear.
3. Choose the **Site** and, if the work is for a specific place, the **Location**, **Facility** or
   **Asset**. The **Responsible department** is optional.
4. Under **Repeats** pick a pattern — *Every day*, *Alternate days*, *Every N days*, *Every weekday
   (Mon–Fri)*, *Selected weekdays*, *Weekly*, *Every N weeks*, *Monthly (date)*, *Monthly (e.g.
   first Friday)*, *Quarterly*, *Half-yearly* or *One time* — and adjust the interval or days.
5. Set the **Start date**, an optional **End date**, the **Start time** and **Duration (minutes)**.
   Times use the schedule's **Time zone** (the site's time zone by default), so daylight-saving
   changes are handled correctly.
6. Choose what happens **On holidays and non-working days**: *Skip the occurrence*, *Move to the next
   working day* or *Generate anyway*. Leave **Working days** empty if every day is a working day.
7. Choose the **Assignment**:
   - *Leave unassigned (queue)* — tasks wait in the unassigned queue for a supervisor or admin.
   - *Fixed employee(s)* — the first available person in your list.
   - *Round-robin rotation* — eligible people take turns.
   - *Least workload* — the eligible person with the fewest planned minutes that day.

   For the last three, choose the **Pool** (*Selected employees*, *Department*, *Designation*, *Team*,
   *Shift* or *Site staff*) and the matching value. See [Assignment strategies](article:scheduling.assignment).
8. Check the preview: it lists the next occurrences with their local date and time.
9. Select **Create schedule**. The schedule is saved as *Active*.
10. Open the schedule to see its details, then confirm that tasks appear in **Task management → Task
    calendar** or **Task register** after the scheduler has run.

![The schedule builder with recurrence, holidays and assignment settings](screens/phase4-10-schedule-builder.png)

{{diagram wf-25}}

## Expected result

- The schedule shows *Active*, its rule (for example *Every day at 07:00*), **Generated through** and
  **Last run**.
- After a scheduler run, one task per occurrence exists with the template's checklist. Running the
  scheduler again never creates duplicates — each occurrence has a fixed identity.
- Assigned people see the tasks in **My Day** on the staff web or mobile app.

![Schedule details with generated-through date and last run](screens/phase4-11-schedule-detail.png)

## What happens when nobody is available

When the scheduler creates an occurrence it checks every candidate in the pool. People who are
inactive or **on approved leave** that day are not eligible. People who have shift assignments are
only eligible on days one of their shifts covers; people with no shift assignment at all count as
available every day — except when the pool is a **Shift**, where only members of that shift on that
day qualify. If nobody is eligible the task is still created but **left unassigned** with the reason
(*No eligible employee (leave, shift or inactive)* or *No employees match the assignment rule*). It
never falls back to someone who is not eligible. Unassigned tasks appear in **Task management → Task
assignments** and on the dashboard so a supervisor can assign them by hand.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Choose a published template version.* | The template has only a draft, or the draft was changed after publishing. | Publish the template, then create the schedule again. |
| Tasks do not appear | The scheduler has not run yet. | Open **Scheduler monitor** and run it; see [Scheduler not activated](article:ts.scheduler-not-active). |
| Tasks appear unassigned | No eligible person on that day. | Check leave, shifts and pool membership; see [No eligible staff](article:ts.no-eligible-staff). |

## Troubleshooting

- **Wrong time of day:** check the schedule **Time zone**. The company and site time zones are
  separate settings.
- **A day is missing:** the day was a holiday or non-working day and the holiday rule is *Skip*, or a
  monthly date such as the 31st does not exist that month (choose what happens under **If the day
  does not exist**).
- **Need to change the time or rule:** see [Change a schedule](article:scheduling.changes). Changing the
  timing creates a new rule version; future tasks that have not started are replaced, completed work
  is never touched.

![Scheduler monitor showing manual and server runs](screens/phase4-17-scheduler-monitor.png)
