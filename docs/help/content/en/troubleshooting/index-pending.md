---
id: ts.index-pending
title: '"This view is still being prepared by the database"'
module: Troubleshooting
category: technical-support
audience: public
apps: [admin]
roles: [owner, admin, site_manager, supervisor, viewer]
version: '0.8'
reviewed: '2026-11-15'
owner: Support
description: A list, report or dashboard does not load because the database index it needs is not ready.
routes: []
screenshots: [phase4-09-task-dashboard.png]
related: [reports.dashboard, ts.access-denied]
sources:
  - apps/admin-web/src/ui/kit.tsx
  - docs/phase7-report.md
keywords:
  [
    'index',
    'failed-precondition',
    'This view is still being prepared by the database. Please try again in a few minutes.',
    'report not loading',
  ]
---

## Symptom

A page shows _This view is still being prepared by the database. Please try again in a few minutes._

## Likely cause

Filtered lists, reports and dashboard counts use database indexes. Right after a new version is
installed, a new index can take a few minutes to build. Until it is ready the database refuses the
query.

## How to check

Wait a few minutes and reload. If only one filter combination fails, try a simpler filter.

![A dashboard that loads once its indexes are ready](screens/phase4-09-task-dashboard.png)

## Resolution

1. Wait and reload.
2. If the message stays for more than an hour, tell whoever operates your FacilityOS installation —
   the index definitions shipped with the release may not have been deployed.

## Who can fix it

The people who operate your installation (index deployment). Company users cannot change indexes.

## Related

[Management dashboard](article:reports.dashboard)
