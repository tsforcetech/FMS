---
id: train.first-task
title: 'Quick start: complete your first task'
module: Training & Quick Starts
category: getting-started
audience: public
apps: [staff, mobile]
roles: [technician, staff, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Ten steps from signing in to finishing a task in the FacilityOS Staff app.
routes: ['/', '/task/:id']
prerequisites:
  - Your login has been linked to your employee record by an administrator
screenshots: [phase5-04-my-day.png, phase5-05-task-detail.png]
diagrams: [wf-36]
related: [staff.my-day, staff.tasks, staff.checklist, train.first-checklist, staff.sign-in]
sources:
  - apps/staff-web/src/screens/MyDay.tsx
  - apps/staff-web/src/screens/TaskView.tsx
  - apps/staff-web/src/i18n.tsx
keywords: [first day, how to start, Start task, Mark as completed, My Day]
---

1. Open the FacilityOS Staff app and sign in with the email and password your supervisor gave you.
2. On **Home** (My Day) find today's tasks, ordered by due time.
3. Tap a task to open it. Read **Instructions**, **Location** and **Due**.
4. Tap **Start task** when you begin the work.
5. Tap **Open checklist** and answer each question (see
   [Your first checklist](article:train.first-checklist)).
6. Need a break? Tap **Pause**, then **Resume** later.
7. Tap **Review answers** and correct anything highlighted.
8. Tap **Submit for approval** (if your supervisor must check it) or **Mark as completed**.
9. You see *Submitted. Your supervisor will review it.* or *Task completed.*
10. Check **Alerts** later — if the work is returned, you will see *Work returned for correction*.

![My Day with today's tasks](screens/phase5-04-my-day.png)

![Task detail with Start task](screens/phase5-05-task-detail.png)

Full guide: [Work on a task](article:staff.tasks).
