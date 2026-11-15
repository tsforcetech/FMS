---
id: train.add-employee
title: 'Quick start: add an employee and give them a login'
module: Training & Quick Starts
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Create the employee record, invite the person, and link their login so they see their tasks.
routes: [/employees, /invitations, /staff-access]
permissions:
  - Company owner or admin
screenshots:
  [
    phase4-03-employee-form.png,
    phase8-05-invitation-created.png,
    phase5-01-admin-link-login.png,
    admin-employees.png,
    admin-invitations.png,
    admin-staff-access.png,
  ]
diagrams: [wf-13, wf-03]
related:
  [people.employees, setup.invitations, setup.staff-access, ts.not-linked]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/SaasPages.tsx
  - apps/admin-web/src/management/StaffAccess.tsx
keywords:
  [new staff, hire, onboarding employee, staff login, link login, invitation]
---

1. Open **People & teams → Employees** and select **Add employee**.
2. Enter **Code**, **Name**, **Work email**, **Department**, **Designation**, **Primary site** and
   **Joining date**, then save.
3. Open **Administration → Invitations** and select **Invite someone**.
4. Enter the same email, choose the **Role** (for example _Staff_ or _Technician_) and select
   **Create invitation**.
5. Copy the link and send it to the person yourself — email delivery is not automated.
6. The person opens the link, signs in or creates an account with that email, verifies it and
   accepts.
7. Open **Administration → Staff access** → **Link a login to an employee**: choose the login and
   the **Employee**, set the **Sites (up to 10)** or **All sites**, and select **Link login**.
8. The person signs in to the Staff app and sees **My Day**.

![Employee form](screens/phase4-03-employee-form.png)

![Invitation created with a link to copy](screens/phase8-05-invitation-created.png)

![Linking a login to an employee](screens/phase5-01-admin-link-login.png)

Full guides: [Employees](article:people.employees), [Invitations](article:setup.invitations),
[Staff access](article:setup.staff-access).

![The People & teams → Employees screen](screens/admin-employees.png)

![The Administration → Invitations screen](screens/admin-invitations.png)

![The Administration → Staff access screen](screens/admin-staff-access.png)
