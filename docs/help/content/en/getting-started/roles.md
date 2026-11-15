---
id: gs.roles
title: Roles and permissions
module: Getting Started
category: getting-started
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
    viewer,
    customer,
    platform,
  ]
version: '0.8'
reviewed: '2026-11-15'
owner: Security
description: How FacilityOS decides who can do what — company roles, the admin app, staff links with site scope, supervisors, customer links and Sharaco platform roles.
routes: [/roles, /access]
helpIds: [setup.roles]
permissions:
  - Anyone can read this article; only trusted provisioning can grant roles
screenshots:
  [
    admin-roles.png,
    phase5-01-admin-link-login.png,
    phase7-01-admin-link-customer.png,
    admin-access.png,
  ]
diagrams: [wf-03, wf-04]
related:
  [
    setup.user-access,
    setup.staff-access,
    setup.customer-access,
    setup.invitations,
    templates.raci,
    ts.access-denied,
  ]
sources:
  - packages/shared/src/index.ts
  - packages/shared/src/inventory.ts
  - apps/admin-web/src/management/staffStore.ts
  - apps/admin-web/src/management/customerStore.ts
  - apps/admin-web/src/management/tenantSaas.ts
  - firebase/firestore.rules
keywords:
  [
    role,
    permission,
    owner,
    admin,
    supervisor,
    site manager,
    department manager,
    technician,
    staff,
    viewer,
    customer,
    platform,
    scope,
    RACI,
    security rules,
  ]
---

Every person in a company has a **membership** with one role. What a person can see and change is
decided by that role **and** by links that give them a scope (sites for staff, places for
customers). Every check is enforced by the database security rules, not only by the screen, so
hiding or showing a button never grants access.

![The Administration → User access screen](screens/admin-access.png)

## Before you start

Know the role ids used across FacilityOS: `owner`, `admin`, `site_manager`,
`department_manager`, `supervisor`, `technician`, `staff`, `viewer` and `customer` (company
roles) and `platform` (Sharaco staff). Business titles such as _Facility Manager_,
_Housekeeping_ or _Security_ are mapped onto these roles in the role guides; they are not extra
permissions.

## Steps

Use these rules to work out what a person can do.

1. **Admin app — owners and admins only.** The admin app opens only when the membership is
   active, the role is `owner` or `admin`, and the company is active or read-only. Both roles
   manage the whole company. Neither can change roles from the browser: on
   **People & teams → Roles & permissions** the _User access & roles_ column shows
   _View (trusted changes)_.
2. **Staff roles — staff link plus site scope.** `staff`, `technician`, `supervisor`,
   `site_manager` and `department_manager` work in the staff portal and mobile app. A login
   becomes useful only after an administrator links it to an employee and chooses its sites in
   **Administration → Staff access** (up to 10 sites, or _All sites of the company_). Staff and
   technicians see the tasks and work orders assigned to them.
3. **Supervisor-type roles see in-scope work and approve.** `supervisor`, `site_manager` and
   `department_manager` also see work in their linked sites and can approve or send back
   submitted tasks. Their scope is still limited to the sites on their staff link.
4. **Customers — customer link.** A `customer` login sees only the customer portal, and only the
   places on its link: one client and, optionally, specific allocations (set in
   **Administration → Customer access**). An email address alone never grants access.
5. **Viewer.** `viewer` is a prepared read-only company role. It cannot open the admin app;
   its planned read-only admin access is shown as _Prepared_ on **Roles & permissions**.
6. **Platform roles are separate.** Sharaco platform staff hold a platform role on their account,
   not a company membership. They use the separate Sharaco platform console. A company role never
   grants platform access, and a platform role does not make someone a company admin; support
   access to a company must be approved by that company.
7. **RACI is not a security grant.** Responsible/Accountable/Consulted/Informed settings on task
   templates describe who should do or know about the work. They do not give anyone access to
   records. Access always comes from the role and the staff or customer link.
8. **How roles are granted.** Sharaco provisions company owners. Owners and admins can
   [invite](article:setup.invitations) people with a role (only an owner can invite an admin;
   nobody invites an owner). The trusted operator procedure can also create logins. Nobody can
   promote themselves.

![The Roles & permissions page](screens/admin-roles.png)

{{diagram wf-03}}

## Expected result

You can say for any person which app they use and what they see:

| Role                                         | App                               | Scope                               |
| -------------------------------------------- | --------------------------------- | ----------------------------------- |
| Owner, Admin                                 | Admin app                         | Whole company                       |
| Site manager, Department manager, Supervisor | Staff portal / mobile             | Linked sites; approve in-scope work |
| Technician, Staff                            | Staff portal / mobile             | Own assigned work in linked sites   |
| Viewer                                       | Not the admin app (prepared role) | Planned read-only access            |
| Customer                                     | Customer portal                   | Linked client and places            |
| Platform                                     | Sharaco platform console          | Platform administration only        |

> **Note:** On **Roles & permissions**, owner and admin are marked _Active_. The other rows are
> marked _Prepared_: they describe the planned admin-app permissions for those roles, which stay
> without admin-app access until released. Their staff-portal and customer-portal access works
> today through the links described above.

![Linking a staff login to an employee and sites](screens/phase5-01-admin-link-login.png)

![Linking a customer login to a client](screens/phase7-01-admin-link-customer.png)

## Common errors

| Message                                                                                                                         | Why                                                                                                                       | What to do                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| _Access denied_ in the admin app                                                                                                | The role is not owner or admin, or the membership is not active.                                                          | Staff use the staff portal. Ask the owner to check the membership.                                       |
| _This change was not allowed. A linked record may have changed, or your access was updated. Refresh and try again._ (admin app) | The security rules refused a change in the admin app.                                                                     | Refresh. If it continues, ask the owner to check your membership.                                        |
| _Access is no longer available. Contact your company owner or refresh your access._                                             | The security rules refused the request — the link was revoked, the scope does not include that site, or the role changed. | Ask an administrator to check the staff or customer link. See [Access denied](article:ts.access-denied). |
| _This login is not an active member of the company. Provision the membership first._                                            | An admin tried to link a login that has no active membership.                                                             | Invite the person or provision the membership first.                                                     |

## Troubleshooting

- **A supervisor cannot see a site's tasks:** add that site to their staff link in
  **Staff access**, or choose _All sites of the company_.
- **Someone asks to be made admin:** only the owner can invite an admin. Never share an owner or
  admin login.
- **An access error appears:** fix the membership or link. Never weaken the database security
  rules to make an error go away.
