---
id: people.departments
title: Set up departments and designations
module: Employees & Teams
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: People
description: Create departments (with one level of sub-departments) and designations (job titles) before adding employees.
routes: [/departments, /designations]
helpIds: [setup.departments]
permissions:
  - Company owner or admin
screenshots: [admin-departments.png, admin-designations.png]
diagrams: [wf-13]
related: [people.employees, people.teams, setup.wizard, gs.roles, sites.archive]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
keywords:
  [
    department,
    sub-department,
    designation,
    job title,
    grade,
    housekeeping,
    MEP,
    security,
    organisation,
  ]
---

**Departments** are your organisational units, such as _Housekeeping_, _MEP_ or _Security_.
**Designations** are job titles, such as _Cleaner_ or _HVAC Technician_. Every employee needs both.

> **Note:** _Designations describe a job. They never grant access to FacilityOS._ Access comes only
> from the person's role and staff link — see [Roles and permissions](article:gs.roles).

## Before you start

- Decide whether a department is company-wide or belongs to one site.
- Only one level of hierarchy is supported: a department can have sub-departments, but a
  sub-department cannot have its own.
- A starter pack in **Company setup** can create typical departments and designations for your
  industry.

## Steps

### Create a department

1. Open **People & teams → Departments** and select **Add department**.
2. Enter the **Code** (for example `HK`) and **Name**.
3. Optionally choose a **Parent department** (_Only top-level departments can be parents._).
4. Optionally choose the **Site** — leave it empty for a company-wide department.
5. Optionally choose the **Department manager** (an employee) and add a **Description**.
6. Select **Save department** (_Department created._).

### Create a designation

1. Open **People & teams → Designations** and select **Add designation**.
2. Enter the **Code** and **Name** (for example `HK-CLN` / _Cleaner_).
3. Optionally choose the **Department**, the **Grade / level** and a **Description**.
4. Select **Save designation**.

![Departments](screens/admin-departments.png)

{{diagram wf-13}}

## Expected result

- A department page shows tabs **Employees**, **Designations**, **Teams** and
  **Sub-departments**.
- A designation page shows the **Employees** with that job title.

![Designations](screens/admin-designations.png)

## Common errors

| Message                                                                | Why                                                                                | What to do                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| _Choose a top-level parent. Only one level of hierarchy is supported._ | The chosen parent is itself a sub-department.                                      | Choose a top-level department as the parent. |
| _This code is already reserved. Choose another code._                  | The code is already used (also by archived records).                               | Choose another code.                         |
| _Archive or reassign active linked records first._                     | Active employees, designations, teams or sub-departments still use the department. | Move or archive them first.                  |

## Troubleshooting

- **The department manager is not in the list:** the manager must already exist as an active
  employee. Create the employee first, then edit the department.
- **Schedules by department:** recurring schedules can assign work to a department's employees —
  see [Assignment strategies](article:scheduling.assignment).
