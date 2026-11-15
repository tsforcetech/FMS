---
id: staff.my-day
title: Your day on the Home screen (My Day)
module: Staff Web
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [staff, technician, supervisor]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: See today's tasks, counts, your shift and the next task to start.
routes: [/]
prerequisites:
  - You are signed in to the staff app or mobile app
screenshots: [phase5-04-my-day.png, staff-my-day.png, phase6-01-my-day.png]
diagrams: [wf-36]
related: [staff.tasks, staff.checklist, staff.calendar, ts.no-tasks, ts.task-overdue, mobile.tasks]
sources:
  - apps/staff-web/src/screens/MyDay.tsx
  - apps/staff-web/src/i18n.tsx
  - apps/mobile/src/screens/Main.tsx
keywords: ["home", "today", "Today's work", "Start next task", "Continue task", "No tasks for today", "overdue", "shift", "leave"]
---

**Home** shows your work for today in one place: how many tasks you have, which one to do next,
and your shift. It is the first screen after you sign in, on the staff web and in the mobile app.

## Before you start

- Sign in (see [Sign in to the staff app](article:staff.sign-in)).
- Tasks appear only after your supervisor assigns them or the scheduler creates them.

## Steps

1. Open **Home**.
2. Read the **Shift today** line. It shows your shift, *No shift assigned today*, *You are on
   approved leave today* or *Holiday*.
3. Look at the tiles under **Today's work**: **Assigned**, **Pending**, **In progress**,
   **Completed**, **Overdue** and **Rework**. Select a tile to open the matching list.
4. Select **Start next task** to open the next task to do. If you already started a task, the
   button says **Continue task**.
5. Tasks you submitted are shown as **Waiting for approval** until your supervisor reviews them.

![My Day with today's counts and the next task](screens/phase5-04-my-day.png)

{{diagram wf-36}}

## Expected result

- When there is nothing to do you see **No tasks for today** — *When your supervisor assigns work,
  it appears here.*
- When everything is done you see **All of today’s work is done. Well done!**

![My Day on the staff web](screens/staff-my-day.png)

> **Tip:** In the mobile app Home also shows your check-in status. See
> [Attendance](article:mobile.attendance).

![My Day in the mobile app (Chromium runtime test, not a physical phone)](screens/phase6-01-my-day.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *No tasks for today* | Nothing is assigned to you today, or tasks were not generated yet. | Check **My tasks → Upcoming**; ask your supervisor. See [No tasks showing](article:ts.no-tasks). |
| A task is in **Overdue** | Its due time has passed and it is not finished. | Open it and finish it; see [Task overdue](article:ts.task-overdue). |
| *You are offline…* | No internet connection. | Reconnect. In the mobile app your work is kept on the device. |

## Troubleshooting

- **Counts look old:** pull to refresh or reopen **Home**.
- **Task at another site:** you only see tasks for the sites linked to your account; see
  [Wrong site](article:ts.wrong-site).
