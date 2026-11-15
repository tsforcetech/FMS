---
id: role.customer
title: 'Role guide: Customer and tenant users'
module: Role Guides
category: customer-portal
audience: public
apps: [customer]
roles: [customer]
version: '0.8'
reviewed: '2026-11-15'
owner: Customer Success
description: What customers and tenants can see and do in the FacilityOS customer portal, and how to escalate service problems.
routes: ['/', /locations, /requests, /new, /history, /updates]
prerequisites:
  - Your facility provider invited you and linked your login to your organisation
  - Your provider's plan includes the customer portal
screenshots: [phase7-02-customer-overview.png, phase7-03-customer-new-request.png, phase7-05-customer-resolved.png]
diagrams: [wf-04, wf-41, wf-42]
related: [customer.sign-in, customer.requests, customer.confirm, customer.history, customer.updates, train.customer-request, faq.customer]
sources:
  - apps/customer-web/src/App.tsx
  - apps/admin-web/src/management/customerStore.ts
  - apps/admin-web/src/management/tenantSaas.ts
keywords: [customer, tenant, client, occupant, portal, service request, complaint]
---

If your company rents or uses space managed by a facility provider that uses FacilityOS, you may be
given a **customer portal** login (role `customer`). The portal shows only **your organisation's**
locations and requests. You never see the provider's staff records, other customers or internal
notes.

## What you can access

| Page | Use |
| --- | --- |
| **Overview** | Requests that need attention, recent requests, requests **To confirm** |
| **My locations** | The locations covered for your organisation (active, ended or starting later) |
| **Requests** / **New service request** | Raise and follow requests, add messages |
| **Service history** | Completed requests; export (if enabled) |
| **Updates** | Progress messages from the service team |
| **Profile** | Your organisation, contact and account |

![Customer overview](screens/phase7-02-customer-overview.png)

## Responsibilities

- Raise requests with a clear location, description and the right urgency.
- Reply to questions from the service team.
- Confirm resolved requests, or ask to reopen with what is still wrong.

## Typical workflow

1. **New service request** → choose **Location**, **What is it about?**, **Describe the problem**,
   **How urgent?** → **Submit request** ([Quick start](article:train.customer-request)).
2. Follow progress under **Requests** and **Updates**.
3. When the provider resolves it, it appears **To confirm**: select **Yes, confirm** or **Ask to
   reopen** ([Confirm or reopen](article:customer.confirm)).

![New service request](screens/phase7-03-customer-new-request.png)

![Resolved request to confirm](screens/phase7-05-customer-resolved.png)

{{diagram wf-41}}

## Escalation

1. Not resolved → **Ask to reopen** with details.
2. Urgent and not progressing → add a message and phone your provider's contact.
3. Emergency (safety risk, flooding) → phone the provider and emergency services; then record it.

## FAQs

- **"Your account is not set up yet"** — the provider has not linked your login to your organisation.
  Contact them.
- **"Your portal access has been withdrawn"** — your link was revoked or your contract ended.
- **"This is not a customer account"** — you signed in with a staff or admin account; use the Staff or
  admin app instead.
- **I forgot my password** — use the reset option on the sign-in page.
