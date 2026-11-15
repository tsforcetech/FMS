---
id: reports.compliance
title: Track compliance certificates and inspections
module: Reports & Analytics
category: reports
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.7'
reviewed: '2026-11-15'
owner: Reporting
description: Record statutory certificates and inspections with evidence and expiry dates, and see what is valid, expiring, expired or missing evidence.
routes: [/compliance]
permissions:
  - Company owner or admin
screenshots: [phase7-07-admin-management-dashboard.png]
related: [reports.dashboard, maintenance.pm, assets.register, exports.overview]
sources:
  - apps/admin-web/src/management/Reports.tsx
  - apps/admin-web/src/management/reportsStore.ts
  - packages/shared/src/reports.ts
keywords: [compliance, certificate, statutory inspection, fire safety certificate, lift inspection, expiry, evidence pending, verified, expiring]
---

**Compliance & inspections** keeps certificates and statutory inspections — fire safety, electrical,
HVAC, lifts and escalators, water and plumbing, equipment inspection, health and safety — with their
expiry dates.

> **Note:** Verified means evidenced. A record counts as valid only when it is marked verified **and**
> has an evidence reference (certificate number, document location or link). Records without evidence
> show as *Evidence pending*, never as compliant.

## Steps

1. Open **Reports & analytics → Compliance & inspections** and select **Add record**.
2. Enter the **Title**, choose the **Category** and **Site**, and optionally the **Asset (optional)**.
3. Fill in **Issuer / inspector**, **Certificate / report no.**, **Issued** and **Expires**.
4. Enter the **Evidence reference** (document location, link or certificate number). Do not paste
   personal data or passwords.
5. Tick **I have checked the evidence and it is genuine** and save. The record shows when it was
   verified.
6. Use **Edit** to update a record when it is renewed. Use **Export** for Excel or PDF.

![Management reporting area](screens/phase7-07-admin-management-dashboard.png)

## Expected result

The summary counts **Valid**, **Expiring ≤30 days**, **Expired** and **Evidence pending**. The table is
sorted by expiry date so the next renewals come first.

| Status | Meaning |
| --- | --- |
| Valid | Verified with evidence and not expiring within 30 days. |
| Expiring | Verified with evidence, expiring within 30 days. |
| Expired | Verified, but the expiry date has passed. |
| Evidence pending | Not verified, or no evidence reference. |

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Enter a title.* | Title missing. | Add a title. |
| *Choose a category.* | Category missing. | Choose one. |
| *Choose the site.* | Site missing. | Choose the site. |
| *The expiry date must be after the issue date.* | Dates reversed. | Correct the dates. |
| *No compliance records yet* | Nothing recorded. | Select **Add record**. |

## Troubleshooting

- FacilityOS does not store the certificate file itself; keep it in your document system and record
  where it is in **Evidence reference**.
- Schedule the inspection itself as a [preventive maintenance plan](article:maintenance.pm) so it is not
  missed.
