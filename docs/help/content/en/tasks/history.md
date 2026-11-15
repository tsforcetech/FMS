---
id: tasks.history
title: Review task history and issues
module: Task Management
category: daily-tasks
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.3'
reviewed: '2026-11-15'
owner: Task Management
description: See every recorded task action across the company and the issues raised from checklists.
routes: [/task-history]
permissions:
  - Company owner or admin
screenshots: [phase4-08-task-history.png, admin-task-history.png]
related: [tasks.lifecycle, cases.reported-issues, setup.audit, reports.tasks]
sources:
  - apps/admin-web/src/management/Tasks.tsx
  - packages/shared/src/tasks.ts
keywords:
  [timeline, activity, audit, who did what, issues, acknowledged, closed]
---

Every action on a task — _Created_, _Assigned_, _Started_, _Paused_, _Resumed_, _Submitted_,
_Approved_, _Rework requested_, _Rejected_, _Rework started_, _Cancelled_, _Rescheduled_ — is stored as
an event that cannot be edited or deleted. **Task history** shows those events for the whole company.

![The Task management → Task history screen](screens/admin-task-history.png)

## Steps

1. Open **Task management → Task history**.
2. On the **Activity** tab, read the most recent events first. Each shows the action, the task, who
   did it and when. Select **Load more** for older events.
3. Select an event to open its task. The task's own **Timeline** tab shows the same events for that
   task only, including reasons for cancelling, rework or rescheduling.
4. Switch to the **Issues** tab and choose **Open**, **Acknowledged** or **Closed** to see issues raised
   from checklists and from **Report an issue**.

![Task history with activity events](screens/phase4-08-task-history.png)

## Expected result

You can answer "who did what, and when" for any task without asking the team.

## Common errors

| Message                | Why                           | What to do                      |
| ---------------------- | ----------------------------- | ------------------------------- |
| _No task activity yet_ | No task has been created yet. | Create or generate tasks first. |

## Troubleshooting

- **Changes to other records** (sites, employees, settings) are not task events. Use the company
  [audit history](article:setup.audit).
- **Counts over a period** (completed, overdue, rework) are in [Task performance](article:reports.tasks).
- **Working on issues** (acknowledge, close, create a work order, escalate) is done on
  [Reported issues](article:cases.reported-issues).
