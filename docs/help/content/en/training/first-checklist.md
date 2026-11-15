---
id: train.first-checklist
title: 'Quick start: fill in your first checklist'
module: Training & Quick Starts
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [technician, staff, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Answer checklist questions step by step, review and submit.
routes: ['/task/:id']
screenshots: [phase5-06-checklist-step.png, phase5-07-review.png]
diagrams: [wf-27, wf-28]
related: [staff.checklist, train.first-task, staff.rework, mobile.photos]
sources:
  - apps/staff-web/src/screens/TaskView.tsx
  - apps/staff-web/src/i18n.tsx
keywords: [checklist, questions, answers, review answers, save progress, evidence]
---

1. Open the task and tap **Start task**, then **Open checklist**.
2. Read the question and any help text. **Required** questions must be answered.
3. Choose or type your answer and tap **Next**. Use **Back** to return.
4. Some questions appear only after a certain answer — that is normal.
5. Tap **Save progress** if you must stop; your answers are kept (*Progress saved.*).
6. Photo, QR or GPS evidence is captured in the mobile app; in the Staff web it is recorded as
   pending.
7. Tap **Review answers**. **Failed checks** are listed; add **Remarks (optional)** if useful.
8. Fix anything marked *Complete the highlighted answers first.*
9. Tap **Submit for approval** or **Mark as completed**.

![A checklist step](screens/phase5-06-checklist-step.png)

![Review answers before submitting](screens/phase5-07-review.png)

Full guide: [Fill in a checklist](article:staff.checklist).
