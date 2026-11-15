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
related:
  [
    clients.contracts,
    clients.clients,
    sites.locations,
    setup.customer-access,
    ts.allocation-expired,
    sites.archive,
  ]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
  - packages/shared/src/allocations.ts
keywords:
  [
    allocation,
    occupancy,
    exclusive occupancy,
    shared occupancy,
    service coverage,
    space,
    terminate,
    effective termination date,
    overlapping occupancy,
  ]
---

A **contract allocation** says _this contract applies here_. It links one contract to an existing
site, or to a specific space inside it. The client is always taken from the contract, so a site
never needs to know its client directly.

## Before you start

- Choose the **Allocation type**:
  - **Service coverage** — the contract covers services at a whole site (or a space). No space is
    needed.
  - **Exclusive occupancy** — the client alone occupies a space (for example _Office 201_).
  - **Shared occupancy** — several clients share a space.
- Occupancy needs a specific space and dates within **one calendar year**. Split multi-year
  contracts into yearly allocations.
- Dates are inclusive and **cannot be edited after saving**.

## Steps

1. Open **Clients & contracts → Contract allocations** and select **Add allocation**.
2. Read the banner: _Service coverage can cover a whole site. Occupancy needs a specific space and
   dates within one calendar year. Dates are inclusive and cannot be edited after saving._
3. Enter the **Code** and **Name**.
4. Choose the **Contract**. A green panel **Client taken from the contract** shows the client.
5. Choose the **Site** and, for occupancy, the **Space (empty for whole-site service)**.
6. Choose the **Allocation type**.
7. Enter the **Start date** and **End date**. They must fit within the contract dates.
8. Choose _Draft_ or _Active_ and select **Save allocation** (_Allocation created._).

![Contract allocations](screens/admin-allocations.png)

{{diagram wf-11}}

### Close an allocation

Allocations follow a fixed lifecycle: _Draft_ → _Active_ → _Terminated_ or _Expired_ →
_Archived_ (a draft can also be archived directly).

1. Open the allocation and select **Edit**.
2. To end it early, set **Status** to _Terminated_ and enter the **Effective termination date**
   (within the allocation dates). To let it run out, set _Expired_.
3. Save. Later you can archive it.

{{diagram wf-12}}

## Expected result

- The allocation shows the contract, site, space, type and dates, and **Client at allocation**.
- The contract's **Allocations** tab and the site's **Allocations** tab list it.
- A customer linked to the client can now be given these places in
  [Customer access](article:setup.customer-access).

## Common errors

| Message                                                                                                           | Why                                                                                                                                      | What to do                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| _Choose a space for occupancy_                                                                                    | Occupancy was chosen without a space.                                                                                                    | Choose the space, or use _Service coverage_.                            |
| _Occupancy must fit one calendar year. Split multi-year contracts into annual allocations._                       | Start and end are in different years.                                                                                                    | Create one allocation per year.                                         |
| _Allocation dates must fit within the contract dates._                                                            | The dates fall outside the contract.                                                                                                     | Adjust the dates or the contract.                                       |
| _This space already has an overlapping occupancy allocation._                                                     | Another exclusive allocation overlaps, or you added exclusive occupancy over an existing one. Shared allocations may overlap each other. | Choose other dates or another space, or terminate the other allocation. |
| _This space/year has reached its 12-allocation limit. Contact the administrator for a reviewed capacity upgrade._ | A space can hold at most 12 occupancy allocations per year.                                                                              | Contact your administrator.                                             |
| _Allocation identity and dates are immutable. Close this allocation and create a replacement._                    | You changed the contract, site, space, type or dates of a saved allocation.                                                              | Terminate it and create a new allocation.                               |
| _Choose a date within the allocation interval_                                                                    | The effective termination date is outside the allocation dates.                                                                          | Enter a date between start and end.                                     |
| _Only termination uses an effective end date_                                                                     | You entered an effective termination date without terminating.                                                                           | Clear it, or set status _Terminated_.                                   |
| _Termination dates cannot change after the decision._                                                             | The allocation is already terminated.                                                                                                    | Leave it; create a new allocation if needed.                            |
| _This allocation cannot change to that status._                                                                   | The status change is not allowed (for example _Active_ → _Draft_).                                                                       | Follow the lifecycle above.                                             |
| _Create a draft or active allocation._                                                                            | A new allocation was given another status.                                                                                               | Choose _Draft_ or _Active_.                                             |
| _Contract client changed. Create a new allocation._                                                               | The contract's client changed after this allocation was made.                                                                            | Create a new allocation.                                                |
| _Reserved occupancy can only be shortened by termination._                                                        | You tried to extend or move an occupancy reservation.                                                                                    | Terminate and create a new allocation.                                  |

## Troubleshooting

- **No _Archive_ button on an active allocation:** terminate it or let it expire first.
- **A customer no longer sees a place:** check whether the allocation was terminated or expired.
  See [Allocation expired](article:ts.allocation-expired).
