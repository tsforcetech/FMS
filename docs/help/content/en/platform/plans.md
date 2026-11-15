---
id: platform.plans
title: Create plans and publish plan versions
module: Sharaco Platform Administration
category: billing
audience: authenticated
apps: [platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: SaaS Platform
description: Define FacilityOS plans with limits, features, trial days, support level and an optional list price, and publish new immutable versions.
routes: [/plans]
prerequisites:
  - Platform owner or Billing administrator role
permissions:
  - New plan / Publish new version — Platform owner or Billing administrator
screenshots: [phase8-07-platform-plans.png, platform-plans.png]
diagrams: [wf-06]
related: [platform.subscriptions, platform.billing, saas.plan-usage, platform.overview]
sources:
  - apps/platform-web/src/App.tsx
  - apps/platform-web/src/store.ts
  - packages/shared/src/saas.ts
keywords: [plan, pricing, plan version, limits, features, trial days, Trial, Starter, Professional, Enterprise, Start from example, A plan with this code exists, Trial days must be 0–90, Use a short code such as STARTER]
---

A **plan** is what Sharaco sells: limits, features, trial length, support level and billing period.
Each change is published as a new **plan version**. Versions are **immutable** — existing
subscriptions keep the terms they were sold on until someone deliberately moves them to another
version. **No prices are assumed**: the list price is optional and only what you enter.

## Steps — create a plan

1. Open **Plans** and select **New plan**.
2. In **Start from example** choose *Trial*, *Starter*, *Professional* or *Enterprise*. The examples
   are editable starting points, not commercial offers.
3. Enter the **Code** (short upper-case code such as `STARTER`), **Name** and **Description**.
4. Set the limits — **Sites**, **Employees**, **Assets**, **Recurring schedules**, **Staff logins**.
   Enter **−1** for unlimited.
5. Tick the **Features**: *Customer portal*, *Mobile app*, *Advanced reports*, *Excel/PDF export*,
   *Bulk import*.
6. Set **Trial days** (0–90; 0 means no trial), **Billing period** (*Monthly* or *Annual*) and
   **Support level** (*Standard*, *Priority* or *Dedicated*).
7. Optionally enter a **List price** and three-letter **Currency**, or leave the price empty.
8. Keep **Status** *Active (available for new subscriptions)*, or choose *Retired*.
9. Select **Publish version**. The plan card shows *version 1*.

![Plan cards with limits and features](screens/phase8-07-platform-plans.png)

## Steps — change a plan

1. On the plan card select **Publish new version**. The form opens with the latest terms.
2. Change what is needed and select **Publish version**. The card shows the new version number.
3. Existing subscriptions are **not** changed. To move a company to the new terms, use
   **Upgrade / downgrade** on its company page (see [Manage a subscription](article:platform.subscriptions)).

{{diagram wf-06}}

## Expected result

- Active plans are offered when registering a company, assigning a plan and changing plan. Retired
  plans are not offered for new subscriptions.
- *plan.created* or *plan.version* appears in the platform audit log.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Use a short code such as STARTER.* | Code missing or invalid. | Enter an upper-case code. |
| *A plan with this code exists. Edit it to publish a new version.* | Code already used. | Use **Publish new version** on that plan. |
| *Trial days must be 0–90.* | Out of range. | Correct it. |
| *Enter a valid list price and currency, or leave the price empty.* | Price without valid currency (or the reverse). | Fix or clear both. |
