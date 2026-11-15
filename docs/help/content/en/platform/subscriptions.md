---
id: platform.subscriptions
title: Manage a company's subscription
module: Sharaco Platform Administration
category: billing
audience: authenticated
apps: [platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: SaaS Platform
description: Assign a plan, renew, extend a trial, upgrade or downgrade, suspend, reactivate or cancel a company's subscription, and read usage.
routes: [/subscriptions, '/companies/:id']
prerequisites:
  - Platform owner or Billing administrator role for any action
  - Usage counters exist for the company (registered companies have them; older companies need the usage reconciliation)
permissions:
  - Subscription actions — Platform owner or Billing administrator
screenshots: [phase8-08-platform-company.png, platform-subscriptions.png]
diagrams: [wf-05, wf-06, wf-07]
related:
  [
    platform.plans,
    platform.billing,
    saas.read-only,
    saas.plan-usage,
    ops.usage-reconcile,
    ops.subscription-sweep,
  ]
sources:
  - apps/platform-web/src/App.tsx
  - apps/platform-web/src/store.ts
  - packages/shared/src/saas.ts
  - scripts/subscription-sweep.ts
keywords:
  [
    renew,
    extend trial,
    upgrade,
    downgrade,
    suspend,
    reactivate,
    cancel,
    grace,
    past due,
    expired,
    This company has no usage counters yet,
    Only trials can be extended,
    Extend a trial by 1 to 90 days,
    Reactivate the subscription before renewing,
    The subscription is already running,
  ]
---

Each company has at most one **subscription**. Its status is computed from the subscription dates
and its administrative state, and is copied to the company as a snapshot that the security rules
read — so plan limits, features and read-only access take effect as soon as you act.

## Subscription statuses

_Trial_ → (trial ends) → _Past due_ → (30 days) → _Expired_.
_Active_ → (14 days before period end) _Renewal due_ → (period end) _Grace_ (7 days) → _Past due_
(30 days) → _Expired_. Administrative states: _Suspended_ and _Cancelled_. _Suspended_, _Cancelled_ and
_Expired_ make the company **read-only**; data is never deleted.

{{diagram wf-05}}

## Subscriptions list

Open **Subscriptions** to see every subscription with **Company**, **Plan**, **Status**, **Trial ends**
and **Period ends**. Filter with **All statuses**, and select a row to open the company page.

![Subscriptions list](screens/platform-subscriptions.png)

## Steps — assign the first plan

1. Open **Companies** and select the company. Under **Subscription** it says _No plan assigned.
   Existing data is unaffected; no limits apply._
2. Check **Usage**. If it says _No usage counters_, stop: an operator must first run the usage
   reconciliation for this company (see [Usage reconciliation](article:ops.usage-reconcile)).
3. Choose the plan in **Choose plan…** and select **Assign plan**. If the plan has trial days, the
   subscription starts as a trial; otherwise a monthly or annual period starts today.

## Steps — change an existing subscription

On the company page, under **Subscription** (facts: **Plan**, **Trial ends**, **Current period**,
**Grace**):

- **Renew** — adds one billing period (1 month or 12 months) from the current period end, or from
  today if it has already passed. Ends a trial.
- **Extend trial** — enter 1–90 days and select **Extend trial** (only for _Trial_ or a trial that is
  _Past due_).
- **Upgrade / downgrade** — choose a plan version in **Change plan…** and confirm. New limits and
  features apply immediately; nothing is deleted if usage is above a smaller plan's limits.
- **Suspend (read-only)** — the company becomes read-only immediately.
- **Reactivate** — returns a suspended or cancelled subscription to running.
- **Cancel** — confirm _Cancel this subscription? The company keeps read-only access to its data._

Each action writes an audit event (for example _subscription.renew_) in the same step.

![Company page with subscription actions, usage and support access](screens/phase8-08-platform-company.png)

{{diagram wf-07}}

## Usage

The **Usage** box shows the company's counters for each limit with _of N_ or _Unlimited_. Counters go
up when the company creates records and are corrected for archived records only by the usage
reconciliation.

## Common errors

| Message                                                                                                                   | Why                                   | What to do                              |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------- |
| _This company has no usage counters yet. Run the usage reconciliation (scripts/usage-reconcile.ts --apply) for it first…_ | Older company without counters.       | Ask an operator to run it, then assign. |
| _No subscription for this company. Assign a plan first._                                                                  | Action on a company without a plan.   | Assign a plan.                          |
| _Only trials can be extended._                                                                                            | Subscription not in trial.            | Use **Renew**.                          |
| _Extend a trial by 1 to 90 days._                                                                                         | Days out of range.                    | Correct it.                             |
| _Reactivate the subscription before renewing._                                                                            | Suspended or cancelled.               | **Reactivate** first.                   |
| _The subscription is already running._                                                                                    | Reactivate on a running subscription. | Nothing to do.                          |
| _The subscription is cancelled._                                                                                          | Suspend on a cancelled subscription.  | Reactivate if needed.                   |

## Troubleshooting

- **A trial or period has ended but the company is still full access:** date-based changes are
  applied by the subscription sweep, which an operator runs (see
  [Subscription sweep](article:ops.subscription-sweep)).
- **Payment received:** record it in [Billing records](article:platform.billing), then **Renew**.
