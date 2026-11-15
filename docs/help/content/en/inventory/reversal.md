---
id: inventory.reversal
title: Correct a stock transaction with a reversal
module: Assets & Inventory
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Inventory
description: Undo a posted stock transaction by posting a reversal with the opposite effect, keeping the original in the ledger.
routes: [/stock-transactions]
prerequisites:
  - A posted transaction that is not itself a reversal and has not been reversed
permissions:
  - Company owner or admin
screenshots: [phase4-05-stock-ledger.png]
diagrams: [wf-20]
related: [inventory.movements, inventory.balances, setup.audit]
sources:
  - apps/admin-web/src/management/Assets.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/inventory.ts
keywords: [reverse, reversal, undo, correction, wrong quantity, mistake, Post reversal]
---

Posted stock transactions are permanent. To correct a mistake you **reverse** the transaction: a
new correcting transaction is posted with the opposite effect, and the original stays in the
ledger. Each transaction can be reversed once.

## Before you start

- Find the wrong transaction in **Materials & inventory → Stock transactions**.
- Check that reversing is possible: reversing a receipt removes stock, so the store must still
  hold that quantity.

## Steps

1. Open **Materials & inventory → Stock transactions** and find the transaction.
2. Select **Reverse** on its row.
3. Read **Reverse this transaction?** — *A new correcting transaction will be posted with the
   opposite effect. The original stays in the ledger. Each transaction can be reversed once.*
4. Select **Post reversal**. The message *Transaction reversed.* appears.
5. If the original was wrong rather than unnecessary, post the correct transaction now
   ([Stock transactions](article:inventory.movements)).

![The stock ledger with Reverse actions](screens/phase4-05-stock-ledger.png)

{{diagram wf-20}}

## Expected result

- A new *Reversal* transaction appears, referenced as *Reversal of <original reference>*, and is
  marked *Correction*.
- The original row shows *Reversed* instead of the **Reverse** button.
- The balance returns to what it was before the original transaction.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *This transaction has already been reversed.* | A reversal exists for it. | Nothing to reverse; post a new correct transaction if needed. |
| *This transaction cannot be reversed.* | It is a reversal itself, or no longer valid to reverse. | Post a new transaction or adjustment instead. |
| *Not enough stock. Available in the source store: N (smallest units).* | Reversing would make the balance negative (stock was already issued). | Post an **Adjustment (decrease)** with a reason, or reverse the later issues first. |

## Troubleshooting

- **No *Reverse* button:** the row is a reversal (*Correction*) or already *Reversed*.
- **Counted stock differs from the system:** use an adjustment with a reason rather than a
  reversal — reversals are for transactions posted by mistake.
