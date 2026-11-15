---
id: saas.plan-usage
title: Check your plan, limits and usage
module: SaaS Plans & Subscriptions
category: billing
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: SaaS Platform
description: See which FacilityOS plan your company is on, how much of each limit you use, which features are included and your billing history.
routes: [/plan]
helpIds: [saas.plan]
prerequisites:
  - You can sign in to the admin app
permissions:
  - Company owner or admin (the admin app is only open to these two roles)
screenshots: [phase8-09-tenant-plan-read-only.png, admin-plan.png]
diagrams: [wf-05, wf-06]
related:
  [
    saas.read-only,
    saas.support-access,
    exports.overview,
    import.overview,
    faq.billing,
    ref.whats-new,
  ]
sources:
  - apps/admin-web/src/management/SaasPages.tsx
  - apps/admin-web/src/management/usage.ts
  - apps/admin-web/src/management/planGate.ts
  - packages/shared/src/saas.ts
keywords:
  [
    subscription,
    plan,
    quota,
    limit,
    usage counters,
    upgrade,
    downgrade,
    invoice,
    billing history,
    Your plan allows,
    Usage counters are not set up for this company yet,
    No plan assigned yet,
    Unlimited,
  ]
---

Sharaco sells FacilityOS on **plans**. A plan sets limits (how many sites, employees, assets,
recurring schedules and staff logins your company can have) and switches features on or off
(customer portal, mobile app, advanced reports, Excel/PDF export, bulk import). **Administration →
Plan & usage** shows your current plan, how much of each limit you use, the features included,
the invoices Sharaco has recorded for you and any support-access requests.

> **Note:** Your company may have **no plan assigned yet**. Companies that existed before plans were
> introduced keep working with no limits until Sharaco assigns a plan. The page then shows _No plan
> assigned yet_.

## Steps

1. In the admin app open **Administration → Plan & usage**.
2. Read the heading: it shows the plan name (for example _Starter_) and its status pill (_Trial_,
   _Active_, _Renewal due_, _Grace_, _Past due_, _Suspended_, _Cancelled_ or _Expired_).
3. Check the limits table. For each limit — **Sites**, **Employees**, **Assets**, **Recurring
   schedules** and **Staff logins** — it shows **Used**, **Allowed** (_Unlimited_ when the plan has no
   limit) and a bar that fills as you approach the limit.
4. Check the feature pills under the table. Green means included; grey means not included in your
   plan: _Customer portal_, _Mobile app_, _Advanced reports_, _Excel/PDF export_, _Bulk import_.
5. Scroll to **Billing history** to see invoices Sharaco has recorded for your company (number,
   service period, amount and status _Draft_, _Issued_, _Paid_ or _Void_).
6. Scroll to **Sharaco support access** to approve or revoke support requests (see
   [Sharaco support access](article:saas.support-access)).

![Plan & usage showing limits, features and a read-only banner](screens/phase8-09-tenant-plan-read-only.png)

## How limits work

- A limit is checked **when you create** something that counts: a new site, employee, asset,
  recurring schedule or staff login. The usage counter goes up in the same save, so two people
  creating the last allowed site at the same moment cannot both succeed.
- **Archiving does not lower the number straight away.** Counts are corrected when Sharaco runs the
  usage reconciliation, which recounts only active records. Until then the **Used** figure can be
  higher than the number of active records.
- **Reaching a limit never blocks viewing or exporting** existing data. It only blocks creating one
  more record of that kind.
- Staff logins count the employee links made in **Administration → Staff access**.

{{diagram wf-05}}

## Changing plan

Plans are changed by Sharaco from the platform console — there is no upgrade button in the admin
app and no online payment yet. Contact Sharaco and say which plan you need. When a plan changes,
the new limits and features apply immediately. If you move to a smaller plan while you already use
more than its limits, nothing is deleted: you simply cannot create more records of that kind until
you are under the limit again.

{{diagram wf-06}}

## Expected result

You can see the plan, its status, your usage against each limit and which features you have.

## Common errors

| Message                                                                                                                                                                          | Why                                                         | What to do                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| _Your plan allows N sites. Archive unused records or ask Sharaco to upgrade your plan. Existing data stays available._ (or employees, assets, recurring schedules, staff logins) | The limit is reached.                                       | Archive records you no longer use and ask Sharaco to reconcile usage, or ask for a larger plan. |
| _Usage counters are not set up for this company yet. Ask Sharaco support to reconcile usage._                                                                                    | A plan was assigned before the usage counters were created. | Contact Sharaco support; an operator runs the usage reconciliation.                             |
| _Excel/PDF export is not included in your plan (…). Contact Sharaco to upgrade._                                                                                                 | The feature is switched off in your plan.                   | Ask Sharaco to change your plan.                                                                |
| _Bulk import is not included in your plan (…)._                                                                                                                                  | As above, for the Import Center.                            | Ask Sharaco to change your plan.                                                                |

## Troubleshooting

- **Used shows a dash (—):** no usage counters exist for your company. This is normal when no plan
  is assigned.
- **Used is higher than I expect:** archived records are only removed from the count by the usage
  reconciliation, which an operator runs (it is not automatic yet).
- **No invoices on record:** online payment is not active; Sharaco records invoices manually.

![Plan & usage page](screens/admin-plan.png)
