---
id: train.first-site
title: 'Quick start: create your first site'
module: Training & Quick Starts
category: getting-started
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Add a site with its time zone and working hours, then its first building, floor and room.
routes: [/sites, /locations]
permissions:
  - Company owner or admin
screenshots: [phase4-02-site-form.png, admin-locations.png, admin-sites.png]
diagrams: [wf-08]
related: [sites.create, sites.locations, setup.wizard, saas.plan-usage]
sources:
  - apps/admin-web/src/management/Records.tsx
  - packages/shared/src/operations.ts
keywords: [new site, building, property, add site, time zone, working hours]
---

1. In the admin app open **Property → Sites** and select **Add site**.
2. Enter a short **Code** (for example `MBC`) and the **Name**.
3. Choose the **Property type** and fill in the **Address**, **Country** and **City**.
4. Choose the site **Time zone** — tasks for this site use it.
5. Set **Working days**, **Opening time** and **Closing time**.
6. Add the **Contact person** and **Contact phone** if you have them, then save.
7. Open **Property → Locations** and add the building, then its floors, then rooms, choosing the
   parent each time.
8. Check the site appears in the list as _Active_.

![The site form](screens/phase4-02-site-form.png)

![Locations under a site](screens/admin-locations.png)

> **Tip:** A client or contract is not needed to create a site. If you see a plan limit message,
> see [Plan & usage](article:saas.plan-usage).

Full guide: [Create a site](article:sites.create).

![The Property → Sites screen](screens/admin-sites.png)
