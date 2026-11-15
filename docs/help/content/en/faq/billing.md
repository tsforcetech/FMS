---
id: faq.billing
title: Plans, subscriptions and billing
module: FAQs
category: billing
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Support
description: Questions about plans, limits, trials, read-only mode and invoices.
routes: []
screenshots: []
related: [saas.plan-usage, saas.read-only, ts.read-only, ts.export-limit]
sources:
  - packages/shared/src/saas.ts
  - apps/admin-web/src/management/planGate.ts
  - apps/admin-web/src/management/SaasPages.tsx
keywords: ["FAQ", "billing", "plan", "subscription", "trial", "limit", "upgrade", "invoice", "payment", "read-only"]
---

## Where can I see my plan?

The owner and admins open **Administration → Plan & usage**. It shows the plan, the subscription
status and how much of each limit you use. See [Plan and usage](article:saas.plan-usage).

## What do plans limit?

The number of **Sites**, **Employees**, **Assets**, **Recurring schedules** and **Staff logins**,
and whether the **Customer portal**, **Mobile app**, **Advanced reports**, **Excel/PDF export** and
**Bulk import** are included.

## What happens when I reach a limit?

You cannot add more of that record: *Your plan allows … Archive unused records or ask Sharaco to
upgrade your plan. Existing data stays available.*

## How do I upgrade or change plan?

Contact Sharaco. Plan changes are made by Sharaco platform staff; a company cannot change its own plan.

## What happens when the subscription ends?

The subscription goes through *renewal due* (14 days before the end), a *grace* period and then
*past due* and *expired*. If Sharaco sets the company to read-only, your data stays available to
view and export but changes are paused. Nothing is deleted. See
[Read-only subscription](article:ts.read-only).

## Can I pay online?

Not yet. Online payment is not active. Invoices are recorded by Sharaco billing staff, and no card
data is stored in FacilityOS.
