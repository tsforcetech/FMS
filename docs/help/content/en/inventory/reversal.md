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
screenshots: [phase4-05-stock-ledger.png, admin-stock-transactions.png]
diagrams: [wf-20]
related: [inventory.movements, inventory.balances, setup.audit]
sources:
  - apps/admin-web/src/management/Assets.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/inventory.ts
keywords:
  [reverse, reversal, undo, correction, wrong quantity, mistake, Post reversal]
---

Posted stock transactions are permanent. To correct a mistake you **reverse** the transaction: a
new correcting transaction is posted with the opposite effect, and the original stays in the
ledger. Each transaction can be reversed once.

![The Materials & inventory → Stock transactions screen](screens/admin-stock-transactions.png)

## Before you start

- Find the wrong transaction in **Materials & inventory → Stock transactions**.
- Check that reversing is possible: reversing a receipt removes stock, so the store must still
  hold that quantity.

## Steps

1. Open **Materials & inventory → Stock transactions** and find the transaction.
2. Select **Reverse** on its row.
3. Read **Reverse this transaction?** — _A new correcting transaction will be posted with the
   opposite effect. The original stays in the ledger. Each transaction can be reversed once._
4. Select **Post reversal**. The message _Transaction reversed._ appears.
5. If the original was wrong rather than unnecessary, post the correct transaction now
   ([Stock transactions](article:inventory.movements)).

![The stock ledger with Reverse actions](screens/phase4-05-stock-ledger.png)

{{diagram wf-20}}

## Expected result

- A new _Reversal_ transaction appears, referenced as _Reversal of <original reference>_, and is
  marked _Correction_.
- The original row shows _Reversed_ instead of the **Reverse** button.
- The balance returns to what it was before the original transaction.

## Common errors

| Message                                                                | Why                                                                   | What to do                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| _This transaction has already been reversed._                          | A reversal exists for it.                                             | Nothing to reverse; post a new correct transaction if needed.                       |
| _This transaction cannot be reversed._                                 | It is a reversal itself, or no longer valid to reverse.               | Post a new transaction or adjustment instead.                                       |
| _Not enough stock. Available in the source store: N (smallest units)._ | Reversing would make the balance negative (stock was already issued). | Post an **Adjustment (decrease)** with a reason, or reverse the later issues first. |

## Troubleshooting

- **No _Reverse_ button:** the row is a reversal (_Correction_) or already _Reversed_.
- **Counted stock differs from the system:** use an adjustment with a reason rather than a
  reversal — reversals are for transactions posted by mistake.
