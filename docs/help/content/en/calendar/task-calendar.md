---
id: calendar.task-calendar
title: Plan work in the task calendar
module: Task Calendar
category: daily-tasks
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Task Management
description: See tasks by day, week, month, agenda, staff or site, filter them, drag to reschedule or reassign, and create a task in an empty slot.
routes: [/task-calendar, /maintenance-calendar]
permissions:
  - Company owner or admin
screenshots: [phase4-12-calendar-week.png, phase4-13-calendar-month.png, phase4-12b-calendar-staff.png, phase4-14-reschedule-scope.png]
diagrams: [wf-24]
related: [tasks.register, scheduling.changes, tasks.assignments, maintenance.pm, staff.calendar, tasks.lifecycle]
sources:
  - apps/admin-web/src/management/Calendar.tsx
  - apps/admin-web/src/management/scheduling.ts
keywords: [calendar, week view, month view, day view, agenda, staff view, drag and drop, reschedule, reassign, maintenance calendar, time zone, Moved on the calendar]
---

The **Task calendar** shows every task — manual, recurring and preventive maintenance — on a calendar
in the company's time zone. You can move work by dragging it. **Maintenance → Maintenance calendar** is
the same calendar showing only preventive maintenance.

## Before you start

- Recurring tasks appear only after the scheduler has generated them (see
  [How tasks are generated](article:scheduling.generation)).

## Steps

1. Open **Task management → Task calendar**.
2. Choose a view: **Day**, **Week**, **Month**, **Agenda**, **Staff** (one row per employee, plus the
   *Unassigned queue*) or **Sites** (one row per site). Use the arrows to move between periods.
3. Filter by **Site**, **Department**, **Employee** and source — **All sources**, **Manual tasks**,
   **Recurring tasks** or **Preventive maintenance**.
4. Select a task to open it.
5. To create a task, click an empty slot. The new-task form opens with that date and time.
6. To reschedule, drag a task to another day (or hour, in Day view). Only *Pending*, *Assigned*,
   *Paused* and *Rework required* tasks can be dragged.
   - For a manual task, confirm **Reschedule** and enter a **Reason (recorded in the timeline)**. Without
     a reason the timeline records *Moved on the calendar*.
   - For a recurring task, choose **This occurrence only**, **This and future occurrences** or **The
     entire schedule** (see [Change a schedule](article:scheduling.changes)).
7. To reassign, drag a task onto another person's row in the **Staff** view. The dialog shows **Also
   reassign** — "The task will be reassigned to …".

![Week view of the task calendar](screens/phase4-12-calendar-week.png)

![Month view of the task calendar](screens/phase4-13-calendar-month.png)

![Staff view with one row per employee and the unassigned queue](screens/phase4-12b-calendar-staff.png)

{{diagram wf-24}}

## Expected result

The task shows at its new time, the timeline records *Rescheduled* with your reason, and the
assignees see the new time in **My Day**. *Task rescheduled.* confirms a single move.

![Reschedule dialog for a recurring occurrence](screens/phase4-14-reschedule-scope.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| A task cannot be dragged | It is in progress, awaiting approval, completed, rejected or cancelled. | Only open, not-started work can move. |
| *Choose a valid date and time.* | The target time is invalid. | Try again on a valid slot. |
| *The due time must be after the planned start.* | The new times are reversed. | Move the task again. |
| *This task was updated by someone else. Reload and try again.* | Someone changed the task meanwhile. | Reload and repeat. |
| *The schedule no longer exists.* | The series was removed. | Move only this occurrence. |
| *Nothing scheduled in this period* / *Nothing scheduled this week* | No tasks match the filters. | Clear the filters or run the scheduler. |

## Troubleshooting

- **Times look shifted:** the calendar shows the company time zone (shown above the calendar as
  *Times in …*). Schedules generate in their own time zone; check the schedule.
- **A series move did not show new occurrences:** run the scheduler.
- Staff see their own calendar in the staff portal (see [Staff calendar](article:staff.calendar)).
