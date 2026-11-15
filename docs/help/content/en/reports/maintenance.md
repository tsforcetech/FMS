---
id: reports.maintenance
title: Maintenance, asset and cost reports
module: Reports & Analytics
category: reports
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.7'
reviewed: '2026-11-15'
owner: Reporting
description: Compare preventive and corrective work, resolution time and recorded costs by asset, and record maintenance costs.
routes: [/report-maintenance, /report-assets]
permissions:
  - Company owner or admin
screenshots:
  [
    phase4-16-work-order.png,
    phase7-07-admin-management-dashboard.png,
    admin-report-maintenance.png,
    admin-report-assets.png,
  ]
diagrams: [wf-43]
related:
  [
    maintenance.work-orders,
    maintenance.pm,
    maintenance.asset-history,
    reports.dashboard,
    exports.overview,
  ]
sources:
  - apps/admin-web/src/management/Reports.tsx
  - apps/admin-web/src/management/reportsStore.ts
  - packages/shared/src/reports.ts
keywords:
  [
    maintenance report,
    asset performance,
    maintenance costs,
    record cost,
    labour,
    vendor,
    material,
    currency,
    append-only,
    adjusting entry,
    Use a three-letter currency code,
  ]
---

**Maintenance & costs** and **Asset performance** show preventive tasks and corrective work orders for
a period, with response and resolution times and the **costs** you record.

![The Reports & analytics → Maintenance & costs screen](screens/admin-report-maintenance.png)

![The Reports & analytics → Asset performance screen](screens/admin-report-assets.png)

## Steps

### Read the report

1. Open **Reports & analytics → Maintenance & costs** (or **Asset performance**).
2. Choose the period and optionally a site.
3. Read **Work orders**, **Preventive**, **Corrective**, **Open**, **Avg resolution** and **Recorded
   cost**, the cost split by type, **By asset** (work orders and recorded cost) and **Recorded costs**
   (date, site, type, description, amount).
4. Use **Export** for Excel or PDF.

### Record a cost

1. Select **Record cost**.
2. Choose the **Site**, optionally the **Asset (optional)**, the **Type** (_labor_, _vendor_,
   _material_ or _other_), the **Date**, **Amount**, **Currency** (three letters, for example AED) and a
   **Description**.
3. Save. Costs are **append-only**: to correct one, record an adjusting entry.

![A work order whose costs are recorded in the maintenance report](screens/phase4-16-work-order.png)

{{diagram wf-43}}

## Expected result

Totals include only costs recorded here. Asset purchase value is never included.

## Common errors

| Message                                       | Why                                                                                       | What to do                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| _Choose the site._                            | No site selected.                                                                         | Choose one.                                                |
| _Choose a cost type._                         | Type missing.                                                                             | Choose a type.                                             |
| _Enter a cost of zero or more._               | Negative or empty amount.                                                                 | Enter the amount; correct with an adjusting entry.         |
| _Use a three-letter currency code, e.g. AED._ | Currency invalid.                                                                         | Enter a code such as AED.                                  |
| _Describe the cost._                          | Description empty.                                                                        | Describe it.                                               |
| _Choose the date the cost was incurred._      | Date missing.                                                                             | Pick the date.                                             |
| Mixed currency warning                        | Costs were recorded in more than one currency; totals add the numbers without conversion. | Read totals per currency, or record costs in one currency. |

## Troubleshooting

- **Materials issued to work orders** move stock quantities only; record their value as a _material_
  cost if you need it in this report.
- **One asset in detail:** see [Asset maintenance history](article:maintenance.asset-history).

![Management dashboard counting work orders raised in the period](screens/phase7-07-admin-management-dashboard.png)
