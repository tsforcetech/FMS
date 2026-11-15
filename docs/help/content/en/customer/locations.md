---
id: customer.locations
title: Your locations
module: Customer Portal
category: customer-portal
audience: public
apps: [customer]
roles: [customer]
version: '0.7'
reviewed: '2026-11-15'
owner: Customer Portal
description: See the premises your agreement covers and whether each one is active.
routes: [/locations]
screenshots: [customer-locations.png]
related: [customer.requests, clients.allocations, ts.allocation-expired]
sources:
  - apps/customer-web/src/App.tsx
  - apps/admin-web/src/management/customerStore.ts
keywords: ["My locations", "premises", "Active", "Starts later", "Ended", "allocation", "service period"]
---

**My locations** lists *the premises your agreement covers*. Each one has a service period set by
your facility provider.

## Steps

1. Open **My locations** (from **Overview**).
2. Read the status of each place:
   - **Active** — you can raise requests for it.
   - **Starts later** — the service period has not started.
   - **Ended** — the service period is over.
3. Each card shows the start and end date (or *open*) and how many open requests it has.

![My locations](screens/customer-locations.png)

## Expected result

Only **Active** locations are offered when you create a new request.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *This location’s service period has ended. Contact your facility team.* | The place is no longer active. | Contact your facility team. See [Location period ended](article:ts.allocation-expired). |
| *None of your locations is currently active. Contact your facility team.* | No place is active today. | Contact your facility team. |
| A place is missing | It is not shared with your login. | *Contact your facility team if something is missing.* |
