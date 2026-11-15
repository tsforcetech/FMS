---
id: people.teams
title: Create teams and manage memberships
module: Employees & Teams
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: People
description: Create working teams with a leader, department and home site, and add or end effective-dated team memberships.
routes: [/teams]
prerequisites:
  - Employees exist
permissions:
  - Company owner or admin
screenshots: [admin-teams.png]
diagrams: [wf-13]
related:
  [
    people.employees,
    people.departments,
    people.shifts,
    scheduling.assignment,
    sites.archive,
  ]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
keywords:
  [team, team leader, crew, membership, deputy lead, end membership, rota]
---

A **team** is a working group such as _Night cleaning crew_ or _Tower A MEP_. Team membership is
**effective-dated**: you end a membership instead of deleting it, so history is kept. Schedules can
assign work to a team's members.

## Before you start

Create the employees who will lead and join the team.

## Steps

1. Open **People & teams → Teams** and select **Add team**.
2. Enter the **Code** and **Name**.
3. Optionally choose the **Department**, the **Home site** and the **Team leader**, and add a
   **Description**.
4. Select **Save team** (_Team created._).
5. Add members: open the team, choose the **Members** tab and select **Add team membership**
   (or use the **Team memberships** tab of the Teams page).
6. Choose the **Employee**, the **Role in team** (Member, Deputy lead or Lead) and the
   **Start date**. The code is generated automatically. Save.
7. When someone leaves the team, edit the membership, set **Status** to _Ended_ and enter the
   **End date**.

![Teams](screens/admin-teams.png)

{{diagram wf-13}}

## Expected result

- The team's **Members** tab lists current and past memberships.
- The employee's **Teams** tab shows the membership.

## Common errors

| Message                                                           | Why                                                     | What to do                   |
| ----------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| _Enter the date this assignment ended_                            | Status _Ended_ without an end date.                     | Enter the end date.          |
| _End date must follow start date_                                 | The end date is before the start date.                  | Correct the dates.           |
| _Ended assignments cannot be reopened. Create a new assignment._  | You tried to make an ended membership active again.     | Add a new membership.        |
| _Team cannot change after creation. Create a new record instead._ | You changed the team or employee of a saved membership. | End it and create a new one. |
| _Archive or reassign active linked records first._                | The team still has active members.                      | End the memberships first.   |

## Troubleshooting

- **No _Archive_ button on a membership:** active memberships are ended, not archived. End it
  first.
- **Team-based schedules leave tasks unassigned:** members on leave or without a covering shift
  are not eligible — see [No eligible staff](article:ts.no-eligible-staff).
