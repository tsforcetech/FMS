---
id: ts.not-linked
title: 'Your login is not linked to an employee yet'
module: Troubleshooting
category: technical-support
audience: public
apps: [staff, mobile, admin]
roles: [staff, technician, supervisor, owner, admin]
version: '0.5'
reviewed: '2026-11-15'
owner: Support
description: A staff member signs in but sees the not-linked screen instead of their tasks.
routes: []
screenshots: [phase5-03-not-linked.png, phase5-01-admin-link-login.png]
diagrams: [wf-03]
related:
  [staff.sign-in, setup.staff-access, setup.invitations, ts.account-revoked]
sources:
  - apps/staff-web/src/App.tsx
  - apps/staff-web/src/i18n.tsx
  - firebase/firestore.rules
keywords:
  [
    'not linked',
    'Your login is not linked to an employee yet',
    'Ask your administrator to link your account',
    'staff access',
    'identity',
  ]
---

## Symptom

After signing in to the staff web or mobile app the screen says **Your login is not linked to an
employee yet** — _Ask your administrator to link your account to your employee record. You cannot
choose an identity yourself._

![The not-linked screen](screens/phase5-03-not-linked.png)

## Likely cause

The login (email and password) exists, but no administrator has connected it to an employee record.
For security, staff can never pick or claim an employee record themselves.

## How to check

1. The staff member checks they used their **work** email (not a personal one).
2. An administrator opens **Administration → Staff access** and looks for the login.

## Resolution

1. In **Administration → Staff access**, link the login to the correct employee, choose the sites
   (or all sites) and whether the person is a supervisor.
2. Make sure the employee record is active.
3. The staff member signs out and signs in again.

![Linking a login to an employee under Staff access](screens/phase5-01-admin-link-login.png)

{{diagram wf-03}}

> **Warning:** Never share one login between several people, and never link a login to someone
> else's employee record to "make it work" — task history and attendance would be recorded against
> the wrong person.

## Who can fix it

Company **owner** or **admin**.

## Related

[Staff access](article:setup.staff-access) · [Invitations](article:setup.invitations) ·
[Sign in to the staff app](article:staff.sign-in)
