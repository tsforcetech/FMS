---
id: clients.clients
title: Register a client
module: Clients & Contracts
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Commercial
description: Record the individuals and companies you serve, with contact and tax details. Clients connect to sites only through contract allocations.
routes: [/clients]
permissions:
  - Company owner or admin
screenshots: [admin-clients.png]
diagrams: [wf-09]
related: [clients.contracts, clients.allocations, setup.customer-access, sites.archive, ts.duplicate-code]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
keywords: [client, customer, tenant, company client, individual, VAT, tax number, contact person]
---

A **client** is a person or company you provide services to — a tenant, an owner association, a
corporate customer. Clients hold contracts; they connect to sites and spaces **only through
contract allocations**, never directly.

## Before you start

You do not need a client to run your own properties. Add clients when you provide services under a
contract or want a customer to use the customer portal.

## Steps

1. Open **Clients & contracts → Clients** and select **Add client**.
2. Enter the **Code** (for example `CL-ACME`) and **Name**.
3. Choose the **Client type**: *Individual* or *Company* (required).
4. Under **Contact**, enter the **Contact person**, **Phone**, **Email**, **Address**,
   **Country** and **Tax / VAT identifier** as needed.
5. Select **Save client**. The message *Client created.* appears.
6. Continue with a [contract](article:clients.contracts) for the client.

![The clients list](screens/admin-clients.png)

{{diagram wf-09}}

## Expected result

The client appears in **Clients** with status *Active*. Its page has a **Contracts** tab listing
the client's contracts.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *This code is already reserved. Choose another code.* | Another client already uses the code. | Choose a different code. |
| *Use uppercase letters, numbers, - or _* | The code contains other characters. | Use a code such as `CL-ACME`. |
| *Archive or reassign active linked records first.* | You tried to archive a client that still has active contracts. | Archive the client's contracts first. |

## Troubleshooting

- **The client should see their places online:** create an allocation and then a
  [customer link](article:setup.customer-access).
- **A client changes its legal name:** edit the **Name**; the **Code** stays the same so history
  remains linked.
