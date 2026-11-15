---
id: clients.allocations
title: Allocate a contract to a site or space
module: Clients & Contracts
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Commercial
description: Connect a contract to a whole site for service coverage, or to a specific space for exclusive or shared occupancy, and close allocations correctly.
routes: [/allocations]
prerequisites:
  - An active contract with dates
  - The site, and the space (location) for occupancy
permissions:
  - Company owner or admin
screenshots: [admin-allocations.png]
diagrams: [wf-11, wf-12]
related: [clients.contracts, clients.clients, sites.locations, setup.customer-access, ts.allocation-expired, sites.archive]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
  - packages/shared/src/allocations.ts
keywords: [allocation, occupancy, exclusive occupancy, shared occupancy, service coverage, space, terminate, effective termination date, overlapping occupancy]
---

A **contract allocation** says *this contract applies here*. It links one contract to an existing
site, or to a specific space inside it. The client is always taken from the contract, so a site
never needs to know its client directly.

## Before you start

- Choose the **Allocation type**:
  - **Service coverage** — the contract covers services at a whole site (or a space). No space is
    needed.
  - **Exclusive occupancy** — the client alone occupies a space (for example *Office 201*).
  - **Shared occupancy** — several clients share a space.
- Occupancy needs a specific space and dates within **one calendar year**. Split multi-year
  contracts into yearly allocations.
- Dates are inclusive and **cannot be edited after saving**.

## Steps

1. Open **Clients & contracts → Contract allocations** and select **Add allocation**.
2. Read the banner: *Service coverage can cover a whole site. Occupancy needs a specific space and
   dates within one calendar year. Dates are inclusive and cannot be edited after saving.*
3. Enter the **Code** and **Name**.
4. Choose the **Contract**. A green panel **Client taken from the contract** shows the client.
5. Choose the **Site** and, for occupancy, the **Space (empty for whole-site service)**.
6. Choose the **Allocation type**.
7. Enter the **Start date** and **End date**. They must fit within the contract dates.
8. Choose *Draft* or *Active* and select **Save allocation** (*Allocation created.*).

![Contract allocations](screens/admin-allocations.png)

{{diagram wf-11}}

### Close an allocation

Allocations follow a fixed lifecycle: *Draft* → *Active* → *Terminated* or *Expired* →
*Archived* (a draft can also be archived directly).

1. Open the allocation and select **Edit**.
2. To end it early, set **Status** to *Terminated* and enter the **Effective termination date**
   (within the allocation dates). To let it run out, set *Expired*.
3. Save. Later you can archive it.

{{diagram wf-12}}

## Expected result

- The allocation shows the contract, site, space, type and dates, and **Client at allocation**.
- The contract's **Allocations** tab and the site's **Allocations** tab list it.
- A customer linked to the client can now be given these places in
  [Customer access](article:setup.customer-access).

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Choose a space for occupancy* | Occupancy was chosen without a space. | Choose the space, or use *Service coverage*. |
| *Occupancy must fit one calendar year. Split multi-year contracts into annual allocations.* | Start and end are in different years. | Create one allocation per year. |
| *Allocation dates must fit within the contract dates.* | The dates fall outside the contract. | Adjust the dates or the contract. |
| *This space already has an overlapping occupancy allocation.* | Another exclusive allocation overlaps, or you added exclusive occupancy over an existing one. Shared allocations may overlap each other. | Choose other dates or another space, or terminate the other allocation. |
| *This space/year has reached its 12-allocation limit. Contact the administrator for a reviewed capacity upgrade.* | A space can hold at most 12 occupancy allocations per year. | Contact your administrator. |
| *Allocation identity and dates are immutable. Close this allocation and create a replacement.* | You changed the contract, site, space, type or dates of a saved allocation. | Terminate it and create a new allocation. |
| *Choose a date within the allocation interval* | The effective termination date is outside the allocation dates. | Enter a date between start and end. |
| *Only termination uses an effective end date* | You entered an effective termination date without terminating. | Clear it, or set status *Terminated*. |
| *Termination dates cannot change after the decision.* | The allocation is already terminated. | Leave it; create a new allocation if needed. |
| *This allocation cannot change to that status.* | The status change is not allowed (for example *Active* → *Draft*). | Follow the lifecycle above. |
| *Create a draft or active allocation.* | A new allocation was given another status. | Choose *Draft* or *Active*. |
| *Contract client changed. Create a new allocation.* | The contract's client changed after this allocation was made. | Create a new allocation. |
| *Reserved occupancy can only be shortened by termination.* | You tried to extend or move an occupancy reservation. | Terminate and create a new allocation. |

## Troubleshooting

- **No *Archive* button on an active allocation:** terminate it or let it expire first.
- **A customer no longer sees a place:** check whether the allocation was terminated or expired.
  See [Allocation expired](article:ts.allocation-expired).
