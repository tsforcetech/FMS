---
id: setup.staff-access
title: Link staff logins to employees and sites
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Security
description: Connect a staff login to its employee record, choose the sites it may work in, change the scope and revoke or restore access.
routes: [/staff-access]
helpIds: [setup.staff]
prerequisites:
  - The person has an active, non-customer membership (from an invitation or provisioning)
  - An active employee record for the person
permissions:
  - Company owner or admin
screenshots:
  [
    phase5-01-admin-link-login.png,
    phase5-03-not-linked.png,
    admin-staff-access.png,
  ]
diagrams: [wf-03, wf-14]
related:
  [
    gs.roles,
    setup.invitations,
    people.employees,
    setup.user-access,
    staff.sign-in,
    ts.not-linked,
  ]
sources:
  - apps/admin-web/src/management/StaffAccess.tsx
  - apps/admin-web/src/management/staffStore.ts
  - firebase/firestore.rules
keywords:
  [
    staff link,
    link login,
    site scope,
    all sites,
    revoke,
    restore,
    not linked,
    staff portal,
    supervisor scope,
  ]
---

A staff member can use the staff portal (`/staff/`) and the mobile app only after their login is
linked to an employee record and given sites. The link tells FacilityOS **who** the person is and
**where** they work; the security rules use it on every request.

![The Administration → Staff access screen](screens/admin-staff-access.png)

## Before you start

- The person's login must exist and be an **active member** of the company with a staff role
  (staff, technician, supervisor, site manager or department manager). Logins come from an
  [invitation](article:setup.invitations) or the trusted provisioning procedure — the banner
  **How staff sign in** on the page summarises this.
- The employee must exist with status _Active_ or _Probation_
  ([Employees](article:people.employees)).

## Steps

1. Open **Administration → Staff access** and select **Link a login**.
2. In **Link a login to an employee**, choose the **Login (company member)** from
   _Choose a provisioned login_. The person's role is shown, for example
   _Supervisor / team leader_.
3. Choose the **Employee**.
4. Choose the scope:
   - switch on **All sites of the company**, or
   - leave it off and use **Add site** under **Sites (up to 10)**.
5. Save. The message _Login linked to the employee._ appears.
6. To change sites later, select **Scope** on the row, adjust the sites and save
   (_Scope updated._).
7. To stop access, select **Revoke** and confirm **Revoke staff access?** The person can no longer
   open tasks or records. Select **Restore** to give access back (_Access restored._).

![Linking a login to an employee](screens/phase5-01-admin-link-login.png)

{{diagram wf-14}}

## Expected result

- The row shows the employee, login, sites, the update time and _Active_.
- Staff see the tasks assigned to them in those sites. Supervisors and site managers also see the
  work in those sites and can approve submissions.

## Common errors

| Message                                                                                      | Why                                                            | What to do                                                |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| _Choose a login account._ / _Choose the employee._                                           | A required choice is empty.                                    | Select both.                                              |
| _Choose at least one site, or allow all sites._                                              | No sites are selected and **All sites of the company** is off. | Add a site or switch on all sites.                        |
| _Choose at most 10 sites, or allow all sites._                                               | More than ten sites were added.                                | Use **All sites of the company** instead.                 |
| _This login is not an active member of the company. Provision the membership first._         | The login has no active membership, or it is a customer login. | Invite the person with a staff role first.                |
| _Only active employees can be linked._                                                       | The employee is suspended, resigned, terminated or archived.   | Link an employee whose status is Active or Probation.     |
| _This login is already linked to another employee. A login can represent only one employee._ | The login already represents someone else.                     | Revoke the other link first, or choose the correct login. |
| _This employee is already linked to another login. Revoke that link first._                  | The employee already has a login.                              | Revoke the old link, then link the new login.             |
| _This access was changed by someone else. Reload and try again._                             | Another admin changed the link at the same time.               | Reload and repeat.                                        |
| _Keep at least one site, or revoke the access instead._                                      | You removed every site from an existing link.                  | Keep a site, or select **Revoke**.                        |

## Troubleshooting

- **The staff portal says the account is not linked:** finish the link on this page — see
  [Not linked](article:ts.not-linked).

  ![The staff portal when a login is not linked](screens/phase5-03-not-linked.png)

- **The login is missing from the list:** only active non-customer members are offered. Check
  [User access](article:setup.user-access).
- **Linking never grants admin access.** Staff never choose their own identity; only an admin can
  link them.
