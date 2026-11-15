---
id: sites.facilities
title: Record facilities and facility types
module: Sites & Locations
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Property
description: Define facility types and record facilities such as pools, lifts or plant rooms in a site or location, with their condition and condition history.
routes: [/facilities, /facility-types]
helpIds: [setup.assets]
prerequisites:
  - An active site (and the location, if the facility is in one)
permissions:
  - Company owner or admin
screenshots: [admin-facilities.png, admin-facility-types.png]
diagrams: [wf-08]
related: [sites.create, sites.locations, assets.register, maintenance.pm, sites.archive]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
keywords: [facility, facility type, swimming pool, lift, gym, plant room, condition, under maintenance, out of service]
---

A **facility** is a shared amenity or installation you look after as a whole — a swimming pool,
gym, lift lobby, plant room or car park. Facilities belong to a site (and optionally a location),
have a **Facility type** and a **Condition**, and keep a condition history. Individual pieces of
equipment are recorded as [assets](article:assets.register) and can be related to a facility.

## Before you start

Create the facility types you need in **Property → Facility types** (for example *Swimming pool*,
*Lift*, *Gym*).

## Steps

1. Open **Property → Facility types**, select **Add facility type**, enter the **Code**, **Name**
   and optional **Description**, and select **Save facility type**.
2. Open **Property → Facilities** and select **Add facility**.
3. Enter the **Code** and **Name**.
4. Choose the **Site** and, optionally, the **Location**.
5. Choose the **Facility type** (required) and the **Condition**: Excellent, Good, Fair, Poor or
   Critical.
6. Optionally add a **Description**, then select **Save facility** (*Facility created.*).
7. When the condition changes, edit the facility and choose the new **Condition**. Use the
   **Status** to show *Under maintenance* or *Out of service*.

![The facilities list](screens/admin-facilities.png)

## Expected result

- The facility appears in the site's **Facilities** tab with its status (*Active*,
  *Under maintenance*, *Out of service* or *Archived*).
- The facility's **History** tab lists each condition change with the date, and its **Assets** tab
  lists equipment related to it.

![Facility types](screens/admin-facility-types.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Facilities cannot move between sites in this phase.* | You changed the site of an existing facility. | Create a new facility in the other site and archive the old one. |
| *Choose an active linked record.* | The site, location or facility type is archived. | Choose active records. |
| *Archive or reassign active linked records first.* | You tried to archive a facility type that active facilities still use. | Archive or change those facilities first. |

## Troubleshooting

- **The facility type is missing from the list:** it may be archived. Check
  **Property → Facility types**.
- **Track a specific machine instead:** register it as an asset and set its **Related facility**.
