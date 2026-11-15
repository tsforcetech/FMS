---
id: scheduling.changes
title: Change, pause or end a recurring schedule
module: Recurring Scheduling
category: daily-tasks
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Task Management
description: Edit a schedule's timing or assignment, move one occurrence or a whole series, and pause, reactivate or archive a schedule without losing history.
routes: [/recurring-tasks, /pm-plans, /task-calendar]
permissions:
  - Company owner or admin
screenshots:
  [
    phase4-11-schedule-detail.png,
    phase4-14-reschedule-scope.png,
    admin-recurring-tasks.png,
    admin-pm-plans.png,
    admin-task-calendar.png,
  ]
diagrams: [wf-25]
related:
  [
    scheduling.recurring,
    scheduling.generation,
    calendar.task-calendar,
    templates.publish,
    tasks.lifecycle,
  ]
sources:
  - apps/admin-web/src/management/Schedules.tsx
  - apps/admin-web/src/management/scheduling.ts
  - apps/admin-web/src/management/Calendar.tsx
keywords:
  [
    edit schedule,
    rule version,
    pause,
    activate,
    archive,
    reschedule series,
    this occurrence only,
    this and future occurrences,
    entire schedule,
    Archived schedules cannot be edited,
  ]
---

Schedules can change without breaking history. Work that has started or finished is **never** moved
or changed; only future occurrences that have not started are replaced.

![The Task management → Recurring tasks screen](screens/admin-recurring-tasks.png)

![The Maintenance → Preventive plans screen](screens/admin-pm-plans.png)

![The Task management → Task calendar screen](screens/admin-task-calendar.png)

## Steps

### Edit the schedule

1. Open **Task management → Recurring tasks** (or **Maintenance → Preventive plans**), open the
   schedule and select **Edit**.
2. Change what you need and select **Save changes** (_Schedule updated._). The code, template and site
   of an existing schedule stay the same.
3. If you changed the **timing** — repeat rule, start or end date, time, duration, time zone, working
   days or holiday rule — the schedule gets a new **rule version** (shown as _Rule vN_). From the next
   day not yet generated, _Pending_ and _Assigned_ occurrences of the old version are cancelled with the
   reason _Schedule changed; replaced by the new rule version._ and the next scheduler run creates the
   new ones.
4. Name, priority and assignment changes apply to occurrences generated from now on, without a new rule
   version.

![Schedule detail with rule version, period, holidays and assignment](screens/phase4-11-schedule-detail.png)

### Move one occurrence or the series from the calendar

Drag a recurring task to another day or time in the [Task calendar](article:calendar.task-calendar)
and choose the scope:

- **This occurrence only** — "Only this task moves; the schedule is unchanged." Enter a **Reason
  (recorded in the timeline)**.
- **This and future occurrences** — "Moves the series pattern and time from this occurrence on. Earlier
  occurrences keep their time."
- **The entire schedule** — "Re-plans all not-started occurrences from today. Completed and in-progress
  work is history and never moves."

For a series move the toast says _Schedule updated. Run the scheduler to regenerate occurrences._

![Reschedule dialog with the three scopes](screens/phase4-14-reschedule-scope.png)

### Pause, activate or archive

- **Pause** — "No new occurrences are generated while paused. Existing tasks are not changed."
- **Activate** — "The scheduler will generate occurrences from the next run, catching up missed days
  (up to 30 days back)."
- **Archive** (only when not active) — "Archived schedules stop permanently and cannot be edited.
  Generated tasks remain in history."

{{diagram wf-25}}

## Expected result

Future occurrences follow the new rule, nothing is duplicated, and the earlier tasks keep their
original times and results.

## Common errors

| Message                                                                          | Why                                                  | What to do                                                |
| -------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| _This schedule was changed by someone else. Reload and try again._               | Two people edited at once.                           | Reload and repeat.                                        |
| _Archived schedules cannot be edited._ / _Archived schedules cannot be changed._ | Archiving is final.                                  | Create a new schedule.                                    |
| _A … task cannot be rescheduled._                                                | The task is in progress, awaiting approval or final. | Only pending, assigned, paused and rework tasks can move. |
| _The end date must be on or after the start date._                               | Dates are reversed.                                  | Correct the end date.                                     |
| _Duration must be between 5 minutes and 7 days._                                 | Duration out of range.                               | Enter 5 to 10,080 minutes.                                |

## Troubleshooting

- **Old occurrences still shown after a timing change:** they were already in progress, paused, in
  rework or finished — those are never cancelled automatically. Cancel them by hand if needed.
- **New occurrences missing:** run the scheduler (see [How tasks are generated](article:scheduling.generation)).
- **Using a new checklist version:** edit the schedule and choose the template again so the current
  published version is used.
