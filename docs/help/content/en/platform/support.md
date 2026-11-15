---
id: platform.support
title: Request support access to a company
module: Sharaco Platform Administration
category: billing
audience: authenticated
apps: [platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: SaaS Platform
description: Ask a company for time-limited access to its setup summary, and what you can and cannot see once approved.
routes: ['/companies/:id']
prerequisites:
  - Support or Platform owner role
permissions:
  - Request access — Support or Platform owner
  - Approval — the company's own owner or admin
screenshots: [phase8-08-platform-company.png]
related: [saas.support-access, platform.companies, platform.overview]
sources:
  - apps/platform-web/src/App.tsx
  - apps/platform-web/src/store.ts
  - apps/admin-web/src/management/tenantSaas.ts
  - firebase/firestore.rules
keywords:
  [
    support access,
    tenant data,
    privacy,
    setup summary,
    Request access,
    Explain why access is needed,
    View setup summary,
  ]
---

Platform staff **cannot read tenant operational data**. When you need to help a company with its
setup, you request access; the company's owner or admin decides. Even when approved, you only see
the **setup summary**: the starter pack installed and the **Company setup** steps marked done. Tasks,
employees, customers, stock, attendance and photos are never visible to platform staff.

## Steps

1. Open **Companies** and select the company.
2. In **Support access**, type the **Reason for access (shown to the tenant)** — be specific, for
   example "Check onboarding steps for ticket 1234".
3. Select **Request access**. _Request sent to the tenant_ appears and **Your request** shows
   _Requested_.
4. Tell the company's contact through your normal support channel that a request is waiting under
   **Administration → Plan & usage → Sharaco support access**. There is no automatic email.
5. When approved, **Your request** shows _Approved until …_. Select **View setup summary** to see
   _Starter pack_ and _Steps marked_.
6. Access ends automatically at the expiry time (at most 72 hours; the admin app grants 24 hours) or
   as soon as the company selects **Revoke**.

## What you can see without approval

The company's name, ID, time zone, status, plan, subscription and usage counters — needed to manage
the subscription.

## Common errors

| Message                         | Why                               | What to do          |
| ------------------------------- | --------------------------------- | ------------------- |
| _Explain why access is needed._ | Empty reason.                     | Enter a reason.     |
| Summary refused                 | Not approved, expired or revoked. | Send a new request. |

> **Note:** Never ask a customer to share a password or to create an account for you. Use the access
> request; if more is needed, the company admin can export data and share it under their own control.
