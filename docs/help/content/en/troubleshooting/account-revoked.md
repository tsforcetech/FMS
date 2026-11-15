---
id: ts.account-revoked
title: 'Your staff access has been revoked'
module: Troubleshooting
category: technical-support
audience: public
apps: [staff, mobile, customer]
roles: [staff, technician, supervisor, customer, owner, admin]
version: '0.6'
reviewed: '2026-11-15'
owner: Support
description: A staff member or customer is shown a revoked or withdrawn access screen.
routes: []
screenshots: [phase5-03-not-linked.png, phase5-01-admin-link-login.png]
related:
  [
    ts.not-linked,
    ts.access-denied,
    setup.staff-access,
    setup.customer-access,
    mobile.sign-in,
  ]
sources:
  - apps/staff-web/src/i18n.tsx
  - apps/mobile/src/App.tsx
  - apps/customer-web/src/App.tsx
  - docs/phase6-report.md
keywords:
  [
    'revoked',
    'Your staff access has been revoked',
    'Your employee record is not active',
    'Your portal access has been withdrawn',
    'left company',
    'deactivated',
  ]
---

## Symptom

- Staff web or mobile: **Your staff access has been revoked** or **Your employee record is not active**.
- Customer portal: **Your portal access has been withdrawn**.

![Access screens look like this not-linked screen, with the revoked message](screens/phase5-03-not-linked.png)

## Likely cause

An administrator revoked the staff link or customer link, or the employee was made inactive (for
example after leaving the company). This is intended: access stops immediately on the server.

## How to check

An administrator opens **Administration → Staff access** (or **Customer access**) and looks at the
status of the link, and at the employee's status under **People & teams → Employees**.

## Resolution

- If the revocation was a mistake, the administrator restores the link (and reactivates the
  employee if needed). The person then signs out and in again.
- If it was intended, nothing needs to be done.

> **Note:** In the mobile app, when the server refuses access, the app **deletes its saved data from
> the phone** — tasks, drafts, unsent actions and photos. Work that was not synced before the
> revocation cannot be recovered from the phone.

![Restoring a staff link](screens/phase5-01-admin-link-login.png)

## Who can fix it

Company **owner** or **admin**.

## Related

[Login not linked](article:ts.not-linked) · [Access denied](article:ts.access-denied)
