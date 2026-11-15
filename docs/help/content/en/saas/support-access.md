---
id: saas.support-access
title: Approve or revoke Sharaco support access
module: SaaS Plans & Subscriptions
category: billing
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: SaaS Platform
description: Decide whether a Sharaco support person may see your company setup summary, for how long, and withdraw it at any time.
routes: [/plan]
helpIds: [saas.support]
prerequisites:
  - A Sharaco support person has sent an access request for your company
permissions:
  - Company owner or admin
screenshots: [admin-plan.png]
related: [saas.plan-usage, setup.audit, faq.billing]
sources:
  - apps/admin-web/src/management/SaasPages.tsx
  - apps/admin-web/src/management/tenantSaas.ts
  - apps/platform-web/src/store.ts
  - firebase/firestore.rules
keywords:
  [
    support,
    Sharaco staff,
    privacy,
    access request,
    approve 24h,
    revoke,
    data access,
    Approve support access for 1 to 72 hours,
  ]
---

Sharaco staff **cannot see your operational data** — tasks, employees, customers, stock, photos or
attendance. When Sharaco support needs to understand how your company is set up, a support person
sends an **access request** with a reason. You decide whether to approve it. An approval is
time-limited and only lets them see your **setup summary** (which starter pack was installed and
which **Company setup** steps are marked done). It never opens tasks, employees or customer records.

> **Note:** Your plan, subscription status and usage counters are visible to Sharaco platform staff
> without an approval, because they manage your subscription. Everything else stays inside your
> company.

## Steps

1. Open **Administration → Plan & usage** and scroll to **Sharaco support access**.
2. Read each request: **Requested** (date and time), **Reason** (written by the support person),
   **Status** and **Expires**.
3. To allow it, select **Approve 24h**. The status becomes _Approved_ and **Expires** shows the time,
   24 hours from now. A confirmation _Approved for 24 hours_ appears.
4. To withdraw access at any time — before or after approving — select **Revoke**. The status becomes
   _Revoked_ and the support person immediately loses access (_Access revoked_).
5. If you did not expect the request, do not approve it; revoke it and contact Sharaco through your
   usual channel to confirm who asked.

![Plan & usage with the Sharaco support access section](screens/admin-plan.png)

## Expected result

- An approved request lets the named support person press **View setup summary** in the platform
  console until the expiry time. After expiry, access ends automatically — nothing needs to be done.
- A revoked request gives no access. The support person must send a new request if they still need
  help.

## Rules that always apply

- Approval is limited to at most **72 hours**; the admin app approves for 24 hours.
- Each support person has their own request; approving one person does not admit anyone else.
- Your company's tenant roles (owner, admin and so on) never give anyone access to the Sharaco
  platform console, and platform roles never give anyone access to your operational data.

## Common errors

| Message                           | Why                                                         | What to do                                                                              |
| --------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| _No support requests_             | Nobody from Sharaco has asked.                              | Nothing to do.                                                                          |
| Permission message when approving | You are not an owner or admin, or the company is read-only. | Ask an owner/admin; if read-only, see [Read-only subscription](article:saas.read-only). |

## Troubleshooting

- **Support says they still cannot see anything:** check the request shows _Approved_ and the
  **Expires** time has not passed. They see only the setup summary by design.
- **I want a record of support access:** the request list keeps the status, reason and who decided.
