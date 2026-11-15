---
id: clients.contracts
title: Create a contract
module: Clients & Contracts
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Commercial
description: Record a commercial agreement with a client — reference, dates and services — before allocating it to sites or spaces.
routes: [/contracts]
prerequisites:
  - An active client
permissions:
  - Company owner or admin
screenshots: [admin-contracts.png]
diagrams: [wf-10]
related: [clients.clients, clients.allocations, ts.allocation-expired, sites.archive]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
keywords: [contract, agreement, contract reference, start date, end date, services covered, expired contract]
---

A **contract** is a commercial agreement with a client. On its own it does not point at any
property: [contract allocations](article:clients.allocations) link the contract to the sites or
spaces it covers.

## Before you start

Create the [client](article:clients.clients) first. Have the contract reference, the start and
end dates and a summary of the services.

## Steps

1. Open **Clients & contracts → Contracts** and select **Add contract**.
2. Enter the **Contract reference** (the record code, for example `CT-2026-014`) and **Name**.
3. Choose the **Client**.
4. Enter the **Start date** and **End date** (both required; dates are inclusive).
5. Optionally describe the **Services covered**.
6. Choose the **Status**: *Draft* while it is being agreed, *Active* once signed.
7. Select **Save contract** (*Contract created.*).

![The contracts list](screens/admin-contracts.png)

{{diagram wf-10}}

## Expected result

- The contract appears with its client and dates. Its **Allocations** tab lists where it applies.
- When it ends, set it to *Expired*; archive it when no longer needed.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *End date must follow start date* | The end date is before the start date. | Correct the dates. |
| *Close linked allocations before changing the contract client or dates.* | The contract already has active allocations. | Terminate or expire those allocations, then change the contract, or create a new contract. |
| *Choose an active linked record.* | The client is archived. | Choose an active client. |
| *Archive or reassign active linked records first.* | You tried to archive a contract with active allocations. | Close the allocations first. |

## Troubleshooting

- **Renewal:** create a new contract for the new period and new allocations under it. The old
  contract and its allocations remain in history.
- **Allocation dates rejected:** allocations must fit inside the contract dates — see
  [Allocation expired](article:ts.allocation-expired).
