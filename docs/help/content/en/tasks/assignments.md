---
id: tasks.assignments
title: Assign tasks and balance staff workload
module: Task Management
category: daily-tasks
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Task Management
description: Clear the unassigned queue and compare each person's planned work, shift hours and leave before assigning.
routes: [/task-assignments, /staff-workload, /site-team-view]
permissions:
  - Company owner or admin
screenshots:
  [
    phase4-15-staff-workload.png,
    phase4-12b-calendar-staff.png,
    admin-task-assignments.png,
    admin-staff-workload.png,
    admin-site-team-view.png,
  ]
diagrams: [wf-24]
related:
  [
    tasks.register,
    scheduling.assignment,
    calendar.task-calendar,
    ts.no-eligible-staff,
    people.shifts,
    people.leave,
  ]
sources:
  - apps/admin-web/src/management/Tasks.tsx
  - apps/admin-web/src/management/Calendar.tsx
  - apps/admin-web/src/management/tasksStore.ts
keywords:
  [
    unassigned,
    queue,
    reassign,
    workload,
    capacity,
    leave,
    shift hours,
    Choose at least one employee,
  ]
---

Tasks without an assignee are _Pending_ and wait in the **unassigned queue**. This happens when a task
is created without assignees, when a schedule uses _Leave unassigned (queue)_, or when the scheduler
finds nobody eligible on that day.

![The Task management → Task assignments screen](screens/admin-task-assignments.png)

![The Task management → Staff workload screen](screens/admin-staff-workload.png)

![The Task management → Site & team view screen](screens/admin-site-team-view.png)

## Before you start

- Keep shifts and approved leave up to date (see [Shifts](article:people.shifts) and
  [Leave](article:people.leave)) — the workload view uses them.

## Steps

### Clear the unassigned queue

1. Open **Task management → Task assignments**.
2. Choose **Unassigned tasks**. The list **Waiting for assignment** shows pending tasks.
3. Open a task and select **Assign task**, choose one or more active employees (up to 10) and save.
   The task becomes _Assigned_ (_Task assigned._).

To see what one person already has, choose **Workload by employee** and pick the **Employee**.

### Compare workload before assigning

1. Open **Task management → Staff workload**. Use the arrows to move between weeks.
2. Each row shows the employee's **Tasks**, **Overdue**, **Completed**, **Planned work** and **Shift
   hours**. A _Leave_ tag marks people on approved leave; _No shift_ marks people without a shift.
3. If a banner says _N open task(s) in the unassigned queue_, assign them from the list on the same
   page.

![Staff workload by week with planned minutes, shift hours and leave](screens/phase4-15-staff-workload.png)

### See totals by site, department or team

Open **Task management → Site & team view** and choose **Group by** _Site_, _Department_ or _Team_.
Each row shows **Total**, **Pending / assigned**, **In progress**, **Awaiting approval**,
**Completed**, **Overdue** and **Completion**.

{{diagram wf-24}}

## Expected result

The unassigned queue is empty and work is spread across the people on shift.

![Calendar staff view used to drag a task onto another person](screens/phase4-12b-calendar-staff.png)

## Common errors

| Message                         | Why                                 | What to do                 |
| ------------------------------- | ----------------------------------- | -------------------------- |
| _Choose at least one employee._ | No employee was selected.           | Select an employee.        |
| _Assign active employees only._ | The person is inactive or archived. | Choose an active employee. |
| _Assign at most 10 employees._  | Too many people selected.           | Reduce the list.           |

## Troubleshooting

- **The same tasks keep landing in the queue:** the schedule's pool has nobody eligible on those days.
  See [No eligible staff](article:ts.no-eligible-staff) and
  [Assignment strategies](article:scheduling.assignment).
- **Reassigning in bulk by date:** use the **Staff** view of the [Task calendar](article:calendar.task-calendar)
  and drag the task onto another person's row.
- Automatic, shift- and leave-aware assignment is done by recurring schedules; tasks created on this
  page are assigned by hand.
