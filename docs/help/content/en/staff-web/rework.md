---
id: staff.rework
title: Correct work that was returned (rework)
module: Staff Web
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [staff, technician]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: Read your supervisor's reason, start the correction and submit the task again.
routes: [/task/:id]
screenshots: [phase5-11-rework.png]
diagrams: [wf-30]
related: [staff.checklist, staff.supervisor, tasks.approvals, ts.cannot-submit]
sources:
  - apps/staff-web/src/screens/TaskView.tsx
  - apps/staff-web/src/i18n.tsx
keywords: ["rework", "Work returned for correction", "Reason from your supervisor", "Start correction", "Previous answers", "rejected"]
---

When a supervisor reviews your task they can approve it, return it for correction or reject it.
A task returned for correction appears in the **Rework** tile on Home and the **Rework** tab of
**My tasks**.

## Steps

1. Open the task from **Home → Rework** or **My tasks → Rework**.
2. Read the banner **Work returned for correction** and the **Reason from your supervisor**.
3. Select **Start correction**. You start a new attempt; your **Previous answers** are shown so you
   can see what you answered before.
4. Fix the work on site, answer the checklist again and select **Review answers**.
5. Submit the task again.

![A task returned for correction with the supervisor's reason](screens/phase5-11-rework.png)

{{diagram wf-30}}

## Expected result

The task goes back to *Waiting for approval*. The old attempt stays in **Task history**; nothing is
deleted.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| Task shows *Rejected* with a reason | The supervisor rejected the work instead of returning it. | A rejected task cannot be redone; ask your supervisor what to do next. |

## Troubleshooting

- The reason is not clear: talk to your supervisor before you start the correction.
