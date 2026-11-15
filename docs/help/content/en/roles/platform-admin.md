---
id: role.platform-admin
title: 'Role guide: Sharaco platform administrator'
module: Role Guides
category: billing
audience: authenticated
apps: [platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: SaaS Platform
description: Platform roles, how authority is granted, what platform staff can and cannot see, daily routines and what still needs operators or approval.
routes:
  [
    '/',
    /companies,
    /plans,
    /subscriptions,
    /billing,
    /audit,
    /health,
    /settings,
  ]
prerequisites:
  - A Sharaco account with a verified email and a platform role claim
screenshots:
  [
    phase8-10-platform-overview.png,
    phase8-08-platform-company.png,
    platform-health.png,
  ]
diagrams: [wf-01, wf-05, wf-06, wf-07]
related:
  [
    platform.overview,
    platform.companies,
    platform.plans,
    platform.subscriptions,
    platform.billing,
    platform.audit,
    platform.support,
    ops.grant-role,
    ops.usage-reconcile,
    ops.subscription-sweep,
    ops.provisioning,
    ops.backup,
  ]
sources:
  - apps/platform-web/src/App.tsx
  - apps/platform-web/src/store.ts
  - packages/shared/src/saas.ts
  - scripts/grant-platform-role.mjs
  - firebase/firestore.rules
keywords:
  [
    Sharaco,
    super admin,
    platform owner,
    billing administrator,
    support,
    viewer,
    tenant isolation,
  ]
---

Sharaco platform administrators run the FacilityOS **service**, not any customer's facilities. They
work in the **platform console**.

## Platform authority vs company roles

|                            | Platform role                                                                               | Company (tenant) role                                 |
| -------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Values                     | `owner`, `billing`, `support`, `viewer`                                                     | `owner`, `admin`, `site_manager`, … `customer`        |
| Granted by                 | Operator script setting a custom claim (`grant-platform-role.mjs`), verified email required | Invitation or trusted provisioning inside one company |
| Opens                      | Platform console only                                                                       | Admin, Staff, mobile or customer app of that company  |
| Can see tenant operations? | **No** — only company, plan, subscription, usage and (with approval) setup summary          | Yes, within the company                               |

A company owner/admin is refused by the console (_Not a Sharaco platform account_), and a platform
role gives no access to any company's tasks, people or customers.

## What each platform role can do

- **Platform owner** — register companies; everything below.
- **Billing administrator** — plans and versions, subscription actions, invoice records.
- **Support** — request time-limited support access.
- **Read-only viewer** — view all console pages.

![Platform overview](screens/phase8-10-platform-overview.png)

## Daily routine

1. **Overview** — check _Expiring in 30 days_, _Read-only_, _Companies without a plan_
   ([Overview](article:platform.overview)).
2. **Subscriptions** — filter _Renewal due_, _Grace_, _Past due_; contact customers; record payments
   and **Renew** ([Subscriptions](article:platform.subscriptions), [Billing](article:platform.billing)).
3. Operator tasks (until automated): [subscription sweep](article:ops.subscription-sweep) and
   [usage reconciliation](article:ops.usage-reconcile).
4. **Platform audit log** — review yesterday's privileged changes ([Audit](article:platform.audit)).

![Company page](screens/phase8-08-platform-company.png)

## Needs an operator script or approval

| Item                                     | Status                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Granting/revoking platform roles         | Operator script only ([runbook](article:ops.grant-role))                 |
| Usage reconciliation, subscription sweep | Operator-run; automation pending approval of a trusted scheduled backend |
| Online payments                          | Not active; needs approved backend and provider                          |
| MFA enforcement                          | Pending Identity Platform MFA approval                                   |
| Email delivery (invitations, renewals)   | Not active; links are shared manually                                    |
| Backups                                  | Manual operator export ([runbook](article:ops.backup))                   |

![Operational health](screens/platform-health.png)

## Escalation

- Security concern (lost device, suspected account misuse) → platform owner; operator revokes the
  role immediately.
- Customer data incident → platform owner and operator; follow the backup/restore runbook.
- Customer dispute over billing → platform owner.

## FAQs

- **Can I fix a customer's data for them?** No. Ask the company admin, or request support access to
  see the setup summary only.
- **Can I give myself a higher role?** No — only the operator script can set roles, and every change is
  logged.
