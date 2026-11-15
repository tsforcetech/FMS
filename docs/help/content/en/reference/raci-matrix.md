---
id: ref.raci-matrix
title: RACI matrix for facility operations
module: Reference
category: administration
audience: public
apps: [admin, staff, mobile, customer]
roles:
  [
    owner,
    admin,
    site_manager,
    department_manager,
    supervisor,
    technician,
    staff,
    customer,
  ]
version: '0.8'
reviewed: '2026-11-15'
owner: Customer Success
description: Who is Responsible, Accountable, Consulted and Informed for the main FacilityOS activities, and why RACI on templates is not an access permission.
routes: [/task-templates, /roles]
screenshots:
  [phase4-06-template-builder.png, admin-task-templates.png, admin-roles.png]
diagrams: [wf-23, wf-29]
related:
  [
    templates.raci,
    gs.roles,
    tasks.approvals,
    role.owner-admin,
    role.facility-manager,
    role.site-manager,
    role.supervisor,
    role.technician,
    role.housekeeping,
    role.security,
    role.customer,
  ]
sources:
  - packages/shared/src/tasks.ts
  - apps/admin-web/src/management/TemplateBuilder.tsx
  - apps/admin-web/src/management/staffStore.ts
  - packages/shared/src/inventory.ts
  - apps/admin-web/src/data.ts
keywords:
  [
    RACI,
    responsible,
    accountable,
    consulted,
    informed,
    responsibility matrix,
    who approves,
    Name an Accountable owner for approval,
    Name at least one Responsible party,
  ]
---

A **RACI matrix** says, for each activity, who does the work and who answers for it.

| Letter              | Meaning                               | In practice                                     |
| ------------------- | ------------------------------------- | ----------------------------------------------- |
| **R** — Responsible | Does the work                         | The person or team carrying out the task        |
| **A** — Accountable | Owns the outcome and signs it off     | Exactly one owner per activity is best practice |
| **C** — Consulted   | Gives input before or during the work | Two-way communication                           |
| **I** — Informed    | Is kept up to date                    | One-way communication                           |

![The Task management → Task templates screen](screens/admin-task-templates.png)

![The People & teams → Roles & permissions screen](screens/admin-roles.png)

## RACI on task templates is a business assignment, not a permission

In **Task management → Task templates**, step **Responsibilities**, you can name R, A, C and I for a
template by **designation**, **department**, **team** or **employee** (up to 30 entries). When you
publish:

- at least one **Responsible** party is required (_Name at least one Responsible party_);
- if the template requires approval, an **Accountable** owner is required (_Name an Accountable owner
  for approval_).

> **Warning:** These letters document **who should** do and own the work. They do **not** grant or
> restrict access. What a person can actually do is decided by their **role** and their login's
> **site scope**:
>
> - Only **owners and admins** can use the admin app.
> - **Approvals** in the Staff/mobile app are available to supervisors, site managers, department
>   supervisors, admins and owners — whether or not they are named _Accountable_.
> - Tasks are assigned by the schedule's assignment rule or by hand, not by the R letter.

![Template builder](screens/phase4-06-template-builder.png)

{{diagram wf-23}}

## Recommended matrix

This is a starting point for a typical facility management company. Adapt it to your contracts and
record it on your templates. Columns: **Own** = Company owner, **Adm** = Company admin, **FM/SM** =
Facility / site manager, **Sup** = Department supervisor or team leader, **Tech** = Technician,
**Staff** = Housekeeping / security staff, **Cust** = Customer, **Sharaco** = Sharaco platform team.

| Activity                                   | Own | Adm | FM/SM | Sup | Tech | Staff | Cust | Sharaco |
| ------------------------------------------ | --- | --- | ----- | --- | ---- | ----- | ---- | ------- |
| Company setup                              | A   | R   | C     | –   | –    | –     | –    | C       |
| Site setup                                 | A   | R   | C     | I   | –    | –     | I    | –       |
| Employee provisioning (invite, link login) | A   | R   | C     | C   | –    | I     | –    | –       |
| Task template approval (publish)           | I   | A/R | C     | C   | C    | –     | –    | –       |
| Task assignment                            | I   | A   | R     | R   | I    | I     | –    | –       |
| Daily inspection                           | –   | I   | A     | C   | R    | R     | –    | –       |
| Supervisor approval                        | –   | I   | A     | R   | I    | I     | –    | –       |
| Maintenance work order                     | I   | C   | A     | C   | R    | I     | I    | –       |
| Escalation                                 | I   | R   | A     | C   | C    | I     | I    | –       |
| Customer complaint / request               | I   | C   | A     | R   | R    | I     | C    | –       |
| Inventory issue (stock out)                | I   | R   | A     | C   | I    | I     | –    | –       |
| Platform subscription management           | A   | C   | –     | –   | –    | –     | –    | R       |

## What the system enforces for each activity

| Activity                  | Who can do it in FacilityOS today                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Company setup, site setup | Owner, admin (admin app)                                                                             |
| Employee provisioning     | Owner, admin (owners alone invite admins); operators via trusted scripts                             |
| Template publish          | Owner, admin                                                                                         |
| Task assignment           | Owner, admin; automatic by schedules                                                                 |
| Daily inspection          | The assigned, linked employee (Staff/mobile app)                                                     |
| Supervisor approval       | Supervisor, site manager, department supervisor (Staff/mobile, for their linked sites), owner, admin |
| Work order                | Owner/admin create, assign, verify, close; assigned employees start, update, resolve                 |
| Escalation                | Owner, admin                                                                                         |
| Customer request          | Customer raises and confirms; owner/admin handle; assigned staff work it                             |
| Inventory issue           | Owner, admin post stock transactions                                                                 |
| Subscription              | Sharaco billing/owner platform roles only; the company sees **Plan & usage**                         |

## FAQs

- **If I make someone Accountable, can they approve?** Only if their role allows approvals.
- **Does the Informed party get notifications?** No. RACI letters are stored with the template version
  for reference and do not send notifications; configure those in **Notifications → Notification
  settings** ([Notifications](article:setup.notifications)).
