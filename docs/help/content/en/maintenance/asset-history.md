---
id: maintenance.asset-history
title: View an asset's maintenance history
module: Maintenance & Work Orders
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Maintenance
description: See every inspection, preventive maintenance task and work order recorded for one asset.
routes: [/asset-history]
permissions:
  - Company owner or admin
screenshots:
  [phase4-16-work-order.png, phase4-04-asset-qr.png, admin-asset-history.png]
diagrams: [wf-31]
related:
  [
    assets.register,
    maintenance.pm,
    maintenance.work-orders,
    reports.maintenance,
  ]
sources:
  - apps/admin-web/src/management/Cases.tsx
keywords:
  [
    asset history,
    equipment history,
    service history,
    inspections,
    preventive,
    recurring,
    manual,
  ]
---

**Asset maintenance history** brings together everything done on one asset: inspection and preventive
tasks and corrective work orders.

![The Maintenance → Asset maintenance history screen](screens/admin-asset-history.png)

## Steps

1. Open **Maintenance → Asset maintenance history**.
2. Choose the **Asset**.
3. Read **Tasks and PM** — each task with its due time, its origin (_Preventive_, _Recurring_ or
   _Manual_) and status. Select one to open it with its checklist answers.
4. Read the work orders column — each work order with its number, title, date and status. Select one to
   open it in **Work orders**.

![A work order linked to an asset](screens/phase4-16-work-order.png)

{{diagram wf-31}}

## Expected result

You can show an auditor or client the complete service record of the asset.

![Asset record with its QR label](screens/phase4-04-asset-qr.png)

## Common errors

| Message                             | Why                                  | What to do                                         |
| ----------------------------------- | ------------------------------------ | -------------------------------------------------- |
| _Choose an asset_                   | No asset selected yet.               | Pick the asset.                                    |
| _No tasks recorded for this asset._ | No task was created with this asset. | Select the asset when creating tasks and PM plans. |
| _No work orders for this asset._    | No work order names this asset.      | Choose the asset when raising work orders.         |

## Troubleshooting

- Only tasks and work orders that **name the asset** appear. Work recorded against the location only is
  not linked to the asset.
- For counts and costs per asset use **Reports & analytics → Asset performance** (see
  [Maintenance reports](article:reports.maintenance)).
