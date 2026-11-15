---
id: role.technician
title: 'Role guide: Technician'
module: Role Guides
category: maintenance
audience: public
apps: [staff, mobile]
roles: [technician]
version: '0.8'
reviewed: '2026-11-15'
owner: Customer Success
description: How technicians receive preventive maintenance tasks and repair work orders, record their work and escalate.
routes: ['/', /work-orders, /scan]
prerequisites:
  - A login with role Technician, linked to your employee record
screenshots: [phase5-12-work-order.png, phase6-03-scanner.png, phase6-04-evidence.png]
diagrams: [wf-27, wf-31, wf-32, wf-37, wf-39]
related: [train.work-order, staff.work-orders, staff.tasks, mobile.qr, mobile.photos, mobile.offline, train.report-ac]
sources:
  - apps/staff-web/src/screens/WorkOrders.tsx
  - packages/shared/src/cases.ts
  - apps/mobile/src/screens/Scan.tsx
keywords: [technician, MEP, maintenance, repair, PPM, work order, engineer]
---

**Technicians** (`technician`) carry out preventive maintenance (PPM) checklists and repair work
orders. You use the **FacilityOS Staff** web app and, ideally, the **mobile app** for QR scanning,
photos and offline work. You do not have the admin app or Approvals.

## What you can access

- **Home / My tasks** — preventive maintenance and inspection tasks assigned to you.
- **More → My work orders** — repair jobs assigned to you: **Start work**, **Put on hold**,
  **Resume**, **Mark resolved**, **Add update**, **Request assistance**.
- **Report** — report faults, optionally requesting a work order.
- Mobile: **Scan** QR labels on assets and locations, capture photo evidence, GPS, attendance,
  offline work.

## Responsibilities

- Complete PPM checklists honestly, with evidence where required.
- Keep work orders updated so supervisors and customers see progress.
- Resolve faults safely; report anything you cannot fix.

## Daily routine

1. **Check in** on mobile and open **Home**.
2. Open the next PPM task, **Start task**, **Scan** the asset if asked, complete the checklist,
   add photos, submit ([Tasks](article:staff.tasks), [Photos](article:mobile.photos)).
3. Open **My work orders**: **Start work** on arrival, **Add update** as you go, **Mark resolved** with
   the fix ([Quick start](article:train.work-order)).
4. Faults found during PPM → **Report problem** from inside the task ([Quick start](article:train.report-ac)).
5. Working in a plant room with no signal? Carry on offline; the app syncs later
   ([Offline work](article:mobile.offline)).

![Work order](screens/phase5-12-work-order.png)

![Scanning an asset QR label](screens/phase6-03-scanner.png)

{{diagram wf-32}}

## Escalation

1. Need parts or another trade → **Put on hold** / **Request assistance** with a note.
2. Unsafe → stop, make safe, report *Urgent / unsafe*, phone your supervisor.
3. Job reopened after you resolved it → read the reason in the work order history and continue.

## FAQs

- **Who closes my work order?** A supervisor or admin verifies the fix and closes it in the admin app.
- **The QR code says I am not authorized.** The asset is on a site not linked to your login — ask the
  admin ([Wrong site](article:ts.wrong-site)).
