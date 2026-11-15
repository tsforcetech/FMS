---
id: people.employees
title: Add an employee and assign sites
module: Employees & Teams
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: People
description: Create employee records with department, designation and primary site, assign further sites, and understand how employees relate to logins.
routes: [/employees]
helpIds: [setup.employees]
prerequisites:
  - At least one department and designation
permissions:
  - Company owner or admin
screenshots: [phase4-03-employee-form.png, admin-employees.png]
diagrams: [wf-13, wf-14]
related: [people.departments, people.teams, people.shifts, people.leave, setup.staff-access, import.overview, sites.archive]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
keywords: [employee, staff record, employee ID, joining date, employment type, primary site, site assignment, supervisor, login account UID, probation, resigned]
---

An **employee** record describes a person who works for the company: their job, department,
supervisor and sites. Employee records are **separate from login accounts**: linking a login
grants no access; roles are provisioned by the trusted operator and staff access is given in
[Staff access](article:setup.staff-access).

## Before you start

- Create the [departments and designations](article:people.departments).
- Decide each person's **Employee ID** (the record code), for example `E-1042`.
- For many employees use **Administration → Import data** (see
  [Bulk import](article:import.overview)).

## Steps

1. Open **People & teams → Employees** and select **Add employee**.
2. Enter the **Employee ID** and **Full name**.
3. Enter the **Work email** and **Phone**.
4. Enter the **Joining date** and choose the **Employment type** (Full-time, Part-time, Contract or
   Temporary).
5. Choose the **Department** and **Designation** (both required) and, optionally, the
   **Supervisor**.
6. Choose the **Primary site**. *Additional sites, teams and shifts are assigned from the employee
   page.*
7. Leave **Login account UID** empty unless you were given it. *It does not grant any role or
   access.*
8. Keep **Employment status** *Active* (or *Probation*) and select **Save employee**
   (*Employee created.*).
9. To add more sites, open the employee, choose the **Sites** tab and select
   **Add site assignment**. Choose the **Site**, the **Assignment role** (Assigned staff, Site
   supervisor or Relief cover) and the **Start date**; the code is generated automatically.

![The employee form](screens/phase4-03-employee-form.png)

{{diagram wf-13}}

## Expected result

- The employee appears in **Employees** with status *Active*.
- The employee page has tabs **Sites**, **Teams**, **Shifts**, **Leave**,
  **Assets in custody** and **Direct reports**.
- To let the person use the staff portal, link their login in
  [Staff access](article:setup.staff-access).

![The employee list](screens/admin-employees.png)

{{diagram wf-14}}

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Use uppercase letters, numbers, - or _* | The Employee ID contains other characters. | Use an ID like `E-1042`. |
| *This code is already reserved. Choose another code.* | The Employee ID is already used. | Use a different ID. |
| *Enter the account UID (letters and numbers only)* | The **Login account UID** has invalid characters. | Leave it empty, or paste the exact UID. |
| *End date must follow start date* | A site assignment ends before it starts. | Correct the dates. |
| *Enter the date this assignment ended* | You set an assignment to *Ended* without an end date. | Enter the end date. |
| *Ended assignments cannot be reopened. Create a new assignment.* | You tried to make an ended assignment active again. | Create a new site assignment. |
| *Employee cannot change after creation. Create a new record instead.* | You changed the employee or site of a saved assignment. | End it and create a new one. |
| *Your plan allows N employees. Archive unused records or ask Sharaco to upgrade your plan. Existing data stays available.* | The plan limit is reached. | Archive former employees or ask about a larger plan. |

## Troubleshooting

- **The person cannot see tasks in the staff portal:** the employee record alone is not enough.
  Link their login in **Staff access**.
- **Someone leaves:** set **Employment status** to *Resigned* or *Terminated*, end their site, team
  and shift assignments, and revoke their staff access.
- **Archiving is refused:** active assignments, teams or assets in custody still point to the
  employee. End or reassign them first.
