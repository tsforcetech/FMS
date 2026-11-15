---
id: tasks.lifecycle
title: Task statuses and what can happen next
module: Task Management
category: daily-tasks
audience: public
apps: [admin, staff, mobile]
roles:
  [
    owner,
    admin,
    site_manager,
    department_manager,
    supervisor,
    technician,
    staff,
  ]
version: '0.3'
reviewed: '2026-11-15'
owner: Task Management
description: The nine task statuses, the actions that move a task between them and who may take each action.
routes: [/tasks]
screenshots: [phase4-task-desktop.png, phase5-11-rework.png, admin-tasks.png]
diagrams: [wf-28, wf-30]
related:
  [
    tasks.register,
    tasks.execution,
    tasks.approvals,
    tasks.history,
    staff.rework,
    ts.task-overdue,
    ts.cannot-submit,
  ]
sources:
  - packages/shared/src/tasks.ts
  - firebase/firestore.rules
  - apps/admin-web/src/management/tasksStore.ts
keywords:
  [
    status,
    pending,
    assigned,
    in progress,
    paused,
    awaiting approval,
    rework required,
    rejected,
    completed,
    cancelled,
    overdue,
    state machine,
  ]
---

Every task moves through a fixed set of statuses. Only the actions listed below are possible, and
every action is recorded in the task's timeline with who did it and when.

![The Task management → Task register screen](screens/admin-tasks.png)

## Statuses

| Status              | Meaning                                                             |
| ------------------- | ------------------------------------------------------------------- |
| _Pending_           | Created with nobody assigned. Waits in the unassigned queue.        |
| _Assigned_          | One or more employees are responsible; work has not started.        |
| _In progress_       | An assignee has started the checklist.                              |
| _Paused_            | Work was started and then paused.                                   |
| _Awaiting approval_ | The checklist was submitted and the template requires approval.     |
| _Rework required_   | A reviewer returned the submission with a reason.                   |
| _Completed_         | Approved, or submitted on a template that needs no approval. Final. |
| _Rejected_          | A reviewer rejected the submission and closed the task. Final.      |
| _Cancelled_         | Cancelled with a reason. Final.                                     |

_Pending_, _Assigned_, _In progress_, _Paused_, _Awaiting approval_ and _Rework required_ are **open**.
_Completed_, _Rejected_ and _Cancelled_ are **final**: nothing can change them.

## Actions

| Action (timeline label)             | From                                                    | To                                                           | Who                                                   |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| Assign (_Assigned_)                 | Pending, Assigned, Paused                               | Assigned                                                     | Owner, admin, or a supervisor role in the task's site |
| Start (_Started_)                   | Assigned                                                | In progress                                                  | An assignee (or owner/admin)                          |
| Pause (_Paused_)                    | In progress                                             | Paused                                                       | An assignee (or owner/admin)                          |
| Resume (_Resumed_)                  | Paused                                                  | In progress                                                  | An assignee (or owner/admin)                          |
| Submit (_Submitted_)                | In progress                                             | Awaiting approval, or Completed when no approval is required | An assignee (or owner/admin)                          |
| Approve (_Approved_)                | Awaiting approval                                       | Completed                                                    | A reviewer who did **not** submit the work            |
| Request rework (_Rework requested_) | Awaiting approval                                       | Rework required                                              | A reviewer, with a reason                             |
| Reject (_Rejected_)                 | Awaiting approval                                       | Rejected                                                     | A reviewer, with a reason                             |
| Start rework (_Rework started_)     | Rework required                                         | In progress                                                  | An assignee (or owner/admin)                          |
| Cancel (_Cancelled_)                | Pending, Assigned, In progress, Paused, Rework required | Cancelled                                                    | Owner or admin, with a reason                         |

Supervisor roles are _supervisor_, _site manager_ and _department manager_; they act only on tasks in
the sites they are assigned to. A task can also be **rescheduled** (_Rescheduled_) while it is
_Pending_, _Assigned_, _Paused_ or _Rework required_.

![A completed task on its second attempt, with the timeline and reviews tabs](screens/phase4-task-desktop.png)

{{diagram wf-28}}

## Rework and attempts

When a reviewer requests rework, the assignee selects **Start rework**. The task returns to _In
progress_ as a new **attempt**: the previous submission stays visible under **Submissions &
reviews** and can never be edited. The attempt number is shown on the task.

{{diagram wf-30}}

![Staff view of a task returned for rework with the reviewer's reason](screens/phase5-11-rework.png)

## Overdue

A task is **overdue** when its due time has passed and it is not completed, rejected or cancelled.
Overdue is a flag, not a status: the task keeps its status and can still be finished. Reports treat a
task awaiting approval as not overdue because the work is done and only the review is outstanding.

## Common errors

| Message                                                                    | Why                                                  | What to do                                                |
| -------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------- |
| _Only tasks in progress can be submitted._                                 | The task is paused, assigned or already submitted.   | Start or resume the task first.                           |
| _This task is not awaiting approval._                                      | Someone already decided, or the task changed.        | Reload and check the timeline.                            |
| _You submitted this work, so another authorised reviewer must approve it._ | Self-approval is blocked.                            | Ask another reviewer.                                     |
| _A … task cannot be rescheduled._                                          | The task is in progress, awaiting approval or final. | Only pending, assigned, paused and rework tasks can move. |

## Troubleshooting

- **A completed task is wrong:** completed tasks cannot be reopened. Create a new task (or a work
  order for the fault) and explain the link in its instructions.
- **A task is late:** see [Task overdue](article:ts.task-overdue).
