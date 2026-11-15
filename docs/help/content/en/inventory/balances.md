---
id: inventory.balances
title: Check stock balances and reorder flags
module: Assets & Inventory
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Inventory
description: See the on-hand quantity of every material in every store, filter by store or material, and spot items to reorder.
routes: [/stock]
permissions:
  - Company owner or admin
screenshots: [admin-stock.png]
diagrams: [wf-18]
related: [inventory.movements, inventory.materials, inventory.reversal, reports.inventory, exports.overview]
sources:
  - apps/admin-web/src/management/Assets.tsx
  - packages/shared/src/inventory.ts
keywords: [stock balance, on hand, reorder, low stock, empty, in stock, inventory level]
---

**Materials & inventory → Stock balance** shows how much of each material is in each store.
Balances are calculated only from posted transactions and cannot be edited directly. Reorder flags
compare each store's balance with the material's reorder level.

## Before you start

Post opening stock or a receipt first; until then the page shows *No stock recorded yet*.

## Steps

1. Open **Materials & inventory → Stock balance**.
2. Use **View balances by**: **All balances**, **By store** (then choose the **Store**) or
   **By material** (then choose the **Material**).
3. Read the table: **Material**, **Store**, **On hand**, **Reorder level**, **Status** and
   **Last movement**. The status is:
   - **Reorder** — the balance is at or below the material's reorder level.
   - **Empty** — the balance is zero.
   - **In stock** — otherwise.
4. Use **Export** to save the list to Excel or PDF.
5. To change a balance, post a transaction in **Stock transactions** — see
   [Stock transactions](article:inventory.movements).

![Stock balance](screens/admin-stock.png)

## Expected result

You can see at a glance which materials need reordering in which store.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *No stock recorded yet* | No opening stock or receipt has been posted. | *Balances appear after you post opening stock or a receipt in Stock transactions.* |
| A balance looks wrong | A transaction was posted with the wrong quantity or store. | Check the ledger and [reverse](article:inventory.reversal) the wrong transaction. |

## Troubleshooting

- **No *Reorder* flag although stock is low:** the material has no **Reorder level**. Set it on
  the material.
- **Balance per site:** use **By store**; each store belongs to one site.
- **Trends and consumption:** see [Inventory report](article:reports.inventory).
