---
id: sites.archive
title: Archive sites, locations and other records
module: Sites & Locations
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Property
description: Archive records you no longer use without losing history, understand what blocks archiving and how to bring a record back.
routes: [/sites, /locations, /facilities]
prerequisites:
  - No active records linked to the record you want to archive
permissions:
  - Company owner or admin
screenshots: [admin-sites.png]
related: [sites.create, sites.locations, sites.facilities, clients.allocations, people.teams, ts.duplicate-code]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
keywords: [archive, delete, remove, deactivate, restore, reactivate, active links, Archive or reassign active linked records first]
---

FacilityOS does not delete master records. You **archive** them instead: the record stays in
history, its code stays reserved, and it is no longer offered when you create new records. The
same steps apply to sites, locations, facilities and every other master-data list.

## Before you start

- Open the record and look at the header. A pill such as *3 active links* means other active
  records still point to it (for example locations, facilities, assets, stores, shifts or
  allocations of a site).
- Archive or reassign those linked records first.

## Steps

1. Open the record (for example **Property → Sites** → the site).
2. Select **Archive**.
3. Read the confirmation **Archive <name>?** — *Archived records stay in history and keep their
   code reserved. Records still linked to this one must be archived or reassigned first.*
4. Select **Archive**. The message *<name> archived.* appears.

To bring a record back, open it, select **Edit**, set **Status** to *Active* and save.

![Sites list with statuses](screens/admin-sites.png)

## Expected result

- The record shows the status *Archived*. It stays in lists (filter by status to hide it) and in
  every report and history that refers to it.
- It is no longer offered in pick lists for new records.

> **Note:** Some records are closed differently. Active team memberships, site assignments and
> shift assignments are **ended** (set an end date), and active contract allocations are
> **terminated** or **expire**; only then can they be archived. Archiving is not offered for them
> while they are active.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Archive or reassign active linked records first.* | Active records still link to this one. | Open the related tabs, archive or reassign those records, then try again. |
| *New records cannot start archived.* | You chose *Archived* when creating a record. | Create it as *Active*. |
| *This code is already reserved. Choose another code.* | You tried to reuse the code of an archived record. | Codes stay reserved; choose a new code or reactivate the old record. |
| *Choose an active linked record.* | You picked an archived record as a link (for example an archived site for a new location). | Choose an active record or reactivate the archived one. |
| *This allocation cannot change to that status.* | Allocations follow a fixed lifecycle. | Terminate or let the allocation expire first. See [Contract allocations](article:clients.allocations). |

## Troubleshooting

- **The *Archive* button is missing:** the record is already archived, or it is an active
  assignment or allocation that must be ended first.
- **Why not delete?** Tasks, stock movements, transfers and reports refer to records by their
  code. Archiving keeps that history correct.
