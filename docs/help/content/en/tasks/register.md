---
id: tasks.register
title: Create and manage tasks in the task register
module: Task Management
category: daily-tasks
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.3'
reviewed: '2026-11-15'
owner: Task Management
description: Create a one-off task from a published template, assign it, and find, filter, export or cancel tasks.
routes: [/tasks]
prerequisites:
  - A task template with a published checklist version
  - An active site (and location, facility or asset if the work is for one)
  - Active employees to assign
permissions:
  - Company owner or admin
screenshots: [phase4-task-desktop.png]
diagrams: [wf-24]
related: [templates.publish, tasks.lifecycle, tasks.execution, tasks.assignments, scheduling.recurring, ts.no-tasks]
sources:
  - apps/admin-web/src/management/Tasks.tsx
  - apps/admin-web/src/management/tasksStore.ts
  - packages/shared/src/tasks.ts
keywords: [new task, one-off task, manual task, filter tasks, cancel task, TSK, Choose a published template version, Assign at most 10 employees, The due time must be after the planned start]
---

The **task register** lists every task in the company — manual, recurring and preventive maintenance —
and is where you create a one-off task. Each task is a copy of a published checklist with its own site,
due time, assignees and history. Task references look like `TSK-261115-1CX3EL`.

> **Note:** Tasks belong to physical sites, never to a client. Contracts and allocations decide which
> client a site serves; the task itself is always tied to the site.

## Before you start

- Publish the checklist you want to use (see [Publish a checklist version](article:templates.publish)).
  Templates without a published version are not offered.
- Check that the site, and any location, facility or asset you want to choose, is active.

## Steps

1. Open **Task management → Task register** and select **New task**.
2. Choose the **Task template**. The task title, priority, instructions and checklist come from the
   published version.
3. Choose the **Site**. Optionally choose a **Location**, **Facility** or **Asset** inside that site and
   a **Responsible department**.
4. Set the **Priority**, the **Planned start** and the **due** time. The due time must be after the
   planned start.
5. Under **Assign employees** add up to 10 active employees, or leave it empty. With no assignee the
   task starts as *Pending* ("No assignee — starts as Pending") and waits in
   [Task assignments](article:tasks.assignments).
6. Add **Additional instructions** if the staff need more than the template says.
7. Save. The toast *Task created.* confirms it and the task opens.

![A task opened from the task register with its checklist, timeline and reviews](screens/phase4-task-desktop.png)

{{diagram wf-24}}

### Find tasks

- Use the status filter (**All statuses** by default) and **Filter by** *Site*, *Department*,
  *Priority* or *Assignee*.
- Open a task to see the tabs **Checklist**, **Submissions & reviews**, **Issues**, **Template & RACI**
  and **Timeline**.
- Use **Export** to download the filtered list as Excel or PDF.

### Assign, reassign or cancel

- **Assign task** / **Reassign** on an open task chooses new assignees (pending, assigned or paused
  tasks).
- **Cancel task** asks for a reason, which is kept in the timeline. Pending, assigned, in-progress,
  paused and rework tasks can be cancelled; completed, rejected and cancelled tasks cannot.

## Expected result

The task appears in the register with status *Assigned* (or *Pending* without an assignee). Assigned
staff who are linked to a login receive an in-app notification and see the task in **My Day**.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Choose a published template version.* | The template has no published version. | Publish the template first. |
| *Choose an active site.* | The site is archived or inactive. | Choose another site or reactivate it. |
| *The selected location/facility/asset must be active and in this site.* | The place belongs to another site or is archived. | Pick a place from the chosen site. |
| *Assign at most 10 employees.* | More than 10 people selected. | Remove some assignees. |
| *Assign active employees only.* | An employee is inactive or archived. | Choose active employees. |
| *The due time must be after the planned start.* | The due time is before the start. | Correct the times. |
| *Enter a valid date and time.* | A date field is empty or invalid. | Fill in both dates. |
| *Enter a reason for cancelling.* | Cancel was confirmed without a reason. | Type a reason. |
| *This task was updated by someone else. It has been reloaded; please review and try again.* | Another person changed the task at the same time. | Check the reloaded task and repeat your action. |

## Troubleshooting

- **Staff cannot see the task:** the employee must be linked to a staff login and assigned to the
  task's site (see [Staff access](article:setup.staff-access)).
- **No tasks at all:** see [No tasks appear](article:ts.no-tasks).
- **Repeating work:** create a [recurring task](article:scheduling.recurring) instead of copying tasks
  by hand.
