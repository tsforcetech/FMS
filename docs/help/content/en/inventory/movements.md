---
id: inventory.movements
title: Post stock transactions
module: Assets & Inventory
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Inventory
description: Record opening stock, receipts, issues, transfers between stores and counted adjustments in the permanent stock ledger.
routes: [/stock-transactions]
prerequisites:
  - Active materials and stores
permissions:
  - Company owner or admin
screenshots: [phase4-05-stock-ledger.png, admin-stock-transactions.png]
diagrams: [wf-18, wf-19, wf-20]
related:
  [
    inventory.materials,
    inventory.balances,
    inventory.reversal,
    import.opening-stock,
    setup.audit,
  ]
sources:
  - apps/admin-web/src/management/Assets.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/inventory.ts
  - firebase/firestore.rules
keywords:
  [
    stock,
    ledger,
    opening stock,
    receipt,
    GRN,
    issue,
    transfer,
    adjustment,
    stock count,
    Not enough stock,
  ]
---

Every change to stock is a **stock transaction** in a permanent ledger. Balances are calculated
from these transactions only; they can never be typed in. Stock can never go below zero.

| Transaction type                                      | Effect                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Opening stock**                                     | Records the first balance of a material in a store. Allowed once per store and material. |
| **Receipt**                                           | Adds stock received from a supplier or another source.                                   |
| **Issue**                                             | Removes stock consumed or handed out.                                                    |
| **Transfer**                                          | Moves stock between two stores in one step.                                              |
| **Adjustment (increase)** / **Adjustment (decrease)** | Corrects a counted difference. A reason is required.                                     |

## Before you start

Set up [materials and stores](article:inventory.materials). Quantities follow the material's unit
(for example up to 3 decimals for kilograms, whole numbers for _Each_).

## Steps

1. Open **Materials & inventory → Stock transactions** and select **New transaction** (on an
   empty ledger: **Record opening stock**).
2. The drawer **New stock transaction** opens: _Posted transactions are permanent. Correct
   mistakes with a reversal._
3. Under **1 Transaction type**, choose the type.
4. Under **2 Material & stores**, choose the **Material** and the store: **Store** for opening
   stock, receipts, issues and adjustments; **From store** and **To store** for a transfer. Enter
   the **Quantity**. The **Current balance** of the store is shown.
5. Under **3 Details**, enter the **Date** and, optionally, a **Reference** (GRN, delivery note or
   request number). For an issue you can record the **Issued to employee** and the
   **Used at location**. Enter the **Reason** (required for adjustments) and **Notes**.
6. Select the post button (for example **Post receipt**). The message _Receipt posted._ appears.

![The stock ledger](screens/phase4-05-stock-ledger.png)

{{diagram wf-19}}

## Expected result

- The transaction appears in the ledger with **Transaction**, **Material**, **Store**,
  **Quantity** and **Date**, and the balance in **Stock balance** changes.
- Use **All transaction types** to filter the ledger.
- The movement is listed in **Administration → Audit history** under _Stock movements_.

## Common errors

| Message                                                                                           | Why                                                                    | What to do                                              |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| _Not enough stock. Available in the source store: N (smallest units)._                            | The issue, transfer or decrease is larger than the balance.            | Post the missing receipt first, or reduce the quantity. |
| _Stock is already recorded for this material in this store. Use a receipt or adjustment instead._ | Opening stock exists already for this material and store.              | Use **Receipt** or **Adjustment (increase)**.           |
| _This unit only allows whole numbers_ / _Use at most N decimal places for this unit_              | The quantity has too many decimals.                                    | Round to the unit's precision.                          |
| _Enter a quantity greater than zero_ / _Enter a positive number_                                  | The quantity is empty, zero or negative.                               | Enter a positive quantity.                              |
| _Choose the source store_ / _Choose the destination store_ / _Choose a different store_           | A store is missing, or From and To are the same.                       | Choose two different stores.                            |
| _Explain the adjustment_                                                                          | An adjustment has no reason.                                           | Describe the count difference.                          |
| _Enter a valid date_                                                                              | The date is empty or invalid.                                          | Enter the date.                                         |
| _Choose an active material._ / _Choose active stores._                                            | The material or store is archived.                                     | Choose active records.                                  |
| _This transaction was already posted. It was not posted again._                                   | The same form was submitted twice (for example after a network retry). | Nothing to do — it was recorded once.                   |

## Troubleshooting

- **Posted the wrong quantity:** you cannot edit or delete a transaction — post a
  [reversal](article:inventory.reversal) and then the correct transaction.
- **Many opening balances:** import them with [Opening stock import](article:import.opening-stock).

![Stock transactions list](screens/admin-stock-transactions.png)

{{diagram wf-20}}
