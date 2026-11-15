---
id: train.cleaning-schedule
title: 'Quick start: set up a daily cleaning schedule'
module: Training & Quick Starts
category: daily-tasks
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Turn a published cleaning checklist into a daily recurring task for the right people.
routes: [/recurring-tasks, /scheduler]
permissions:
  - Company owner or admin
screenshots: [phase4-10-schedule-builder.png, phase4-17-scheduler-monitor.png]
diagrams: [wf-25, wf-26]
related: [scheduling.recurring, scheduling.generation, templates.publish, ts.scheduler-not-active]
sources:
  - apps/admin-web/src/management/Schedules.tsx
  - packages/shared/src/schedule.ts
keywords: [daily cleaning, recurring, rota, housekeeping schedule]
---

1. Make sure the cleaning checklist is **published** (**Task management → Task templates**).
2. Open **Task management → Recurring tasks** → **New recurring task**.
3. Enter a **Schedule name** and choose the **Task template**.
4. Choose the **Site** and the **Location** (for example *Ground floor lobby*).
5. Under **Repeats** choose *Every day*; set **Start date**, **Start time** and **Duration (minutes)**.
6. Choose the holiday rule, for example *Skip the occurrence*.
7. Under **Assignment** choose *Round-robin rotation* with **Pool** *Team* (your housekeeping team).
8. Check the preview of the next occurrences and select **Create schedule**.
9. Open **Administration → Scheduler monitor**; if no automatic run is shown, select **Run scheduler
   now**.
10. Check **Task management → Task calendar** for the new tasks.

![Schedule builder](screens/phase4-10-schedule-builder.png)

![Scheduler monitor](screens/phase4-17-scheduler-monitor.png)

Full guide: [Create a recurring cleaning task](article:scheduling.recurring).
