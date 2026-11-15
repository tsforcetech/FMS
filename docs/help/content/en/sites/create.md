---
id: sites.create
title: Create a site
module: Sites & Locations
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Property
description: Add a property as a site with its type, address, time zone, working days and opening hours. Sites never need a client or contract.
routes: [/sites]
helpIds: [setup.site]
prerequisites:
  - Company settings saved (name and time zone)
permissions:
  - Company owner or admin
screenshots: [phase4-02-site-form.png, admin-sites.png]
diagrams: [wf-08]
related: [sites.locations, sites.facilities, sites.archive, clients.allocations, setup.wizard, ts.duplicate-code]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
keywords: [site, property, building, add site, time zone, working days, opening time, property type, Choose a supported IANA time zone]
---

A **site** is a physical property your company looks after — a tower, villa, warehouse, hotel,
mall and so on. Everything else is placed in a site: locations, facilities, assets, stores,
shifts and tasks. A site **never needs a client or contract**; you connect clients later through
[contract allocations](article:clients.allocations).

## Before you start

- Choose a short permanent **Code** for the site (for example `MBC` or `TOWER-A`). Codes cannot be
  changed later.
- Know the site's time zone. Shift times and schedules use it.

## Steps

1. Open **Property → Sites** and select **Add site**. The form **New site** opens with the note
   *Sites are physical properties and never need a client or contract. Connect clients later
   through Contract allocations.*
2. Enter the **Code** (uppercase letters, numbers, `-` or `_`, up to 40 characters) and the
   **Name**.
3. Choose the **Property type**: Residential tower, Commercial building, Villa, Warehouse, Hotel,
   Shopping mall, School, Hospital, Factory, Office, Outdoor property or Other.
4. Enter the **Address**, **Country** and **City**.
5. Choose the **Time zone** (required) and the **Working days**, and optionally the
   **Opening time** and **Closing time**.
6. Optionally enter the **Contact person**, **Contact phone** and **Description**.
7. Select **Save site**. The message *Site created.* appears.

![The new site form](screens/phase4-02-site-form.png)

{{diagram wf-08}}

## Expected result

- The site appears in **Property → Sites** with status *Active*.
- The site page has tabs **Overview**, **Location tree** and related lists: **Locations**,
  **Facilities**, **Assets**, **Stores**, **Allocations**, **Staff** and **Shifts**.
- Next, add buildings, floors and rooms in [Locations](article:sites.locations).

![The site list](screens/admin-sites.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Use uppercase letters, numbers, - or _* | The code has lower-case letters, spaces or other symbols. | Use a code like `TOWER-A`. |
| *This code is already reserved. Choose another code.* | Another site — active or archived — already uses the code. | Choose a different code. See [Duplicate code](article:ts.duplicate-code). |
| *Choose a supported IANA time zone* | The time zone is empty or unknown. | Pick one from the list, for example *Asia/Dubai*. |
| *Select valid working days* | The working days are invalid. | Tick at least one day. |
| *Business codes cannot be changed. They are reserved for historical references.* | You edited the code of an existing site. | Keep the code. Create a new site if you need another code. |
| *Your plan allows N sites. Archive unused records or ask Sharaco to upgrade your plan. Existing data stays available.* | Your plan's site limit is reached. | Archive unused sites or ask about a larger plan. |

## Troubleshooting

- **The form shows *Legacy client link preserved***: the site was created before sites and
  contracts were separated. Its original client link is kept for migration review and is not
  changed by your edit.
- **Times are wrong on schedules:** check the site's **Time zone**; it can differ from the company
  time zone.
- **Many sites to add:** use **Administration → Import data** (see
  [Bulk import](article:import.overview)).
