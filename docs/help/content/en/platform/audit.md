---
id: platform.audit
title: Platform audit log, operational health and configuration
module: Sharaco Platform Administration
category: billing
audience: authenticated
apps: [platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: SaaS Platform
description: Review every privileged platform change, see which platform functions are automatic, manual or pending, and check your own role and MFA state.
routes: [/audit, /health, /settings]
permissions:
  - Any platform role (read-only pages)
screenshots: [platform-audit.png, platform-health.png, platform-settings.png]
related: [platform.overview, ops.grant-role, ops.subscription-sweep, ops.usage-reconcile, ops.backup]
sources:
  - apps/platform-web/src/App.tsx
  - apps/platform-web/src/store.ts
  - scripts/grant-platform-role.mjs
  - scripts/subscription-sweep.ts
  - firebase/firestore.rules
keywords: [audit, events, platformEvents, health, configuration, MFA, payment provider, backups, subscription.sweep, platform.role.granted]
---

## Platform audit log

**Platform audit log** lists up to the latest 300 platform events with **When**, **Event**,
**Subject**, **Detail** and **By**. Every privileged change made in the console is written **in the
same batch** as the change itself, by the same user; the security rules refuse forged, reused or
someone else's events, and events cannot be edited or deleted from the apps.

Typical events:

| Event | Written by |
| --- | --- |
| *company.registered* | Register company |
| *plan.created*, *plan.version* | New plan / Publish new version |
| *subscription.assigned*, *subscription.renew*, *subscription.extend_trial*, *subscription.change_plan*, *subscription.suspend*, *subscription.reactivate*, *subscription.cancel* | Subscription actions |
| *invoice.saved*, *invoice.paid_manual* | Billing records |
| *platform.role.granted*, *platform.role.revoked* | Operator script (By: trusted-operator) |
| *subscription.sweep* | Operator subscription sweep |

Operator provisioning scripts write to the company's own audit history instead
(*company.owner.provisioned*, *company.staff.provisioned*), not to this log.

![Platform audit log](screens/platform-audit.png)

## Operational health

**Operational health** states honestly what runs automatically today:

| Item | State | Meaning |
| --- | --- | --- |
| Firestore security rules | Active | Platform roles, plan quotas, read-only suspension and invitations are enforced by the rules. |
| Usage reconciliation | Manual | Operator-run; automatic runs need a trusted scheduled backend — pending approval. |
| Subscription expiry sweep | Manual | Operator-run; lapsed subscriptions become read-only when the sweep runs. |
| Online payments | Pending | Needs a trusted backend for provider webhooks. |
| Email delivery (invitations, renewals) | Pending | Invitation links are shared manually. |
| Backups | Pending | No automatic backups on the Spark plan; operator JSON export only. |

![Operational health](screens/platform-health.png)

## Configuration

**Configuration** shows **Your platform role**, **Multi-factor sign-in** (*Used for this session* or
*Not used (enforcement pending Identity Platform MFA)*), **Payment provider** (*Disabled — pending
integration*) and **How roles are granted** — only by the trusted operator script; tenant roles never
grant platform access. Nothing on this page can be changed from the console.

![Configuration](screens/platform-settings.png)
