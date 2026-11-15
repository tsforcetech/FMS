---
id: maintenance.work-orders
title: Handle corrective work orders
module: Maintenance & Work Orders
category: maintenance
audience: public
apps: [admin, staff]
roles: [owner, admin, technician]
version: '0.4'
reviewed: '2026-11-15'
owner: Maintenance
description: Raise a work order, assign it, track it through hold, resolution, verification and closure, and issue materials against it.
routes: [/work-orders]
permissions:
  - Admin app — company owner or admin
  - Staff web and mobile — assigned staff work on their own work orders
screenshots:
  [phase4-16-work-order.png, phase5-12-work-order.png, admin-work-orders.png]
diagrams: [wf-32]
related:
  [
    cases.reported-issues,
    cases.complaints,
    cases.escalations,
    cases.sla,
    staff.work-orders,
    inventory.movements,
    maintenance.asset-history,
    reports.maintenance,
    train.work-order,
  ]
sources:
  - packages/shared/src/cases.ts
  - apps/admin-web/src/management/Cases.tsx
  - apps/admin-web/src/management/casesStore.ts
keywords:
  [
    work order,
    WO,
    corrective maintenance,
    repair,
    on hold,
    verify fix,
    reopen,
    issue material,
    Material issued and stock updated,
    Enter a reason or resolution note,
  ]
---

A **work order** (reference `WO-…`) tracks a repair from report to closure. Work orders can be raised
manually, from a [reported issue](article:cases.reported-issues), from a
[complaint](article:cases.complaints) or from an inspection.

![The Maintenance → Work orders screen](screens/admin-work-orders.png)

## Before you start

- Set up [SLA policies](article:cases.sla) if you want response and resolution targets. Targets are
  calculated and stored when the work order is created.

## Steps

### Raise a work order

1. Open **Maintenance → Work orders** and select **New work order**.
2. Enter the **Title** and **Description**, choose **Priority**, **Severity**, **Problem category**
   (for example _HVAC_, _Electrical_, _Plumbing_) and **Reported by**.
3. Under **Where**, choose the **Site** (required) and optionally the **Location**, **Facility**,
   **Asset** and **Department**, and a **Planned date**.
4. Select **Create**. The toast _Work order created._ confirms it.

### Work it to closure

Open the work order. The buttons show only the actions allowed in its current status:

| Button                              | From                                  | To          |
| ----------------------------------- | ------------------------------------- | ----------- |
| **Mark reviewed**                   | Reported                              | Reviewed    |
| **Assign**                          | Reported, Reviewed, Assigned, On hold | Assigned    |
| **Start work**                      | Assigned                              | In progress |
| **Put on hold** (reason)            | Assigned, In progress                 | On hold     |
| **Resume**                          | On hold                               | In progress |
| **Add update** (note)               | Assigned, In progress, On hold        | no change   |
| **Mark resolved** (resolution note) | In progress                           | Resolved    |
| **Verify fix**                      | Resolved                              | Verified    |
| **Close**                           | Resolved, Verified                    | Closed      |
| **Reopen** (reason)                 | Resolved, Verified, Closed            | In progress |
| **Cancel** (reason)                 | Reported, Reviewed, Assigned, On hold | Cancelled   |

The first review, assignment or start records the **response** time; **Mark resolved** records the
resolution time used for SLA.

![Work order with status, SLA, history and actions](screens/phase4-16-work-order.png)

{{diagram wf-32}}

### Issue materials

While the work order is _Assigned_, _In progress_ or _On hold_, select **Issue material**, choose the
**Material**, **From store**, quantity and optionally **Issued to**, then **Issue**. The stock moves
through the inventory ledger (_Material issued and stock updated._) and the line appears under
**Materials used**.

### Escalate

Select **Escalate** to raise an escalation to another department (see
[Escalations](article:cases.escalations)).

![Technician view of a work order in the staff portal](screens/phase5-12-work-order.png)

## Expected result

The **History** section records every action with who, when and why. Closed and cancelled work orders
stay searchable and appear in [Asset maintenance history](article:maintenance.asset-history).

## Common errors

| Message                                                          | Why                                                 | What to do             |
| ---------------------------------------------------------------- | --------------------------------------------------- | ---------------------- |
| _Enter a title._                                                 | Title missing.                                      | Add a short title.     |
| _Choose a site._ / _Choose an active site._                      | No or inactive site.                                | Choose an active site. |
| _Enter a reason or resolution note._                             | Hold, resolve, reopen, update and cancel need text. | Type the note.         |
| _Choose at least one employee._                                  | **Assign** without people.                          | Select employees.      |
| _Choose a material and a store._                                 | Material issue form incomplete.                     | Choose both.           |
| _Enter a quantity greater than zero._                            | Quantity is zero or empty.                          | Enter the quantity.    |
| _This record was updated by someone else. Reload and try again._ | Concurrent change.                                  | Reload and repeat.     |

## Troubleshooting

- **Not enough stock:** the ledger refuses an issue larger than the store balance (_Not enough stock.
  Available in the source store: …_); receive or transfer stock first (see [Stock movements](article:inventory.movements)).
- **Costs** (labour, vendor, material, other) are recorded in [Maintenance reports](article:reports.maintenance).
