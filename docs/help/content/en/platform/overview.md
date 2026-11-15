---
id: platform.overview
title: The Sharaco platform console
module: Sharaco Platform Administration
category: billing
audience: authenticated
apps: [platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: SaaS Platform
description: What the Sharaco platform console is for, who can sign in, how platform roles differ from company roles, and how to read the overview figures.
routes: ['/']
prerequisites:
  - A Sharaco email account with a verified address
  - A platform role granted by an operator (see Operator runbook — grant a platform role)
permissions:
  - Any platform role (Platform owner, Billing administrator, Support, Read-only viewer)
screenshots: [phase8-10-platform-overview.png, platform-overview.png, platform-settings.png]
diagrams: [wf-01, wf-05]
related: [platform.companies, platform.plans, platform.subscriptions, platform.billing, platform.audit, platform.support, role.platform-admin, ts.platform-not-authorized, ops.grant-role]
sources:
  - apps/platform-web/src/App.tsx
  - apps/platform-web/src/store.ts
  - packages/shared/src/saas.ts
  - scripts/grant-platform-role.mjs
  - firebase/firestore.rules
keywords: [super admin, Sharaco, platform console, platformRole, custom claim, MRR, ARR, Not a Sharaco platform account, Multi-factor sign-in is not active, Your platform role needs a verified email address]
---

The **FacilityOS platform console** is Sharaco's own back office for the FacilityOS service. It is
a separate web app (published under `/FMS/platform/`) used to register customer companies (tenants),
maintain plans, manage subscriptions, record invoices and request support access. It is **not** used
to run any company's facility operations.

> **Warning:** Platform authority and company authority are completely separate. A company **owner**
> or **admin** role never opens the platform console, and a platform role never opens a company's
> operational data (tasks, employees, customers, stock, attendance, photos).

## Who can sign in

Platform access comes **only** from a `platformRole` custom claim on the person's Firebase account,
together with a **verified email address**. The claim can only be set by a Sharaco operator running
a trusted script with operator credentials (see
[Grant or revoke a platform role](article:ops.grant-role)). There is no sign-up page and no
button in any app that grants it.

| Platform role | Label in the console | Can do |
| --- | --- | --- |
| `owner` | Platform owner | Everything below, plus **Register company** |
| `billing` | Billing administrator | Plans, subscription actions, invoice records |
| `support` | Support | Request support access to a company |
| `viewer` | Read-only viewer | View all console pages, change nothing |

Every platform user can view every console page; buttons are only shown to roles that may use them,
and the security rules refuse anything else.

## Steps

1. Open the console and sign in with your Sharaco email and password.
2. If you see *Not a Sharaco platform account*, your account has no platform role, or the role has
   not taken effect yet — see [Platform access refused](article:ts.platform-not-authorized).
3. If you see *Your platform role needs a verified email address*, verify the address first.
4. After sign-in the side menu shows **Overview**, **Companies**, **Plans**, **Subscriptions**,
   **Billing records**, **Platform audit log**, **Operational health** and **Configuration**. Your
   email and role label are shown at the bottom with **Sign out**.

![Platform overview with tenant and subscription figures](screens/phase8-10-platform-overview.png)

## Reading the overview

- **Registered companies**, **Active subscriptions** (active, renewal due and grace), **Trials**,
  **Read-only (suspended/expired)**, **Expiring in 30 days**, **Companies without a plan**,
  **Sites (all tenants)** and **Staff logins (all tenants)** — counted from company, subscription and
  usage-counter records.
- **Plan distribution** — how many subscriptions use each plan.
- **Recurring revenue** — MRR and ARR per currency, computed **only** from invoices marked paid whose
  service period covers today. Trials and unpaid invoices never count, and currencies are not
  converted. If nothing qualifies: *No paid invoices cover today, so recurring revenue is zero.*
- **Recent platform events** — the latest entries of the platform audit log.

{{diagram wf-05}}

## What is not active yet

The console states these openly; do not promise them to customers:

- **Multi-factor sign-in** — an amber banner *Multi-factor sign-in is not active.* appears. The console
  is MFA-ready, but enforcing MFA needs Firebase Identity Platform MFA, which is **pending approval**.
- **Online payments** — disabled; invoices are recorded manually.
- **Email delivery** — invitation links are copied and sent by hand.
- **Automatic subscription sweep and usage reconciliation** — run by an operator.

See **Operational health** and [Platform audit, health and configuration](article:platform.audit).

![Configuration page showing your platform role and MFA state](screens/platform-settings.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Not a Sharaco platform account* | No platform role on this account (a company admin account, for example). | Ask an operator to grant a role; company admins use the admin app. |
| *Your platform role needs a verified email address.* | The claim exists but the email is unverified. | Verify the email, sign out and in again. |
| A button is missing | Your role does not include that action. | Ask a platform owner. |
