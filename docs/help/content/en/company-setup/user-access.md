---
id: setup.user-access
title: Review company members on User access
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Security
description: See every login that belongs to the company with its role, status and linked employee, and understand how accounts and roles are provisioned.
routes: [/access]
permissions:
  - Company owner or admin (view only; roles are changed by trusted provisioning)
screenshots: [admin-access.png]
diagrams: [wf-03]
related: [gs.roles, setup.invitations, setup.staff-access, setup.customer-access, people.employees, ts.access-denied]
sources:
  - apps/admin-web/src/management/Admin.tsx
  - packages/shared/src/index.ts
  - firebase/firestore.rules
keywords: [members, users, logins, accounts, membership, role, provisioning, Member listing will be available]
---

**Administration → User access** lists the logins (members) of your company. It is a review page:
accounts and roles are never created or changed from the browser.

## Before you start

Read [Roles and permissions](article:gs.roles) to understand what each role can do.

## Steps

1. Open **Administration → User access**.
2. Read the banner **Accounts are provisioned securely**: sign-in accounts and roles are created
   by the trusted operator procedure, never from this browser.
3. Review the table:
   - **Account** — the member, with a *You* tag on your own row.
   - **Role** — the company role (owner, admin, supervisor, staff, customer…).
   - **Status** — whether the membership is active.
   - **Linked employee** — the employee record whose **Login account UID** matches this login,
     or *Not linked*.
   - **Last change** — when the membership last changed.
4. To add a person, use [Invitations](article:setup.invitations). To let a staff member work in
   the staff portal, link them in [Staff access](article:setup.staff-access). To let a customer use
   the customer portal, link them in [Customer access](article:setup.customer-access).

![The User access member list](screens/admin-access.png)

{{diagram wf-03}}

## Expected result

You can see who has access to the company, with which role, and which employee each staff login
represents.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Member listing will be available once the latest database rules are published.* | The deployed security rules do not yet allow the member list to be read. | Ask your operator to publish the current rules release. Do not change the rules yourself. |
| *No members found* | The list is empty or could not be loaded. | Refresh the page. |

## Troubleshooting

- **Someone needs a different role:** roles are changed only by trusted provisioning or by a new
  invitation accepted with the right role. Contact the owner (or Sharaco for an owner change).
- **A former employee still appears:** revoke their staff link in **Staff access** (and their
  customer link, if any), and ask for the membership to be suspended.
- **Linking an employee to a login does not grant access.** The **Login account UID** on an
  employee record is informational; access comes from the role and the staff link.
