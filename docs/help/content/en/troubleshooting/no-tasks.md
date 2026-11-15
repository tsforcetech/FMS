---
id: ts.no-tasks
title: No tasks showing
module: Troubleshooting
category: technical-support
audience: public
apps: [staff, mobile, admin]
roles: [staff, technician, supervisor, admin, owner]
version: '0.6'
reviewed: '2026-11-15'
owner: Support
description: A staff member sees "No tasks for today" although work was expected.
routes: []
screenshots: [phase5-04-my-day.png, phase4-17-scheduler-monitor.png]
related: [staff.my-day, ts.scheduler-not-active, ts.no-eligible-staff, ts.wrong-site, scheduling.generation, tasks.assignments]
sources:
  - apps/staff-web/src/screens/MyDay.tsx
  - apps/staff-web/src/screens/MyTasks.tsx
  - apps/admin-web/src/management/Notifications.tsx
keywords: ["no tasks", "No tasks for today", "empty", "missing tasks", "nothing assigned"]
---

## Symptom

**Home** shows **No tasks for today** — *When your supervisor assigns work, it appears here.* — or
**My tasks** is empty.

![My Day](screens/phase5-04-my-day.png)

## Likely cause

1. Recurring tasks were not generated yet because the scheduler has not run.
2. The task was created but left **unassigned** (nobody eligible) or assigned to someone else.
3. The task is at a site not linked to your login.
4. You are on approved leave or have no shift that day, so the scheduler skipped you.
5. In the mobile app offline: the phone has not synced since the task was assigned.

## How to check

1. Staff: check **My tasks → Upcoming** and clear search and filters.
2. Mobile: open **Sync status** and select **Sync now** while online.
3. Supervisor or admin: open **Task management → Task register** and search for the task — check
   its assignee and site.
4. Admin: open **Administration → Scheduler monitor** and look for *No server run recorded yet*.

![Scheduler monitor](screens/phase4-17-scheduler-monitor.png)

## Resolution

- Scheduler not run → see [Scheduler not activated](article:ts.scheduler-not-active).
- Unassigned → assign it in **Task management → Task assignments**; see
  [No eligible staff](article:ts.no-eligible-staff).
- Wrong site → see [Wrong site](article:ts.wrong-site).

## Who can fix it

**Supervisor** (assignment), **admin** or **owner** (scheduler, site links).

## Related

[How tasks are generated](article:scheduling.generation) · [Task assignments](article:tasks.assignments)
