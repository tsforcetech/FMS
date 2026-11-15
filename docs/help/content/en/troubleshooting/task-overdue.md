---
id: ts.task-overdue
title: Task overdue
module: Troubleshooting
category: technical-support
audience: public
apps: [staff, mobile, admin]
roles: [staff, technician, supervisor, admin]
version: '0.5'
reviewed: '2026-11-15'
owner: Support
description: Why a task is shown as overdue and what to do about it.
routes: []
screenshots: [phase5-04-my-day.png, phase4-09-task-dashboard.png]
related: [staff.my-day, tasks.lifecycle, tasks.dashboard, cases.sla]
sources:
  - packages/shared/src/tasks.ts
  - apps/staff-web/src/screens/MyTasks.tsx
keywords: ['overdue', 'late', 'missed', 'due time', 'Overdue tab']
---

## Symptom

The task is in the **Overdue** tile or tab, or is marked overdue on the task dashboard.

![Overdue count on My Day](screens/phase5-04-my-day.png)

## Likely cause

The due time has passed and the task is still open (not completed, rejected or cancelled). A task
_Waiting for approval_ also counts until it is reviewed.

## How to check

Open the task and look at its due time and **Task history**.

## Resolution

- Staff: you can still open and finish the task; overdue does not lock it. Tell your supervisor if
  you cannot do it.
- Supervisor: review submitted work, reassign or reschedule the task, or cancel it with a reason.

![Task dashboard with overdue tasks](screens/phase4-09-task-dashboard.png)

## Who can fix it

**Staff** (finish the work); **supervisor** or **admin** (review, reassign, cancel).

## Related

[Task lifecycle](article:tasks.lifecycle) · [Task dashboard](article:tasks.dashboard)
