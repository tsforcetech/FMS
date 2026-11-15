---
id: platform.billing
title: Record invoices and payments
module: Sharaco Platform Administration
category: billing
audience: authenticated
apps: [platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: SaaS Platform
description: Record manual invoice records for a company, mark them paid when payment arrives, and understand how revenue figures are computed.
routes: [/billing]
prerequisites:
  - Platform owner or Billing administrator role
permissions:
  - Record invoice / Record payment received — Platform owner or Billing administrator
screenshots: [platform-billing.png]
diagrams: [wf-05]
related: [platform.subscriptions, platform.overview, saas.plan-usage, faq.billing]
sources:
  - apps/platform-web/src/App.tsx
  - apps/platform-web/src/store.ts
  - packages/shared/src/saas.ts
keywords: [invoice, payment, MRR, ARR, revenue, paid manual, card, payment provider, Payment integration pending, Use a three-letter currency code, The period end must be after its start]
---

**Online payment is not active.** FacilityOS has a provider-neutral payment boundary, but no payment
provider is connected and no card data is stored anywhere. **Billing records** are manual invoice
records that Sharaco keeps for each company. Companies see their own invoices under
**Administration → Plan & usage → Billing history**.

> **Warning:** A browser can never mark a subscription paid on the strength of a payment result.
> *Paid* here is a manual administrative record. Activating online payments needs an approved trusted
> backend and provider — **pending approval**.

## Steps — record an invoice

1. Open **Billing records** and select **Record invoice**.
2. Choose the **Company**.
3. Enter the **Invoice number**, **Amount** (zero or more) and **Currency** (three letters, for example
   AED).
4. Enter the **Service period start** and **Service period end**.
5. Choose the **Status**: *Draft*, *Issued*, *Paid (manual)* or *Void*.
6. Select **Save**. *Invoice recorded* appears and the event *invoice.saved* is written to the audit
   log.

## Steps — record a payment

1. In the list, find the invoice with status *Issued*.
2. Select **Record payment received**. The status becomes *Paid* (*Recorded as paid (manual)*), and
   *invoice.paid_manual* is logged.
3. Renew the subscription on the company page if the payment covers a new period (see
   [Manage a subscription](article:platform.subscriptions)).

![Billing records](screens/platform-billing.png)

## How revenue is computed

The overview's **Recurring revenue** counts only invoices with status *Paid* whose service period
covers today. Each invoice amount is spread over the months of its service period (MRR), and ARR is
MRR × 12. Results are per currency and never converted. Trials, drafts, issued and void invoices
never count.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Choose the company.* | No company selected. | Choose one. |
| *Enter the invoice number.* | Missing number. | Enter it. |
| *Enter an amount of zero or more.* | Negative or invalid amount. | Correct it. |
| *Use a three-letter currency code.* | Invalid currency. | For example AED, USD. |
| *The period end must be after its start.* | Dates reversed. | Correct the dates. |
