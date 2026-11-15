---
id: sites.locations
title: Build the location hierarchy
module: Sites & Locations
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Property
description: Add buildings, floors, zones, rooms and common areas inside a site, nest them up to four levels deep and browse them in the location tree.
routes: [/locations, /sites]
helpIds: [setup.locations]
prerequisites:
  - An active site
permissions:
  - Company owner or admin
screenshots: [admin-locations.png, admin-sites.png]
diagrams: [wf-08]
related:
  [
    sites.create,
    sites.facilities,
    assets.register,
    clients.allocations,
    sites.archive,
  ]
sources:
  - apps/admin-web/src/management/Records.tsx
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/operations.ts
keywords:
  [
    location,
    building,
    floor,
    room,
    zone,
    corridor,
    parking,
    hierarchy,
    tree,
    parent location,
    add child location,
  ]
---

**Locations** describe the places inside a site: buildings, floors, zones, rooms, corridors,
parking, outdoor and common areas. They form a tree under the site, and tasks, assets,
facilities, stores and allocations can point to a specific location.

![The Property → Sites screen](screens/admin-sites.png)

## Before you start

- Create the [site](article:sites.create) first.
- Plan the levels. A typical tree is _Building → Floor → Room_. Locations can be nested up to
  four levels below the site.

## Steps

1. Open **Property → Locations** and select **Add location**.
2. Enter the **Code** and **Name** (for example `T1-F02` / _Floor 2_).
3. Choose the **Site** (required).
4. Choose the **Parent location**, or leave it empty for a top-level location in the site.
5. Choose the **Location type**: Building, Floor, Zone, Room, Corridor, Parking, Outdoor area,
   Common area or Custom.
6. Optionally enter the **Floor number** and **Description**, then select **Save**
   (_Location created._).
7. To add a location inside an existing one, open it and select **Add child location**. The site
   and parent are filled in for you.
8. To browse, open the site and choose the **Location tree** tab — _Expand a location to see what
   is inside it._

![The locations list](screens/admin-locations.png)

{{diagram wf-08}}

## Expected result

- The location appears under its parent in the site's **Location tree**.
- A location page shows tabs for **Child locations**, **Facilities** and **Assets**.

## Common errors

| Message                                                                                                 | Why                                                                    | What to do                                                       |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| _Choose a parent within four levels of the site root._                                                  | The parent is already at the deepest level.                            | Choose a higher parent.                                          |
| _A location cannot be placed beneath itself or a descendant._                                           | You picked the location itself, or one of its children, as its parent. | Choose another parent.                                           |
| _Locations cannot move between sites. Create a new location instead._                                   | You changed the site of an existing location.                          | Create a new location in the other site and archive the old one. |
| _Choose an active linked record._                                                                       | The chosen site or parent is archived.                                 | Choose an active site or parent.                                 |
| _Change one linked record at a time. Save the first relationship change, then edit again for the next._ | You changed both the site link and the parent link in one edit.        | Save one change, then edit again.                                |

## Troubleshooting

- **A location is missing from the parent list:** only locations in the selected site are
  offered. Choose the site first.
- **Wrong parent:** edit the location and choose another parent in the same site.
- **Many rooms:** import them with **Administration → Import data**.
