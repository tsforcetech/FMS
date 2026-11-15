---
id: ts.read-only
title: Read-only subscription
module: Troubleshooting
category: billing
audience: public
apps: [admin, staff, mobile, customer]
roles: [owner, admin, site_manager, supervisor, staff, technician, customer]
version: '0.8'
reviewed: '2026-11-15'
owner: Support
description: Changes are paused because the company subscription is read-only.
routes: []
screenshots: [phase8-09-tenant-plan-read-only.png]
related: [saas.read-only, saas.plan-usage, faq.billing, ts.access-denied]
sources:
  - apps/admin-web/src/App.tsx
  - apps/admin-web/src/management/planGate.ts
  - firebase/firestore.rules
keywords:
  [
    'read-only',
    'Read-only subscription. Your data stays available to view and export, but changes are paused.',
    'suspended',
    'subscription expired',
  ]
---

## Symptom

The admin app shows the banner **Read-only subscription.** _Your data stays available to view and
export, but changes are paused. See Administration → Plan & usage._ Staff and customers get
permission errors when they try to save, submit or create anything.

![Plan & usage in read-only mode](screens/phase8-09-tenant-plan-read-only.png)

## Likely cause

Sharaco set the company's subscription to read-only (for example the subscription was suspended or
not renewed). The server then allows reading and exporting only.

## How to check

The owner opens **Administration → Plan & usage** and reads the subscription status.

## Resolution

The owner contacts Sharaco to renew or reactivate the subscription. Nothing is deleted while
read-only; once reactivated, everyone can work again immediately. Meanwhile, export the data you
need.

## Who can fix it

The company **owner** together with **Sharaco** (platform staff).

## Related

[Read-only mode](article:saas.read-only) · [Plan and usage](article:saas.plan-usage) ·
[Billing FAQ](article:faq.billing)
