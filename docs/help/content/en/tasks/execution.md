---
id: tasks.execution
title: Complete a checklist and submit a task
module: Task Management
category: daily-tasks
audience: public
apps: [admin, staff, mobile]
roles: [owner, admin, supervisor, technician, staff]
version: '0.3'
reviewed: '2026-11-15'
owner: Task Management
description: Start a task, answer each checklist question, save progress, raise issues and submit the answers for review.
routes: [/tasks]
prerequisites:
  - The task is assigned to you (or you are a company owner or admin)
permissions:
  - Assigned staff in the task's site, or company owner or admin
screenshots:
  [phase4-07-task-execution.png, phase5-06-checklist-step.png, admin-tasks.png]
diagrams: [wf-27, wf-28]
related:
  [
    tasks.lifecycle,
    staff.checklist,
    mobile.tasks,
    cases.reported-issues,
    ts.cannot-submit,
    ts.evidence-missing,
    templates.builder,
  ]
sources:
  - packages/shared/src/tasks.ts
  - apps/admin-web/src/management/Tasks.tsx
  - apps/admin-web/src/management/tasksStore.ts
keywords:
  [
    checklist,
    answer,
    submit,
    save progress,
    reading,
    out of range,
    exception,
    Start the task before saving answers,
    Complete required answers,
    Required,
    Enter a whole number,
  ]
---

Staff normally complete checklists in the **staff web portal** or the **mobile app** (see
[Complete a checklist (staff)](article:staff.checklist)). Owners and admins can also do it from the
admin app — the rules and answers are the same everywhere.

![The Task management → Task register screen](screens/admin-tasks.png)

## Before you start

- The task must be _Assigned_ (or _Paused_ / _Rework required_) and you must be one of its assignees,
  or a company owner or admin.
- Read the **Instructions** banner on the **Checklist** tab.

## Steps

1. Open the task and select **Start task**. The status becomes _In progress_ and the start time is
   recorded.
2. Answer each question. Answer types include _Yes / No_, _Pass / Fail_, _Single choice_, _Multiple
   choice_, _Whole number_, _Decimal number_, _Temperature_, _Reading with unit_, _Short text_ (up to
   500 characters), _Long text_ (up to 4,000), _Date_, _Time_ and _Asset condition_ (_Excellent_,
   _Good_, _Fair_, _Poor_, _Critical_).
3. Some questions appear only after a certain answer to another question (conditional questions).
4. Select **Save progress** to keep a draft (_Progress saved._). You can **Pause** and **Resume** later.
5. If you find a problem that the checklist does not cover, select **Report an issue**, describe it and
   choose the severity (_Warning_ or _Critical_).
6. Select **Submit checklist** and confirm. The confirmation reminds you that **submitted answers are
   permanent** and lists any exceptions found.

![Checklist being completed with readings and pass/fail checks](screens/phase4-07-task-execution.png)

{{diagram wf-27}}

## Expected result

- If the template requires approval: _Submitted for approval._ — the task is _Awaiting approval_ and
  reviewers are notified.
- Otherwise: _Task completed._ — the task is _Completed_ immediately.
- Answers that break the template's limits are recorded as **exceptions** and appear under
  **Reported issues**:
  - a reading outside the **critical** limits → critical;
  - a reading outside the **expected** range → warning (critical if the question escalates on failure);
  - _Fail_ on a pass/fail check → warning (critical if it escalates on failure);
  - _No_ on a yes/no question that escalates on failure → warning;
  - condition _Poor_ → warning (critical if it escalates); condition _Critical_ → critical.

![Staff portal checklist step on a phone](screens/phase5-06-checklist-step.png)

## Photo, QR and GPS evidence

Photo, QR verification and GPS location answers are captured in the **mobile app**. Templates
cannot make these answers _required_ until file storage and the mobile app are available for the
company; the admin and staff web show _This evidence type is not available yet_ for them. See
[Evidence missing](article:ts.evidence-missing).

## Common errors

| Message                                                       | Why                                                              | What to do                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| _Start the task before saving answers._                       | The task is not in progress.                                     | Select **Start task** (or **Resume** / **Start rework**).     |
| _Complete N required or invalid answer(s) before submitting._ | Required answers are empty or invalid.                           | Fix the highlighted questions.                                |
| _Required_                                                    | A required question is empty.                                    | Answer it.                                                    |
| _Enter a whole number_ / _Enter a number (up to 4 decimals)_  | The value is not a number of the right kind.                     | Type digits only.                                             |
| _Must be at least …_ / _Must be at most …_                    | The value is outside the allowed minimum/maximum.                | Re-measure; values outside the allowed range cannot be saved. |
| _This attempt was already submitted._                         | The answers were sent already (for example from another device). | Reload the task.                                              |
| _Issues can only be reported on open tasks._                  | The task is final.                                               | Report a new problem as a work order or complaint.            |
| _Describe the issue._                                         | The issue description is empty.                                  | Add a description.                                            |

## Troubleshooting

- **Cannot submit:** see [Cannot submit a task](article:ts.cannot-submit).
- **"Allowed" vs "expected":** _Minimum/Maximum allowed_ rejects the value; _Expected from/to_ and
  _Critical below/above_ accept it but raise an exception. Template authors set these in the
  [template builder](article:templates.builder).
