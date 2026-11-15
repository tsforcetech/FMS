---
id: assets.register
title: Register assets, furniture and equipment
module: Assets & Inventory
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Assets
description: Record equipment, tools, IT, vehicles, furniture and fixtures in the asset register — individually or as batches — with location, condition, custodian and purchase details.
routes: [/assets, /asset-categories, /furniture, /equipment, /suppliers]
helpIds: [setup.assets]
prerequisites:
  - A site with locations
  - Asset categories (and suppliers, if you record purchases)
permissions:
  - Company owner or admin
screenshots:
  [
    admin-assets.png,
    admin-asset-categories.png,
    phase4-04-asset-qr.png,
    admin-furniture.png,
    admin-equipment.png,
    admin-suppliers.png,
  ]
diagrams: [wf-16]
related:
  [
    assets.qr,
    assets.transfer,
    sites.facilities,
    maintenance.asset-history,
    maintenance.pm,
    import.overview,
    sites.archive,
  ]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/Assets.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
keywords:
  [
    asset,
    equipment,
    furniture,
    fixture,
    tool,
    IT equipment,
    vehicle,
    batch,
    serial number,
    warranty,
    custodian,
    asset code,
    category,
    supplier,
  ]
---

The **asset register** holds the things you maintain or track: equipment, tools, IT equipment,
vehicles, furniture and fixtures. Each asset has a permanent **Asset code** (used on its QR label),
lives at a physical location — never "at a client" — and keeps a history of condition changes and
transfers.

![The Assets → Furniture & fixtures screen](screens/admin-furniture.png)

![The Assets → Equipment screen](screens/admin-equipment.png)

![The Materials & inventory → Suppliers screen](screens/admin-suppliers.png)

## Before you start

- Create **Assets → Categories** (one level of subcategories is supported; each category can have
  a **Default asset class**).
- Optionally create **Materials & inventory → Suppliers** (**Supplies**: Assets, Materials, Assets
  and materials, or Services).
- Decide the tracking: **individual** for serialised items (one record per item) or **batch** for
  identical, non-serialised items such as 40 chairs.

## Steps

1. Open **Assets → Asset register** (or **Furniture & fixtures** / **Equipment**, which show the
   same register filtered by class) and select **Add asset**.
2. **General:** enter the **Asset code** (for example `AC-T1-0201`) and **Name**.
3. **Identification:** optionally the **External / legacy tag**; choose the **Asset class**
   (Equipment, Furniture, Fixture, Tool, IT equipment, Vehicle or Other) and **Category**; choose
   **Tracking** (cannot change later); set **Quantity** (1 for individual, up to 100,000 for a
   batch); add **Serial number** (individual only), **Brand** and **Model**.
4. **Location:** choose the **Site**, the **Location** and optionally a **Related facility**.
5. **Condition and responsibility:** choose the **Condition** (Excellent, Good, Fair, Poor,
   Critical), the **Custodian** (employee) and the **Responsible department**.
6. **Purchase:** optionally the **Supplier**, **Purchase date**, **Purchase cost** (in the
   company's accounting currency), **Warranty end date** and **Description**.
7. Choose the **Status** (_In service_ or _In storage_ for new assets) and select **Save asset**
   (_Asset created._).

![The asset register](screens/admin-assets.png)

{{diagram wf-16}}

## Expected result

- The asset appears in the register with its code, location and status (_In service_,
  _In storage_, _Under maintenance_, _Out of service_, _Disposed_ or _Archived_).
- The asset page offers **QR label** and **Transfer**, and tabs **Overview**, **History** and
  **Transfers**.

![An asset page with its QR label](screens/phase4-04-asset-qr.png)

## Common errors

| Message                                                                                                                 | Why                                                | What to do                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| _Individually tracked assets have quantity 1_                                                                           | Tracking is individual but quantity is not 1.      | Set quantity 1, or use batch tracking.                        |
| _Batches are not serialised. Track serialised items individually._                                                      | A batch has a serial number.                       | Remove the serial number, or register each item individually. |
| _Warranty must end after purchase_                                                                                      | The warranty end date is before the purchase date. | Correct the dates.                                            |
| _Use Transfer to move an asset so its movement history is recorded._                                                    | You changed the site or location in the edit form. | Close the form and use **Transfer**.                          |
| _Tracking cannot change after creation. Create a new record instead._                                                   | You changed individual/batch on a saved asset.     | Create a new asset with the right tracking.                   |
| _This code is already reserved. Choose another code._                                                                   | The asset code is used by another asset.           | Choose another code.                                          |
| _Your plan allows N assets. Archive unused records or ask Sharaco to upgrade your plan. Existing data stays available._ | The plan's asset limit is reached.                 | Archive disposed assets or ask about a larger plan.           |

## Troubleshooting

- **Lots of assets:** import them with **Administration → Import data** (see
  [Bulk import](article:import.overview)).
- **The asset has been scrapped:** set **Status** to _Disposed_; archive it later. Disposed and
  archived assets cannot be opened by scanning.
- **Maintenance history:** work orders and PM tasks for the asset appear in
  [Asset history](article:maintenance.asset-history).

![Asset categories](screens/admin-asset-categories.png)
