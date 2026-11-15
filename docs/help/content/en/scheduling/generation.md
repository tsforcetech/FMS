---
id: scheduling.generation
title: How recurring tasks are generated
module: Recurring Scheduling
category: daily-tasks
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Task Management
description: When the scheduler creates tasks, how far ahead it works, what the Scheduler monitor shows and how to run it by hand.
routes: [/scheduler]
permissions:
  - Company owner or admin
screenshots:
  [
    phase4-17-scheduler-monitor.png,
    phase4-11-schedule-detail.png,
    admin-scheduler.png,
  ]
diagrams: [wf-26]
related:
  [
    scheduling.recurring,
    scheduling.assignment,
    scheduling.changes,
    ts.scheduler-not-active,
    ts.no-tasks,
    setup.notifications,
  ]
sources:
  - apps/admin-web/src/management/scheduling.ts
  - apps/admin-web/src/management/Notifications.tsx
  - apps/admin-web/src/management/Schedules.tsx
keywords:
  [
    scheduler,
    scheduler monitor,
    run scheduler now,
    generate now,
    server job,
    pending activation,
    catch up,
    duplicates,
    due soon,
    overdue notifications,
    SLA breach,
  ]
---

Schedules do not create tasks by themselves. The **scheduler** reads every active schedule and
creates the occurrences that are due. Each occurrence has a fixed identity, so running the scheduler
twice never creates a duplicate.

> **Warning:** Automatic generation runs as a server job every 30 minutes **only after it has been
> activated** for your installation (the job needs a dedicated scheduler account). Until then the
> Scheduler monitor shows _Pending activation_ / _No server run recorded yet_ and **nothing is
> generated automatically** — an administrator must run it by hand.

![The Administration → Scheduler monitor screen](screens/admin-scheduler.png)

## Steps

### Check whether automatic runs are active

1. Open **Administration → Scheduler monitor**.
2. Read the status:
   - _Operational_ — the server job ran recently ("It runs every 30 minutes without any browser open").
   - _Not running recently_ — _The server job has not run in the last 2 hours_.
   - _Pending activation_ — _No server run recorded yet_.

### Run the scheduler by hand

1. On **Scheduler monitor**, select **Run scheduler now**.
2. The toast summarises the run: _Run …: N created, N already existed, N unassigned, N notifications._
3. **Recent runs** lists each run (_Server_ or _Manual_) with schedules processed, created, existing,
   unassigned, notifications and any errors.

A manual run uses your session, generates the next **7 days**, recovers up to **30 missed days** and
never duplicates an occurrence that already exists.

To generate a single schedule, open it and select **Generate now** (_N new occurrence(s), N already
existed._).

![Scheduler monitor with recent manual and server runs](screens/phase4-17-scheduler-monitor.png)

{{diagram wf-26}}

## What a run does

For each active schedule the scheduler:

1. works out the occurrences between the last generated day and the end of the window, in the
   schedule's time zone, applying the holiday rule;
2. creates one task per occurrence from the schedule's published template version and chooses the
   assignee (see [Assignment strategies](article:scheduling.assignment));
3. sends _New task assigned_ notifications, and _Maintenance due_ to admins for preventive plans due
   today or tomorrow;
4. records **Generated through** and **Last run** on the schedule.

It also sends in-app reminders: _Task due soon_ (due within 2 hours), _Task overdue_ (to the
assignees, or admins if nobody is assigned) and _SLA breach_ for cases past their resolution target.
Each reminder is sent once per event and person.

![Schedule detail showing generated-through date, last run and generated tasks](screens/phase4-11-schedule-detail.png)

## Expected result

New tasks appear in the **Task register**, **Task calendar** and staff **My Day**. The schedule shows
the new **Generated through** date.

## Common errors

| Message                                                                                          | Why                                                          | What to do                                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------- |
| _Last run failed (N attempt(s))_ on a schedule                                                   | The run for that schedule hit an error; the reason is shown. | Fix the cause; the next run retries automatically. |
| _The template version is no longer published. Edit the schedule and choose a published version._ | The version the schedule uses was retired.                   | Edit the schedule and pick the template again.     |
| _Nothing generated yet._ on the schedule                                                         | The scheduler has not run since the schedule was created.    | Select **Generate now** or **Run scheduler now**.  |

## Troubleshooting

- **No tasks tomorrow morning:** check the monitor. If it says _Pending activation_, see
  [Scheduler not activated](article:ts.scheduler-not-active).
- **Email and push notifications** are also _Pending activation_; only in-app notifications are sent
  today (see [Notifications](article:setup.notifications)).
