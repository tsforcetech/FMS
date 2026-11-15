---
id: customer.history
title: Service history and export
module: Customer Portal
category: customer-portal
audience: public
apps: [customer]
roles: [customer]
version: '0.7'
reviewed: '2026-11-15'
owner: Customer Portal
description: See finished requests by location and export them to Excel, CSV or PDF.
routes: [/history]
screenshots: [customer-history.png]
related: [customer.requests, exports.overview, ts.export-limit]
sources:
  - apps/customer-web/src/App.tsx
  - apps/admin-web/src/management/exportStore.ts
keywords: ["Service history", "export", "Excel", "PDF", "CSV", "finished requests", "report"]
---

**Service history** lists your requests that are no longer open — resolved, closed or cancelled.

## Steps

1. Open **Service history** (from **Overview**).
2. Optionally choose a location to filter.
3. Select **Export** and choose the format.

![Service history](screens/customer-history.png)

## Expected result

The file contains **Reference**, **Raised**, **Location**, **Category**, **Priority**, **Status**,
**Resolution** and optionally **Description** — the same customer-safe information you see on
screen. It never contains internal notes, staff or costs.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| Too many rows for PDF | PDF exports are limited to 10,000 rows. | Use Excel or filter by location. See [Export too large](article:ts.export-limit). |
