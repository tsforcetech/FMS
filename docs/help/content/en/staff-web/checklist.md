---
id: staff.checklist
title: Complete a checklist task
module: Staff Web
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [staff, technician, supervisor]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: Start a task, answer the checklist step by step, review your answers and submit.
routes: [/task/:id]
prerequisites:
  - The task is assigned to you and is at one of your sites
screenshots: [phase5-06-checklist-step.png, phase5-07-review.png]
diagrams: [wf-27, wf-28]
related: [staff.tasks, staff.rework, staff.report-issue, ts.cannot-submit, ts.evidence-missing, mobile.photos, train.first-checklist]
sources:
  - apps/staff-web/src/screens/TaskView.tsx
  - apps/staff-web/src/i18n.tsx
  - packages/shared/src/tasks.ts
keywords: ["checklist", "Start task", "Pause", "Resume", "Save progress", "Review answers", "Submit for approval", "Mark as completed", "Complete the highlighted answers first.", "failed checks"]
---

A checklist task asks you questions one step at a time — for example *Floor mopped?*, *Temperature
reading* or *Any damage?*. When you finish, you review your answers and submit.

## Before you start

- Open the task from **Home** or **My tasks**.
- Read the **Instructions** at the top of the task.

## Steps

1. Select **Start task**. The status changes to *In progress*.
2. Answer the question on the screen. The top shows **Step 1 of 8** (for example).
3. Select **Next** to go to the next step. Some questions appear only after a certain answer.
4. If you must stop, select **Save progress** (*Progress saved.*) and then **Pause**. Later
   select **Resume** or **Continue task**.
5. After the last step select **Review answers**. Check the **Failed checks** list (or *All
   checks passed.*) and add **Remarks (optional)**.
6. Select **Submit for approval** — or **Mark as completed** if the task does not need approval.
7. If something is broken, select **Report problem** at any time (see
   [Report a problem](article:staff.report-issue)).

![One checklist step](screens/phase5-06-checklist-step.png)

{{diagram wf-27}}

## Expected result

- **Submit for approval** shows *Submitted. Your supervisor will review it.* The task is *Waiting for
  approval*.
- **Mark as completed** shows *Task completed.*
- Every action is written in the **Task history**.

![Review answers before submitting](screens/phase5-07-review.png)

{{diagram wf-28}}

> **Note:** Photo, QR and GPS questions are captured in the mobile app. On the staff web they are
> shown as *Photo / QR / GPS evidence will be captured in the mobile app; it is recorded as
> pending.* They do not stop you from submitting.

> **Warning:** If you leave the page with answers you did not save, you see *You have unsaved
> answers. Leave without saving?* Choose to stay and select **Save progress** first.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Complete the highlighted answers first.* | A required answer is empty or out of range. | Go to the highlighted step and answer it. |
| *You are offline. Your answers stay on this screen; save when the connection returns.* | The web app lost its connection. | Keep the page open, reconnect, then **Save progress**. |
| *You do not have permission for this. Ask your supervisor.* | The task is no longer assigned to you or your access changed. | Ask your supervisor. |

## Troubleshooting

See [Cannot submit a task](article:ts.cannot-submit) and [Evidence missing](article:ts.evidence-missing).
