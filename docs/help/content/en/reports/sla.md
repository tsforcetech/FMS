---
id: reports.sla
title: Measure SLA performance
module: Reports & Analytics
category: reports
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.7'
reviewed: '2026-11-15'
owner: Reporting
description: Report response and resolution times and breaches for work orders, complaints and escalations created in a period.
routes: [/report-sla]
permissions:
  - Company owner or admin
screenshots: [phase7-06-admin-sla-report.png, admin-report-sla.png]
diagrams: [wf-35, wf-43]
related:
  [
    cases.sla,
    cases.complaints,
    maintenance.work-orders,
    cases.escalations,
    reports.dashboard,
    exports.overview,
  ]
sources:
  - apps/admin-web/src/management/Reports.tsx
  - apps/admin-web/src/management/reportsStore.ts
  - packages/shared/src/reports.ts
  - packages/shared/src/schedule.ts
keywords:
  [
    SLA report,
    within SLA,
    response breached,
    resolution breached,
    average response,
    average resolution,
    reopened complaints,
  ]
---

**SLA performance** measures cases created in the period against the targets **stored when each case
was created** — later policy changes never rewrite history.

![The Reports & analytics → SLA performance screen](screens/admin-report-sla.png)

## Steps

1. Open **Reports & analytics → SLA performance**.
2. Choose the period and optionally a site.
3. Read **Cases**, **With SLA targets**, **Within SLA**, **Response breached**, **Resolution breached**,
   **Avg response**, **Avg resolution** and **Reopened complaints**.
4. **By record type** splits the figures for work orders, complaints and escalations, with **Open
   critical**.
5. Use **Export** for Excel or PDF.

![SLA performance report](screens/phase7-06-admin-sla-report.png)

{{diagram wf-35}}

## Definitions

- **Response time** — from creation to the first review, assignment, start or resolution.
- **Resolution time** — from creation to resolution.
- **Breached** — the time passed the stored target. An open case is breached once its due time has
  passed.
- Cases without targets (_No SLA_) are counted in **Cases** but not in **With SLA targets**.

## Common errors

| Message                                      | Why                               | What to do                                            |
| -------------------------------------------- | --------------------------------- | ----------------------------------------------------- |
| **With SLA targets** is lower than **Cases** | Some cases matched no SLA policy. | Add policies (see [SLA policies](article:cases.sla)). |
| _Partial period_                             | More than 3,000 records.          | Narrow the period or export.                          |

## Troubleshooting

- **Business-hours targets** skip nights, non-working days and holidays, so elapsed calendar time can be
  longer than the target without a breach.
