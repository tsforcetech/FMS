---
id: scheduling.assignment
title: Assignment strategies for recurring tasks
module: Recurring Scheduling
category: daily-tasks
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Task Management
description: How a schedule chooses who gets each occurrence — queue, fixed people, round-robin or least workload — and who counts as eligible.
routes: [/recurring-tasks, /pm-plans]
prerequisites:
  - Active employees, with shift assignments and approved leave kept up to date
permissions:
  - Company owner or admin
screenshots: [phase4-10-schedule-builder.png, phase4-15-staff-workload.png]
diagrams: [wf-25]
related: [scheduling.recurring, scheduling.generation, tasks.assignments, people.shifts, people.leave, people.teams, ts.no-eligible-staff]
sources:
  - packages/shared/src/schedule.ts
  - apps/admin-web/src/management/scheduling.ts
  - apps/admin-web/src/management/Schedules.tsx
keywords: [round robin, rotation, least workload, fixed employee, pool, eligibility, leave, shift, unassigned queue, No eligible employee, No employees match the assignment rule, Fixed assignee unavailable]
---

Every recurring schedule and preventive maintenance plan has an **Assignment** setting. When the
scheduler creates an occurrence it builds the list of candidates, removes anyone who is not eligible
that day, and then applies the strategy. It **never** falls back to someone who is not eligible — the
task goes to the unassigned queue instead.

## Strategies

| Strategy | Who gets the occurrence |
| --- | --- |
| *Leave unassigned (queue)* | Nobody. The task is created *Pending* for a supervisor or admin to assign. |
| *Fixed employee(s)* | The first eligible person in the order you listed them. |
| *Round-robin rotation* | Eligible people take turns. The turn is worked out from the occurrence number, so running the scheduler again for the same occurrence always picks the same person. |
| *Least workload* | The eligible person with the fewest planned minutes that day; ties go to the same person every time. |

For *Round-robin* and *Least workload*, choose the **Pool**: *Selected employees*, *Department*,
*Designation*, *Team*, *Shift* or *Site staff*, and the matching value. Tick **Only employees assigned
to this site** to keep people from other sites out of the pool.

## Who is eligible on a day

A person in the pool is skipped when, on that date, they:

- are not an active employee;
- have **approved leave** covering the date;
- have shift assignments but none whose working days include that weekday; or, when the pool is
  **Shift**, are not on that shift that day.

> **Note:** An employee with no shift assignment at all is treated as available on every day (except
> for a *Shift* pool). Give people shifts if you want the scheduler to respect working days.

## Steps

1. Open the schedule (**Task management → Recurring tasks** or **Maintenance → Preventive plans**) and
   select **Edit**, or create a new one.
2. Under **Assignment**, choose the strategy, then the **Pool** and its value, or the employees.
3. Save. The strategy applies to occurrences generated from now on; tasks already generated keep their
   assignee. Assignment changes do not create a new rule version.

![Assignment section of the schedule builder](screens/phase4-10-schedule-builder.png)

{{diagram wf-25}}

## Expected result

Generated tasks show the chosen assignee. When nobody is eligible the task is created unassigned
with one of these reasons:

| Reason | Meaning |
| --- | --- |
| *No eligible employee (leave, shift or inactive)* | The pool has people, but none can work that day. |
| *No employees match the assignment rule* | The pool is empty (for example, nobody in that team). |
| *Fixed assignee unavailable* | None of the fixed people is eligible that day. |

![Staff workload with planned minutes used by least-workload assignment](screens/phase4-15-staff-workload.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Choose the fixed employee(s).* | *Fixed employee(s)* with nobody selected. | Select employees. |
| *Choose who is in the assignment pool.* | A pool type was chosen without its value. | Choose the department, team, shift, etc. |
| *Choose the employees in the rotation.* | *Selected employees* pool with nobody selected. | Select employees. |

## Troubleshooting

- **Everything ends up unassigned:** see [No eligible staff](article:ts.no-eligible-staff).
- **One person gets everything with least workload:** the others may have more planned minutes that
  day, or be on leave or off shift. Check **Staff workload**.
