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
screenshots: [phase4-07-task-execution.png, phase5-06-checklist-step.png]
diagrams: [wf-27, wf-28]
related: [tasks.lifecycle, staff.checklist, mobile.tasks, cases.reported-issues, ts.cannot-submit, ts.evidence-missing, templates.builder]
sources:
  - packages/shared/src/tasks.ts
  - apps/admin-web/src/management/Tasks.tsx
  - apps/admin-web/src/management/tasksStore.ts
keywords: [checklist, answer, submit, save progress, reading, out of range, exception, Start the task before saving answers, Complete required answers, Required, Enter a whole number]
---

Staff normally complete checklists in the **staff web portal** or the **mobile app** (see
[Complete a checklist (staff)](article:staff.checklist)). Owners and admins can also do it from the
admin app — the rules and answers are the same everywhere.

## Before you start

- The task must be *Assigned* (or *Paused* / *Rework required*) and you must be one of its assignees,
  or a company owner or admin.
- Read the **Instructions** banner on the **Checklist** tab.

## Steps

1. Open the task and select **Start task**. The status becomes *In progress* and the start time is
   recorded.
2. Answer each question. Answer types include *Yes / No*, *Pass / Fail*, *Single choice*, *Multiple
   choice*, *Whole number*, *Decimal number*, *Temperature*, *Reading with unit*, *Short text* (up to
   500 characters), *Long text* (up to 4,000), *Date*, *Time* and *Asset condition* (*Excellent*,
   *Good*, *Fair*, *Poor*, *Critical*).
3. Some questions appear only after a certain answer to another question (conditional questions).
4. Select **Save progress** to keep a draft (*Progress saved.*). You can **Pause** and **Resume** later.
5. If you find a problem that the checklist does not cover, select **Report an issue**, describe it and
   choose the severity (*Warning* or *Critical*).
6. Select **Submit checklist** and confirm. The confirmation reminds you that **submitted answers are
   permanent** and lists any exceptions found.

![Checklist being completed with readings and pass/fail checks](screens/phase4-07-task-execution.png)

{{diagram wf-27}}

## Expected result

- If the template requires approval: *Submitted for approval.* — the task is *Awaiting approval* and
  reviewers are notified.
- Otherwise: *Task completed.* — the task is *Completed* immediately.
- Answers that break the template's limits are recorded as **exceptions** and appear under
  **Reported issues**:
  - a reading outside the **critical** limits → critical;
  - a reading outside the **expected** range → warning (critical if the question escalates on failure);
  - *Fail* on a pass/fail check → warning (critical if it escalates on failure);
  - *No* on a yes/no question that escalates on failure → warning;
  - condition *Poor* → warning (critical if it escalates); condition *Critical* → critical.

![Staff portal checklist step on a phone](screens/phase5-06-checklist-step.png)

## Photo, QR and GPS evidence

Photo, QR verification and GPS location answers are captured in the **mobile app**. Templates
cannot make these answers *required* until file storage and the mobile app are available for the
company; the admin and staff web show *This evidence type is not available yet* for them. See
[Evidence missing](article:ts.evidence-missing).

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Start the task before saving answers.* | The task is not in progress. | Select **Start task** (or **Resume** / **Start rework**). |
| *Complete N required or invalid answer(s) before submitting.* | Required answers are empty or invalid. | Fix the highlighted questions. |
| *Required* | A required question is empty. | Answer it. |
| *Enter a whole number* / *Enter a number (up to 4 decimals)* | The value is not a number of the right kind. | Type digits only. |
| *Must be at least …* / *Must be at most …* | The value is outside the allowed minimum/maximum. | Re-measure; values outside the allowed range cannot be saved. |
| *This attempt was already submitted.* | The answers were sent already (for example from another device). | Reload the task. |
| *Issues can only be reported on open tasks.* | The task is final. | Report a new problem as a work order or complaint. |
| *Describe the issue.* | The issue description is empty. | Add a description. |

## Troubleshooting

- **Cannot submit:** see [Cannot submit a task](article:ts.cannot-submit).
- **"Allowed" vs "expected":** *Minimum/Maximum allowed* rejects the value; *Expected from/to* and
  *Critical below/above* accept it but raise an exception. Template authors set these in the
  [template builder](article:templates.builder).
