---
id: staff.tasks
title: Find your tasks (My tasks and History)
module: Staff Web
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [staff, technician, supervisor]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: Use the My tasks tabs, search and filters to find a task, and History to see finished work.
routes: [/tasks, /history]
screenshots: [staff-tasks.png, phase5-05-task-detail.png]
related:
  [staff.my-day, staff.checklist, staff.rework, ts.no-tasks, ts.task-overdue]
sources:
  - apps/staff-web/src/screens/MyTasks.tsx
  - apps/staff-web/src/i18n.tsx
keywords:
  [
    'My tasks',
    'Search tasks',
    'Any priority',
    'All my sites',
    'upcoming',
    'overdue',
    'rework',
    'history',
    'completed',
  ]
---

**My tasks** lists every task assigned to you, grouped in tabs. **History** lists work you have
finished or submitted.

## Steps

1. Select **My tasks** in the bottom bar.
2. Choose a tab:
   - **Today** — tasks due today (you can change the date on this tab).
   - **Upcoming** — tasks due later.
   - **In progress** — tasks you started or paused.
   - **Overdue** — tasks past their due time and not finished.
   - **Rework** — tasks your supervisor returned for correction.
   - **Completed** — tasks you finished.
3. To narrow the list, type in **Search tasks**, choose a priority (**Any priority**) or, if you
   work at more than one site, a site (**All my sites**).
4. Select a task to open it. The task page shows **Instructions**, the checklist and **Task history**.
5. To see older work, open **History**. It lists completed, rejected, cancelled and _Waiting for
   approval_ tasks.

![My tasks with tabs and filters](screens/staff-tasks.png)

## Expected result

The task opens with buttons that match its status — for example **Start task** for a new task or
**Continue task** for one you started. See [Complete a checklist](article:staff.checklist).

![A task with instructions and the Start task button](screens/phase5-05-task-detail.png)

## Common errors

| Message                                                     | Why                                                                    | What to do                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| Empty list                                                  | No task matches the tab, search or filters.                            | Clear the search, set **Any priority** and **All my sites**. |
| _You do not have permission for this. Ask your supervisor._ | The task is not assigned to you or is at a site you are not linked to. | Ask your supervisor to assign it to you.                     |

## Troubleshooting

- A task you expect is missing: check the **Upcoming** tab and see [No tasks showing](article:ts.no-tasks).
