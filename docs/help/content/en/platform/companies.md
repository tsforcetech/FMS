---
id: platform.companies
title: Register and find companies
module: Sharaco Platform Administration
category: billing
audience: authenticated
apps: [platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: SaaS Platform
description: Search the tenant directory and register a new company with its owner invitation and optional plan in one audited step.
routes: [/companies]
prerequisites:
  - Platform owner role (to register); any platform role to view
  - The future owner's email address
permissions:
  - Register company — Platform owner only
screenshots: [platform-companies.png, phase8-08-platform-company.png]
diagrams: [wf-01, wf-02]
related:
  [
    platform.overview,
    platform.subscriptions,
    platform.plans,
    setup.invitations,
    setup.wizard,
    ops.provisioning,
  ]
sources:
  - apps/platform-web/src/App.tsx
  - apps/platform-web/src/store.ts
  - apps/admin-web/src/Join.tsx
keywords:
  [
    tenant,
    new customer,
    onboarding,
    register company,
    owner invitation,
    Company ID,
    This company ID is taken,
    Company ID: 3–41 lowercase letters,
    digits or hyphens,
  ]
---

**Companies** is the tenant directory: one row per company using FacilityOS. It shows the company
name and status, ID, plan, subscription status and access (full or read-only). Operational data stays
inside each company and is not visible here.

## Find a company

1. Open **Companies**.
2. Type part of the name or ID in **Search by name or ID…**.
3. Select a row to open the company page (subscription, usage and support access — see
   [Manage a subscription](article:platform.subscriptions)).

![Companies directory](screens/platform-companies.png)

## Register a new company

Registration creates the company record, **zeroed usage counters**, the optional plan subscription
and a **14-day owner invitation** — all in one audited step.

1. Select **Register company** (shown to Platform owners only).
2. Enter the **Company ID** — 3–41 lowercase letters, digits or hyphens, for example
   `gulf-facilities`. It is permanent and appears in links.
3. Enter the **Company name** and choose the **Time zone**.
4. Enter the **Owner email** — the address the company owner will sign in with.
5. Optionally choose a **Plan**. Leave _No plan yet_ to register without limits.
6. Select **Register**. A green panel _Send this invitation to the owner_ shows the invitation link.
7. Copy the link and send it to the owner yourself (email delivery is not automated). The owner signs
   in or creates an account with **that exact email**, verifies it and accepts the invitation.

{{diagram wf-01}}

## Expected result

- The company appears in the directory, and the event _company.registered_ is in the platform audit
  log.
- When the owner accepts, they become the company **owner** and continue with **Administration →
  Company setup** in the admin app (see [Company setup wizard](article:setup.wizard)).

{{diagram wf-02}}

## Common errors

| Message                                                  | Why                                                                                   | What to do                                                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _Company ID: 3–41 lowercase letters, digits or hyphens._ | Invalid ID.                                                                           | Use a short lowercase ID.                                                                                                                                                            |
| _This company ID is taken._                              | Another company uses the ID.                                                          | Choose another.                                                                                                                                                                      |
| _Enter the owner’s email address._                       | Owner email missing or invalid.                                                       | Enter it.                                                                                                                                                                            |
| Owner says the link does not work                        | Wrong email used, email not verified, invitation older than 14 days, or already used. | Check the email and verification. The console has no resend button for an expired owner invitation — escalate to an operator (see [Provisioning runbook](article:ops.provisioning)). |

## Troubleshooting

- **Existing companies created before plans:** they show no plan. Before assigning one, an operator
  must run the usage reconciliation — see [Usage reconciliation](article:ops.usage-reconcile).
