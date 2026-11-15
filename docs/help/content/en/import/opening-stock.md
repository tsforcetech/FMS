---
id: import.opening-stock
title: Import opening stock balances
module: Bulk Import
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Data & Imports
description: Load the starting quantity of each material in each store through the stock ledger.
routes: [/import, /stock, /stock-transactions]
prerequisites:
  - Stores and materials exist (import or create them first)
permissions:
  - Company owner or admin
screenshots:
  [
    admin-import.png,
    phase4-05-stock-ledger.png,
    admin-stock.png,
    admin-stock-transactions.png,
  ]
diagrams: [wf-45, wf-18]
related:
  [import.overview, inventory.movements, inventory.balances, reports.inventory]
sources:
  - apps/admin-web/src/management/importStore.ts
  - packages/shared/src/importing.ts
  - apps/admin-web/src/management/store.ts
keywords:
  [
    opening stock,
    opening balance,
    inventory import,
    starting quantity,
    store,
    material,
  ]
---

Choose the module **Opening stock** in **Administration → Import data**. The template has four
columns plus an optional reference: **Store code**, **Material code**, **Quantity**, **Date**
(_YYYY-MM-DD_) and **Reference**.

![The Materials & inventory → Stock balance screen](screens/admin-stock.png)

![The Materials & inventory → Stock transactions screen](screens/admin-stock-transactions.png)

## How it is saved

Opening stock is **never written directly into the balance**. Each valid row is posted as an
_Opening stock_ transaction in the stock ledger, exactly as if you had entered it in **Materials &
inventory → Stock transactions**. The balance is then calculated by the ledger, so the stock
balance, the transaction history and the inventory reconciliation report always agree.

- The quantity must be greater than zero and respect the material's unit (for example whole
  numbers only for _each_).
- A store/material pair can have only one opening balance. If one already exists the row is shown
  as _Match found_ and is not posted again — use a receipt or an adjustment to change stock later.
- Every row has a fixed transaction number derived from the import, so re-running the same file can
  never post a second opening.

## Steps

1. Open **Administration → Import data** and choose **Opening stock**.
2. Download the template and fill one row per store and material.
3. Upload, check the mapping, **Validate (dry run)** and review.
4. **Import** the _New_ rows.
5. Check **Materials & inventory → Stock balance** and the **Inventory reconciliation** report.

## Correcting a mistake

Open **Stock transactions**, find the opening transaction and post a reversal (see
[Reverse a stock transaction](article:inventory.reversal)), then record the correct quantity with a
receipt or adjustment.
