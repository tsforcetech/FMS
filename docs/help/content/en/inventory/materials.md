---
id: inventory.materials
title: Set up materials, suppliers and stores
module: Assets & Inventory
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Inventory
description: Create material categories, materials with an exact unit of measure and reorder level, suppliers, and the stores that hold stock at each site.
routes: [/materials, /material-categories, /suppliers, /stores]
prerequisites:
  - A site (and location) for each store
permissions:
  - Company owner or admin
screenshots:
  [
    admin-materials.png,
    admin-stores.png,
    admin-material-categories.png,
    admin-suppliers.png,
  ]
diagrams: [wf-18]
related:
  [
    inventory.movements,
    inventory.balances,
    inventory.reversal,
    import.opening-stock,
    assets.register,
    sites.archive,
  ]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
  - packages/shared/src/inventory.ts
keywords:
  [
    material,
    consumable,
    unit of measure,
    reorder level,
    store,
    storeroom,
    store keeper,
    supplier,
    material category,
    kg,
    litre,
  ]
---

**Materials** are consumables you count — cleaning chemicals, filters, bulbs, paper. Stock is held
in **stores** at a site and changes only through posted
[stock transactions](article:inventory.movements). This article covers the master data you need
first.

![The Materials & inventory → Material categories screen](screens/admin-material-categories.png)

![The Materials & inventory → Suppliers screen](screens/admin-suppliers.png)

## Before you start

- Decide each material's **Unit of measure**. It cannot change after creation, so recorded
  quantities stay exact. Available units: Each, Box, Pack, Carton, Pair, Set, Roll, Bottle and Gram
  (whole numbers only); Kilogram and Litre (up to 3 decimals); Millilitre (whole numbers); Metre and
  Square metre (up to 2 decimals).
- Each store belongs to one site, which cannot change later.

## Steps

1. **Material categories:** open **Materials & inventory → Material categories**, select
   **Add material category**, enter the **Code** and **Name** (for example _Cleaning chemicals_)
   and save.
2. **Suppliers (optional):** open **Suppliers** and select **Add supplier**. Enter the **Code**,
   **Name**, what it **Supplies** (Assets, Materials, Assets and materials, or Services) and the
   contact details (**Contact person**, **Phone**, **Email**, **Address**, **Country**,
   **Tax / VAT identifier**).
3. **Materials:** open **Materials** and select **Add material**. Enter the **Code** and **Name**,
   choose the **Category** and **Unit of measure**, and optionally the **Reorder level**
   (_Balances at or below this level are flagged for reorder._), the **Preferred supplier** and a
   **Description**. Select **Save material**.
4. **Stores:** open **Stores** and select **Add store**. Enter the **Code** and **Name**, choose
   the **Site**, optionally the **Location** and **Store keeper**, and save.
5. Record the opening stock of each material in each store — see
   [Stock transactions](article:inventory.movements), or import it with
   [Opening stock import](article:import.opening-stock).

![Materials](screens/admin-materials.png)

{{diagram wf-18}}

## Expected result

- Materials and stores appear in their lists. Each material and store page has a **Stock** tab
  showing its balances.

![Stores](screens/admin-stores.png)

## Common errors

| Message                                                                      | Why                                                       | What to do                                                           |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| _Unit of measure cannot change after creation. Create a new record instead._ | You changed the unit of a saved material.                 | Create a new material with the correct unit and archive the old one. |
| _Site cannot change after creation. Create a new record instead._            | You changed the site of a saved store.                    | Create a new store at the other site.                                |
| _This code is already reserved. Choose another code._                        | The code is already used.                                 | Choose another code.                                                 |
| _Archive or reassign active linked records first._                           | A category or supplier is still used by active materials. | Change or archive those materials first.                             |

## Troubleshooting

- **A material is missing in a transaction:** archived materials are not offered; only active
  materials can be posted.
- **Reorder flags look wrong:** the reorder level is in the material's unit and is compared with
  each store's balance separately.
