---
id: tasks.approvals
title: Approve, return or reject submitted work
module: Task Management
category: daily-tasks
audience: public
apps: [admin, staff]
roles: [owner, admin, site_manager, department_manager, supervisor]
version: '0.3'
reviewed: '2026-11-15'
owner: Task Management
description: Review a submitted checklist and approve it, send it back for rework with a reason, or reject and close it.
routes: [/approvals]
prerequisites:
  - A task on a template that requires approval has been submitted
permissions:
  - Admin app — company owner or admin
  - Staff web — supervisor, site manager or department manager for the task's site
  - Nobody may approve work they submitted themselves
screenshots: [phase4-task-desktop.png, admin-approvals.png]
diagrams: [wf-29, wf-30]
related:
  [
    tasks.lifecycle,
    tasks.execution,
    staff.supervisor,
    staff.rework,
    templates.raci,
    train.approve-inspection,
  ]
sources:
  - apps/admin-web/src/management/Tasks.tsx
  - apps/admin-web/src/management/tasksStore.ts
  - firebase/firestore.rules
keywords:
  [
    approve,
    review,
    rework,
    reject,
    supervisor approval,
    self-approval,
    You submitted this work,
    A decision was already recorded,
    Enter a reason so the team knows what to correct,
  ]
---

When a template has **Approval required** switched on, a submitted task waits as _Awaiting approval_
until a reviewer decides. Every decision is **permanent** and is kept with the submission it belongs to.

> **Note:** RACI on the template describes who is _accountable_; it does not grant approval rights.
> Who may approve is decided by company role and site scope, checked by the security rules.

![The Task management → Pending approvals screen](screens/admin-approvals.png)

## Before you start

- In the admin app, reviewers must be company **owners** or **admins**.
- Supervisors, site managers and department managers review in the **staff web portal** for the sites
  they are assigned to (see [Supervisor tools](article:staff.supervisor)).
- You **cannot approve work you submitted** — another authorised reviewer must do it.

## Steps

1. Open **Task management → Pending approvals**. The list **Submissions awaiting review** shows each
   submitted task.
2. Open a task and read the **Submissions & reviews** tab: the answers, any exceptions and the
   submitter.
3. Decide:
   - **Approve** — confirm _Approve this submission?_ The task becomes _Completed_ (_Submission
     approved._).
   - **Request rework** — answer _What needs to be corrected?_ The task becomes _Rework required_ and
     the assignees are notified (_Rework requested._).
   - **Reject** — confirm _Reject and close this task?_ with a _Reason for rejection_. The task becomes
     _Rejected_ and is closed (_Submission rejected._).

![Submissions and reviews on a task that was returned once and approved on attempt 2](screens/phase4-task-desktop.png)

{{diagram wf-29}}

## Expected result

- The decision, reviewer, time and reason are stored on that attempt and shown in the timeline.
- After rework the assignee selects **Start rework**, completes the checklist again and resubmits as a
  new attempt; the earlier submission stays visible.

{{diagram wf-30}}

## Common errors

| Message                                                                    | Why                                   | What to do                                   |
| -------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------- |
| _You submitted this work, so another authorised reviewer must approve it._ | Self-approval is blocked.             | Ask another owner, admin or site supervisor. |
| _Enter a reason so the team knows what to correct._                        | Rework or rejection needs a reason.   | Type the reason.                             |
| _A decision was already recorded for this attempt._                        | Another reviewer decided first.       | Reload; the existing decision stands.        |
| _This task is not awaiting approval._                                      | The task changed since you opened it. | Reload the task.                             |

## Troubleshooting

- **A supervisor cannot see the submission:** the supervisor's employee record must be linked to their
  login and assigned to the task's site. Do not widen their role or the security rules — assign the
  site instead (see [Access denied](article:ts.access-denied)).
- **Approval is not needed for this kind of work:** create a new template version with **Approval
  required** switched off (see [Publish a checklist version](article:templates.publish)). Tasks already
  created keep the version they were created with.
