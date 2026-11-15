---
id: assets.transfer
title: Transfer an asset to another location
module: Assets & Inventory
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Assets
description: Move an asset between locations or sites with a permanent transfer record that captures the date, reason, condition on arrival and receiving employee.
routes: [/assets, /asset-transfers]
prerequisites:
  - An asset that is not archived
  - An active destination location
permissions:
  - Company owner or admin
screenshots: [admin-asset-transfers.png, phase4-04-asset-qr.png]
diagrams: [wf-17]
related: [assets.register, assets.qr, setup.audit, maintenance.asset-history]
sources:
  - apps/admin-web/src/management/Assets.tsx
  - apps/admin-web/src/management/store.ts
  - firebase/firestore.rules
keywords: [transfer, move asset, relocate, transfer log, condition on arrival, received by, movement history]
---

Assets move only through **Transfer**, never by editing the location. Each transfer is permanent
and cannot be edited, so the asset's movement history is always complete.

## Before you start

- The destination site must have an active location to receive the asset.
- Agree the reason and, if someone signs for it, who receives it.

## Steps

1. Open the asset in **Assets → Asset register** and select **Transfer**.
2. The drawer **Transfer asset** shows **1 From** — the current site and location.
3. Under **2 To**, choose the **Destination site** and **Destination location**.
4. Under **3 Details**, enter the **Transfer date**, the **Condition on arrival**, the **Reason**
   (for example *Relocated to new office*) and, optionally, **Received by** with the
   **Receiving employee** and **Notes**.
5. Select **Confirm transfer**. The message *<asset name> transferred.* appears.
6. Review all moves in **Assets → Asset transfers** (the transfer log) or on the asset's
   **Transfers** tab.

![The asset transfer log](screens/admin-asset-transfers.png)

{{diagram wf-17}}

## Expected result

- The asset shows its new site, location and condition.
- The transfer log lists the asset, **From**, **To**, **Date**, **Condition** and **Reason**.
- The transfer appears in **Administration → Audit history** under *Asset transfers*.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Choose the destination site and location.* | A destination field is empty. | Choose both. |
| *Enter the transfer date.* | The date is empty. | Enter the date. |
| *Enter a reason for the transfer.* | The reason is empty. | Describe why the asset moved. |
| *Choose a different destination location.* | The destination is the current location. | Choose another location. |
| *Choose an active location in the destination site.* | The location is archived or belongs to another site. | Choose an active location of that site. |
| *A location no longer exists.* | The location was removed while the form was open. | Reload and choose again. |
| *Archived assets cannot be transferred.* | The asset is archived. | Reactivate it first if it really moved. |
| *Choose an active employee to acknowledge receipt.* | The receiving employee is not active. | Choose an active employee or clear **Received by**. |
| *This asset changed. Close the form and reload before transferring.* | Someone changed the asset while the form was open. | Close, reload and transfer again. |

## Troubleshooting

- **The location field is greyed out in the edit form:** that is deliberate — use **Transfer**.
- **A transfer was recorded by mistake:** transfers cannot be edited or deleted. Record a new
  transfer back to the correct location with a reason such as *Correction of transfer on …*.
- **No transfers recorded yet:** the log is empty until the first transfer.

![The asset page with the Transfer button](screens/phase4-04-asset-qr.png)
