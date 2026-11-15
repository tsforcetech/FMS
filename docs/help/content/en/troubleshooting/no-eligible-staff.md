---
id: ts.no-eligible-staff
title: Tasks created without anyone assigned (no eligible staff)
module: Troubleshooting
category: technical-support
audience: public
apps: [admin]
roles: [owner, admin, site_manager, supervisor]
version: '0.4'
reviewed: '2026-11-15'
owner: Support
description: Recurring tasks appear unassigned with "No eligible employee" or "No employees match the assignment rule".
routes: []
screenshots: [phase4-15-staff-workload.png, phase4-11-schedule-detail.png]
related: [scheduling.assignment, scheduling.recurring, tasks.assignments, people.shifts, people.leave]
sources:
  - packages/shared/src/schedule.ts
  - apps/admin-web/src/management/Tasks.tsx
keywords: ["unassigned", "No eligible employee (leave, shift or inactive)", "No employees match the assignment rule", "round robin", "least workload", "pool"]
---

## Symptom

Generated tasks show no assignee and the reason *No eligible employee (leave, shift or inactive)*
or *No employees match the assignment rule*. They appear under **Task management → Task
assignments** and on the dashboard.

## Likely cause

- **No employees match the assignment rule:** the pool (department, designation, team, shift, site or
  selected people) is empty.
- **No eligible employee:** people match, but on that day all are inactive, on approved leave, or
  without a shift covering that weekday.

The scheduler never assigns work to someone who is not eligible.

## How to check

1. Open the schedule in **Task management → Recurring tasks** and read its assignment and pool.
2. Check the people in the pool under **People & teams → Employees**, **Shifts** and **Leave &
   holidays** for that date.
3. **Task management → Staff workload** shows who is working that day.

![Staff workload](screens/phase4-15-staff-workload.png)

## Resolution

- For today's tasks: assign them by hand with **Assign** in **Task assignments** or the task.
- For the future: fix the pool, add shift assignments, or add more people to the pool; then let the
  scheduler run again.

![Schedule details](screens/phase4-11-schedule-detail.png)

## Who can fix it

**Supervisor** (assign by hand); **admin** or **owner** (schedules, shifts, pools).

## Related

[Assignment strategies](article:scheduling.assignment) · [Shifts](article:people.shifts) ·
[Leave](article:people.leave)
