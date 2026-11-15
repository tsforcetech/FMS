---
id: ts.access-denied
title: Access denied or "You do not have permission"
module: Troubleshooting
category: technical-support
audience: public
apps: [admin, staff, mobile, customer]
roles: [owner, admin, site_manager, supervisor, staff, technician, customer]
version: '0.8'
reviewed: '2026-11-15'
owner: Support
description: What the permission messages mean and how to get the right access without weakening security.
routes: []
screenshots: [phase5-01-admin-link-login.png, phase7-01-admin-link-customer.png]
related: [gs.roles, setup.user-access, setup.staff-access, setup.customer-access, ts.wrong-site, ts.account-revoked, ts.read-only]
sources:
  - packages/shared/src/index.ts
  - apps/staff-web/src/i18n.tsx
  - apps/customer-web/src/App.tsx
  - firebase/firestore.rules
keywords: ["permission denied", "access denied", "Access is no longer available", "You do not have permission for this. Ask your supervisor.", "This change was not allowed", "You do not have access to this company"]
---

## Symptom

One of these messages appears:

- *Access is no longer available. Contact your company owner or refresh your access.* (admin app)
- *This change was not allowed. A linked record may have changed, or your access was updated.
  Refresh and try again.* (admin app)
- *You do not have permission for this. Ask your supervisor.* (staff web and mobile)
- *You do not have access to this company* (staff web and mobile)
- *Your account is not set up yet* or *This is not a customer account* (customer portal)

## Likely cause

Every read and write is checked by the server's security rules against your role, your company and,
for staff, your linked sites. Common reasons:

- Your role does not include this action (for example a **viewer** trying to edit).
- The record belongs to a site you are not linked to.
- Your membership or link was changed or removed.
- The company subscription is read-only (see [Read-only subscription](article:ts.read-only)).
- Someone else changed the record at the same time.

## How to check

1. Refresh the page and try once more.
2. Admin users: ask an owner to check your role in **Administration → User access**.
3. Staff: ask an admin to check your sites in **Administration → Staff access**.
4. Customers: ask the facility provider to check **Administration → Customer access**.

## Resolution

Give the person the **smallest role or site link** that covers the work, then have them sign out and
in again.

![Staff access page where logins are linked to employees and sites](screens/phase5-01-admin-link-login.png)

![Customer access page where customer logins are linked to locations](screens/phase7-01-admin-link-customer.png)

> **Warning:** Do not try to fix access errors by changing the security rules or by giving everyone
> the owner or admin role. The rules are what keep companies, sites and customers apart.

## Who can fix it

Company **owner** or **admin** (roles and links). Sharaco support only for read-only subscriptions.

## Related

[Roles and permissions](article:gs.roles) · [Wrong site](article:ts.wrong-site) ·
[Account revoked](article:ts.account-revoked)
