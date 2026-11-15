---
id: train.work-order
title: 'Quick start: work a repair work order'
module: Training & Quick Starts
category: maintenance
audience: public
apps: [staff, mobile]
roles: [technician, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Start, update and resolve a work order assigned to you in the Staff app.
routes: [/work-orders, '/work-orders/:id']
screenshots: [phase5-12-work-order.png, phase4-16-work-order.png]
diagrams: [wf-32]
related: [staff.work-orders, maintenance.work-orders, train.report-ac]
sources:
  - apps/staff-web/src/screens/WorkOrders.tsx
  - packages/shared/src/cases.ts
keywords: [work order, repair, technician, start work, mark resolved, request assistance, put on hold]
---

1. Tap **More → My work orders** and open the job.
2. Read the description, location, asset and resolution due time.
3. Tap **Start work** when you arrive.
4. Tap **Add update** to record what you found or did (for example "Replaced capacitor").
5. Waiting for parts? Tap **Put on hold** with a note, then **Resume** later.
6. Need another person? Tap **Request assistance** and explain.
7. When fixed, tap **Mark resolved** and describe the fix.
8. A supervisor or admin then **verifies** and **closes** the job in the admin app; if not fixed it is
   reopened and returns to you.

![Work order in the Staff app](screens/phase5-12-work-order.png)

![Work order in the admin app](screens/phase4-16-work-order.png)

Full guide: [Work orders in the Staff app](article:staff.work-orders).
