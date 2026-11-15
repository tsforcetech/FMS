---
id: people.leave
title: Record leave and holidays
module: Employees & Teams
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: People
description: Record employees' planned and approved leave and the company's public holidays, which affect who is eligible for scheduled work.
routes: [/leave]
prerequisites:
  - Employees exist
permissions:
  - Company owner or admin
screenshots: [admin-leave.png]
diagrams: [wf-15]
related:
  [
    people.employees,
    people.shifts,
    scheduling.recurring,
    scheduling.assignment,
    ts.no-eligible-staff,
  ]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
  - packages/shared/src/schedule.ts
keywords:
  [
    leave,
    absence,
    annual leave,
    sick leave,
    holiday,
    public holiday,
    approved leave,
    vacation,
  ]
---

**People & teams → Leave & holidays** has two tabs: **Leave records** for an employee's absence and
**Holidays** for public and company holidays. Leave is recorded by administrators; staff
self-service is not available yet.

## Before you start

- Approved leave matters: an employee whose leave is _Approved_ (or _Taken_) on a day is **not eligible** for
  automatic task assignment that day.
- Holidays matter to schedules: each recurring schedule chooses whether to skip, move or still
  generate work on holidays and non-working days.

## Steps

### Record leave

1. Open **People & teams → Leave & holidays**, choose **Leave records** and select
   **Add leave record**.
2. Choose the **Employee** and the **Leave type**: Annual, Sick, Unpaid, Emergency, Parental or
   Other. The code and name are generated automatically.
3. Enter the **First day** and **Last day** and optionally a **Reason**.
4. Choose the **Status**: _Planned_, _Approved_, _Taken_ or _Cancelled_.
5. Select **Save leave record** (_Leave record created._).

### Record a holiday

1. Choose the **Holidays** tab and select **Add holiday**.
2. Enter the **Code**, **Name** and **Date**.
3. Choose a **Site**, or leave it empty to apply the holiday to all sites.
4. Select **Save holiday**.

![Leave & holidays](screens/admin-leave.png)

{{diagram wf-15}}

## Expected result

- The leave appears on the employee's **Leave** tab.
- When the scheduler creates tasks, people on approved leave are skipped; if nobody else is
  eligible the task is left unassigned with the reason.

## Common errors

| Message                                                               | Why                                               | What to do                      |
| --------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------- |
| _End date must follow start date_                                     | The last day is before the first day.             | Correct the dates.              |
| _Employee cannot change after creation. Create a new record instead._ | You changed the employee of a saved leave record. | Cancel it and create a new one. |
| _Choose an active linked record._                                     | The employee is archived.                         | Choose an active employee.      |

## Troubleshooting

- **Someone on leave still got a task:** only _Approved_ or _Taken_ leave blocks assignment; _Planned_ leave does not. Eligibility is checked when
  a task is generated, so check tasks that already existed before the leave was approved and
  reassign them in **Task management → Task assignments** if needed.
- **A holiday did not skip work:** the schedule's holiday rule may be _Generate anyway_, or the
  holiday is for another site. See [Recurring tasks](article:scheduling.recurring).
