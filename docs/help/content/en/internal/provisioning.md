---
id: ops.provisioning
title: 'Operator runbook: provision company owners and logins'
module: Sharaco Platform Administration
category: technical-support
audience: internal
apps: [platform, admin]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: Platform Operations
description: When and how to use the trusted provisioning scripts for a company owner or a staff/customer login, and when to use invitations instead.
routes: []
screenshots: [phase5-01-admin-link-login.png]
prerequisites:
  - Operator Application Default Credentials for the project
  - Node.js and repository dependencies (npm ci)
  - A request from the company owner or Sharaco account manager
permissions:
  - Sharaco operator with project credentials
diagrams: [wf-01, wf-03, wf-04]
related: [platform.companies, setup.invitations, setup.staff-access, setup.customer-access, ts.not-linked]
sources:
  - scripts/provision-owner.mjs
  - scripts/provision-staff.mjs
  - apps/admin-web/src/management/tenantSaas.ts
  - apps/platform-web/src/store.ts
keywords: [provision, owner, staff login, customer login, password setup link, provision-owner, provision-staff, Refusing to overwrite, Owner/admin roles are not provisioned here]
---

The normal path needs no operator: a Platform owner uses **Register company** in the console, which
creates an owner invitation; company admins then invite their own people from **Administration →
Invitations**. The scripts below are for cases the apps cannot cover, and both are run only by an
operator with Application Default Credentials. They refuse emulator/demo projects (use
`seed-emulator.mjs` locally).

> **Warning:** The repository is public. Use placeholders in tickets and notes; never store
> passwords, reset links or personal data in Git, chat or this documentation. Reset links are
> one-time secrets: hand them to the person privately.

{{diagram wf-01}}

## Prefer invitations

| Need | Use |
| --- | --- |
| New company + owner | Console **Register company** (14-day owner invitation) |
| Admin, manager, supervisor, technician, staff, viewer, customer | Company admin: **Administration → Invitations** (owners only invite admins) |
| Company created outside the console, owner already has an account | `provision-owner.mjs` |
| Staff/customer login where invitations cannot be used | `provision-staff.mjs` |

## Provision a company with an existing owner account

The owner must already have an enabled email/password Firebase account. The script creates the
company, the owner membership, the directory entry and an audit entry (*company.owner.provisioned*),
and **refuses to overwrite** any existing company or membership.

```bash
node scripts/provision-owner.mjs --project facilityos-43386 --confirm-project facilityos-43386 --company <company-id> --name "<Company name>" --uid <owner-auth-uid> --time-zone <IANA zone, default Asia/Dubai>
```

Afterwards: the company has no plan and no usage counters. Run the
[usage reconciliation](article:ops.usage-reconcile) before assigning a plan.

## Provision a staff or customer login

Creates (or reuses) a Firebase account **without choosing a password**, sets the membership role,
writes *company.staff.provisioned* to the company audit history and prints a **one-time
password-setup link**.

```bash
node scripts/provision-staff.mjs --project facilityos-43386 --confirm-project facilityos-43386 --company <company-id> --email <person-email> --name "<Full name>" --role <site_manager|department_manager|supervisor|technician|staff|viewer|customer>
```

Then:

1. Send the password-setup link to the person privately.
2. Ask a company owner/admin to link the login: staff → **Administration → Staff access** (to an
   employee); customer → **Administration → Customer access** (to a client). Until then the person
   sees *Your login is not linked to an employee yet* (see [Not linked](article:ts.not-linked)).

{{diagram wf-03}}

![Linking a provisioned login to an employee in Staff access](screens/phase5-01-admin-link-login.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Existing company or membership found. Refusing to overwrite.* | Company ID or membership exists. | Choose another ID or use invitations. |
| *Owner must be an enabled, existing email/password account* / *Enable password authentication for this owner first* | Owner account missing, disabled or not password-based. | Fix the account first. |
| *Role must be one of: … Owner/admin roles are not provisioned here.* | Owner/admin requested. | Use the console or an invitation. |
| *This login is an owner/admin. Refusing to change it.* | Script would downgrade an admin. | Do not; ask the company owner. |
| *Refusing to convert between a staff login and a customer login. Use a separate email address.* | Role family change. | Use a different email. |
| *Company not found or not active.* | Wrong ID or company not active. | Check the ID and company status. |
