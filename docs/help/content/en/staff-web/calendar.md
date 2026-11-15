---
id: staff.calendar
title: See your tasks on a calendar
module: Staff Web
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [staff, technician, supervisor]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: View your assigned tasks by day, week, month or as a 14-day agenda.
routes: [/calendar]
screenshots: [phase5-13-calendar.png, staff-calendar.png]
related: [staff.my-day, staff.tasks, calendar.task-calendar]
sources:
  - apps/staff-web/src/screens/StaffCalendar.tsx
  - apps/staff-web/src/i18n.tsx
keywords: ["calendar", "Week", "Month", "Agenda", "schedule", "plan"]
---

The calendar helps you plan ahead. It shows only your own tasks.

## Steps

1. Open **Calendar** from the menu.
2. Choose a view: **Today**, **Week** (the default), **Month** or **Agenda** (the next 14 days).
3. Use the previous and next arrows to move in time.
4. Select a task to open it.

![The staff calendar in week view](screens/phase5-13-calendar.png)

## Expected result

Each task is shown at its due time in your company's time zone, with its status colour.

![The staff calendar](screens/staff-calendar.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| Empty week | No tasks are assigned to you in that period. | Move to another week or check **My tasks**. |

## Troubleshooting

- Future recurring tasks appear only after the scheduler has created them, so far-away weeks can
  look empty. See [No tasks showing](article:ts.no-tasks).
