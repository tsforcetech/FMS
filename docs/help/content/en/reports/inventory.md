---
id: reports.inventory
title: Reconcile stock with the inventory report
module: Reports & Analytics
category: reports
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.7'
reviewed: '2026-11-15'
owner: Reporting
description: Check opening, received, issued, transferred, adjusted, reversed and closing quantities per store and material for a period.
routes: [/report-inventory]
permissions:
  - Company owner or admin
screenshots: [phase4-05-stock-ledger.png, admin-report-inventory.png]
diagrams: [wf-43]
related:
  [
    inventory.movements,
    inventory.balances,
    inventory.reversal,
    maintenance.work-orders,
    exports.overview,
  ]
sources:
  - apps/admin-web/src/management/Reports.tsx
  - apps/admin-web/src/management/reportsStore.ts
  - packages/shared/src/reports.ts
keywords:
  [
    stock reconciliation,
    inventory movements,
    opening,
    closing,
    received,
    issued,
    transfer,
    adjustment,
    reversal,
    Ledger too large to reconcile here,
  ]
---

**Inventory reconciliation** rebuilds every store's quantities for a period from the stock ledger, so
you can prove that closing stock matches the movements.

**Opening + received − issued + transfers in − transfers out ± adjustments ± reversals = closing.**

Quantities only — FacilityOS records no unit costs.

![The Reports & analytics → Inventory reconciliation screen](screens/admin-report-inventory.png)

## Steps

1. Open **Reports & analytics → Inventory reconciliation**.
2. Choose the period.
3. Read **Stock reconciliation**: one row per **Store** and **Material** with **Opening**, **Received**,
   **Issued**, **Transfer in**, **Transfer out**, **Adjusted**, **Reversed** and **Closing**. Rows with no
   movement in the period are hidden.
4. Compare **Closing** with a physical count. Correct differences with an adjustment in
   **Stock transactions**, never by editing history.
5. Use **Export** for Excel or PDF.

![Stock ledger whose movements the reconciliation adds up](screens/phase4-05-stock-ledger.png)

{{diagram wf-43}}

## Common errors

| Message                              | Why                                                                                              | What to do                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| _Ledger too large to reconcile here_ | Opening balances need the full movement history, which exceeds what an interactive report reads. | Use **Stock balance** for current balances, or export the report. |

## Troubleshooting

- **A wrong movement:** reverse it (see [Reverse a stock movement](article:inventory.reversal)); the
  reversal shows in **Reversed**.
- **Stock issued to repairs** appears as **Issued** (see [Work orders](article:maintenance.work-orders)).
