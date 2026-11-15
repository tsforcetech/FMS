---
id: saas.read-only
title: When your subscription is read-only
module: SaaS Plans & Subscriptions
category: billing
audience: public
apps: [admin, staff, mobile, customer]
roles: [owner, admin, site_manager, department_manager, supervisor, technician, staff, customer]
version: '0.8'
reviewed: '2026-11-15'
owner: SaaS Platform
description: What a suspended, cancelled or expired subscription means, what still works, and how to get full access back.
routes: [/plan]
helpIds: [saas.read-only]
permissions:
  - Everyone in the company is affected; only Sharaco can reactivate the subscription
screenshots: [phase8-09-tenant-plan-read-only.png]
diagrams: [wf-05, wf-07]
related: [saas.plan-usage, exports.overview, ts.read-only, faq.billing, mobile.offline]
sources:
  - packages/shared/src/saas.ts
  - apps/admin-web/src/management/planGate.ts
  - apps/admin-web/src/App.tsx
  - scripts/subscription-sweep.ts
  - firebase/firestore.rules
keywords: [suspended, cancelled, expired, past due, grace, read only, locked, cannot save, Read-only subscription, Your subscription is read-only, so data cannot be imported, reactivate]
---

When a subscription is **suspended**, **cancelled** or has **expired**, FacilityOS puts the whole
company into **read-only** mode. Your data is kept exactly as it was — nothing is deleted or
overwritten — and everyone can still sign in, look at records and **export** them. What stops is
change: creating, editing, completing tasks, posting stock, importing and similar actions are refused
until Sharaco reactivates the subscription.

## How a subscription becomes read-only

| Status | Meaning | Access |
| --- | --- | --- |
| *Trial* | Within the trial period | Full |
| *Active* | Paid period running | Full |
| *Renewal due* | Less than 14 days before the period ends | Full |
| *Grace* | Period ended; grace days running (7 by default) | Full |
| *Past due* | Grace (or the trial) ended; up to 30 more days | Full |
| *Suspended* | Sharaco suspended the subscription | **Read-only** |
| *Cancelled* | Sharaco cancelled the subscription | **Read-only** |
| *Expired* | 30 days after *Past due* began | **Read-only** |

Statuses based on dates (trial ending, renewal, grace, past due, expiry) are applied when Sharaco
runs the subscription sweep. The sweep is currently run by a Sharaco operator, not automatically, so
the change can happen a little later than the date suggests.

{{diagram wf-07}}

## What you see

- **Admin app:** an amber banner on every page — *Read-only subscription. Your data stays available
  to view and export, but changes are paused. See Administration → Plan & usage.* The **Plan &
  usage** page explains the situation, and buttons that would change data (for example **Invite
  someone**) are disabled or refused when pressed.
- **Import Center:** *Your subscription is read-only, so data cannot be imported.*
- **Staff web, mobile app and customer portal:** lists and records still open, but saving — starting
  or submitting a task, reporting an issue, raising a service request — is refused with a
  permission message.

![Plan & usage with the read-only banner](screens/phase8-09-tenant-plan-read-only.png)

## Steps to restore full access

1. An owner or admin opens **Administration → Plan & usage** and notes the plan and status.
2. Contact Sharaco (your account contact or support) and ask for the subscription to be renewed or
   reactivated.
3. Sharaco reactivates or renews the subscription in the platform console. The change takes effect
   at once; refresh the app.
4. Check that the banner has gone and that a test change (for example editing a note) saves.

## What still works while read-only

- Signing in and viewing every record you were allowed to see before.
- **Excel, PDF and CSV exports** (if your plan includes exports) — see
  [Export to Excel, PDF or CSV](article:exports.overview). Use this to keep your own copy.
- Reports and dashboards.

> **Warning:** Work captured offline on the mobile app cannot be saved to the server while the
> company is read-only. Check the app's **Sync** screen after access is restored and resolve any
> item that was refused (see [Offline work](article:mobile.offline)).

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Read-only subscription.* banner | Subscription suspended, cancelled or expired. | Contact Sharaco to reactivate. |
| *Your subscription is read-only, so data cannot be imported.* | Imports are writes. | Wait for reactivation. |
| Permission denied when saving | Writes are refused by the security rules while read-only. | As above; exports still work. |

## Troubleshooting

- **The status says Past due but we can still work:** correct — *Past due* still has full access.
  Renew before it reaches *Expired*.
- **We paid but are still read-only:** payments are recorded manually by Sharaco; ask them to record
  the payment and renew or reactivate the subscription.
- See also [Read-only subscription](article:ts.read-only).
