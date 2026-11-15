---
id: tasks.lifecycle
title: Task statuses and what can happen next
module: Task Management
category: daily-tasks
audience: public
apps: [admin, staff, mobile]
roles: [owner, admin, site_manager, department_manager, supervisor, technician, staff]
version: '0.3'
reviewed: '2026-11-15'
owner: Task Management
description: The nine task statuses, the actions that move a task between them and who may take each action.
routes: [/tasks]
screenshots: [phase4-task-desktop.png, phase5-11-rework.png]
diagrams: [wf-28, wf-30]
related: [tasks.register, tasks.execution, tasks.approvals, tasks.history, staff.rework, ts.task-overdue, ts.cannot-submit]
sources:
  - packages/shared/src/tasks.ts
  - firebase/firestore.rules
  - apps/admin-web/src/management/tasksStore.ts
keywords: [status, pending, assigned, in progress, paused, awaiting approval, rework required, rejected, completed, cancelled, overdue, state machine]
---

Every task moves through a fixed set of statuses. Only the actions listed below are possible, and
every action is recorded in the task's timeline with who did it and when.

## Statuses

| Status | Meaning |
| --- | --- |
| *Pending* | Created with nobody assigned. Waits in the unassigned queue. |
| *Assigned* | One or more employees are responsible; work has not started. |
| *In progress* | An assignee has started the checklist. |
| *Paused* | Work was started and then paused. |
| *Awaiting approval* | The checklist was submitted and the template requires approval. |
| *Rework required* | A reviewer returned the submission with a reason. |
| *Completed* | Approved, or submitted on a template that needs no approval. Final. |
| *Rejected* | A reviewer rejected the submission and closed the task. Final. |
| *Cancelled* | Cancelled with a reason. Final. |

*Pending*, *Assigned*, *In progress*, *Paused*, *Awaiting approval* and *Rework required* are **open**.
*Completed*, *Rejected* and *Cancelled* are **final**: nothing can change them.

## Actions

| Action (timeline label) | From | To | Who |
| --- | --- | --- | --- |
| Assign (*Assigned*) | Pending, Assigned, Paused | Assigned | Owner, admin, or a supervisor role in the task's site |
| Start (*Started*) | Assigned | In progress | An assignee (or owner/admin) |
| Pause (*Paused*) | In progress | Paused | An assignee (or owner/admin) |
| Resume (*Resumed*) | Paused | In progress | An assignee (or owner/admin) |
| Submit (*Submitted*) | In progress | Awaiting approval, or Completed when no approval is required | An assignee (or owner/admin) |
| Approve (*Approved*) | Awaiting approval | Completed | A reviewer who did **not** submit the work |
| Request rework (*Rework requested*) | Awaiting approval | Rework required | A reviewer, with a reason |
| Reject (*Rejected*) | Awaiting approval | Rejected | A reviewer, with a reason |
| Start rework (*Rework started*) | Rework required | In progress | An assignee (or owner/admin) |
| Cancel (*Cancelled*) | Pending, Assigned, In progress, Paused, Rework required | Cancelled | Owner or admin, with a reason |

Supervisor roles are *supervisor*, *site manager* and *department manager*; they act only on tasks in
the sites they are assigned to. A task can also be **rescheduled** (*Rescheduled*) while it is
*Pending*, *Assigned*, *Paused* or *Rework required*.

![A completed task on its second attempt, with the timeline and reviews tabs](screens/phase4-task-desktop.png)

{{diagram wf-28}}

## Rework and attempts

When a reviewer requests rework, the assignee selects **Start rework**. The task returns to *In
progress* as a new **attempt**: the previous submission stays visible under **Submissions &
reviews** and can never be edited. The attempt number is shown on the task.

{{diagram wf-30}}

![Staff view of a task returned for rework with the reviewer's reason](screens/phase5-11-rework.png)

## Overdue

A task is **overdue** when its due time has passed and it is not completed, rejected or cancelled.
Overdue is a flag, not a status: the task keeps its status and can still be finished. Reports treat a
task awaiting approval as not overdue because the work is done and only the review is outstanding.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Only tasks in progress can be submitted.* | The task is paused, assigned or already submitted. | Start or resume the task first. |
| *This task is not awaiting approval.* | Someone already decided, or the task changed. | Reload and check the timeline. |
| *You submitted this work, so another authorised reviewer must approve it.* | Self-approval is blocked. | Ask another reviewer. |
| *A … task cannot be rescheduled.* | The task is in progress, awaiting approval or final. | Only pending, assigned, paused and rework tasks can move. |

## Troubleshooting

- **A completed task is wrong:** completed tasks cannot be reopened. Create a new task (or a work
  order for the fault) and explain the link in its instructions.
- **A task is late:** see [Task overdue](article:ts.task-overdue).
