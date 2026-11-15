---
id: staff.work-orders
title: Work on your work orders
module: Staff Web
category: maintenance
audience: public
apps: [staff, mobile]
roles: [technician, staff, supervisor]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: Start, pause, update and resolve the repair jobs (work orders) assigned to you.
routes: [/work-orders, /work-orders/:id]
screenshots: [phase5-12-work-order.png, staff-work-orders.png]
diagrams: [wf-32]
related: [staff.report-issue, maintenance.work-orders, staff.supervisor, ts.wrong-site]
sources:
  - apps/staff-web/src/screens/WorkOrders.tsx
  - apps/staff-web/src/i18n.tsx
keywords: ["work order", "WO", "repair", "My work orders", "Start work", "Put on hold", "Mark resolved", "Add update", "Request assistance", "materials"]
---

A **work order** is a repair or maintenance job, for example *Replace AC filter in Room 204*. When
one is assigned to you it appears under **My work orders**.

## Steps

1. Open **My work orders** (from **Home** or the menu). If the list is empty you see *No work
   orders for you*.
2. Open a work order to see its site, location, asset, priority and history.
3. Select **Start work** when you begin.
4. Use **Add update** to write what you did or found. Use **Request assistance** if you need
   another person or a supervisor.
5. If you must wait (for parts or access), select **Put on hold** and give a reason; later select
   **Resume**.
6. When the fault is fixed, select **Mark resolved** and describe the fix (a reason is required).

![A work order with its actions](screens/phase5-12-work-order.png)

{{diagram wf-32}}

## Expected result

The work order shows *Resolved*. A supervisor then checks the fix (**Verify fix**) and closes it.
Every step is kept in the history.

![My work orders list](screens/staff-work-orders.png)

> **Note:** You cannot issue materials from here. Materials are issued by the store or your
> supervisor through inventory.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *No work orders for you* | Nothing is assigned to you. | Ask your supervisor. |
| *You do not have permission for this. Ask your supervisor.* | The work order is at a site you are not linked to, or it was reassigned. | Ask your supervisor. |

## Troubleshooting

- Work order actions need a connection, also in the mobile app.
