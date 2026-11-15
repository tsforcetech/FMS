---
id: role.site-manager
title: 'Role guide: Site manager'
module: Role Guides
category: getting-started
audience: public
apps: [staff, mobile]
roles: [site_manager]
version: '0.8'
reviewed: '2026-11-15'
owner: Customer Success
description: What a site / facility manager login can do in the Staff web and mobile app, daily routine, approvals and escalation.
routes: ['/', /approvals, /work-orders]
prerequisites:
  - A login with role Site / facility manager, linked to your employee record with your sites
screenshots:
  [phase5-04-my-day.png, phase5-12-work-order.png, phase6-03-scanner.png]
diagrams: [wf-29, wf-30, wf-32, wf-34, wf-36, wf-37]
related:
  [
    staff.supervisor,
    staff.my-day,
    staff.work-orders,
    staff.report-issue,
    mobile.qr,
    role.facility-manager,
    ts.not-linked,
    ref.raci-matrix,
  ]
sources:
  - apps/admin-web/src/management/staffStore.ts
  - apps/staff-web/src/App.tsx
  - apps/staff-web/src/screens/Approvals.tsx
  - packages/shared/src/inventory.ts
keywords:
  [site manager, facility manager, building manager, approvals, site scope]
---

The **Site / facility manager** role (`site_manager`) is for the person responsible for one or more
sites. You work in the **FacilityOS Staff** web app and the **mobile app**; you do **not** have the
admin app.

## What you can access

| Feature                                                                  | Where                                 |
| ------------------------------------------------------------------------ | ------------------------------------- |
| Your own tasks, checklists, work orders, calendar, history               | Staff web / mobile                    |
| **Approvals** — approve, return for correction or reject submitted tasks | **More → Approvals**                  |
| Report problems and request repairs                                      | **Report**                            |
| QR scanning, photos, GPS, attendance, offline work                       | Mobile app (if your plan includes it) |

Approvals list submitted tasks for the **sites linked to your login** (or all sites if the
administrator chose **All sites**). Planned site-manager rights in the admin app (managing site
records, assets, stock) are **not enforced yet**, so ask an admin for setup changes.

![My Day](screens/phase5-04-my-day.png)

## Responsibilities

- Make sure today's work on your sites is done and approved.
- Review quality: return work that is not acceptable, with a clear reason.
- Report faults and follow work orders to resolution.
- Tell the admin when people, shifts or schedules need changing.

## Daily routine

1. Open **Home** — check your own tasks and anything overdue.
2. **More → Approvals** — review each submitted task: **Approve**, **Return for correction** (give a
   reason) or **Reject** ([Supervisor approvals](article:staff.supervisor)).
3. Walk the site; use **Report** for faults, ticking **Also request a repair (work order)** where
   needed ([Report a problem](article:staff.report-issue)).
4. **More → My work orders** — update the jobs assigned to you ([Work orders](article:staff.work-orders)).
5. On the mobile app, use **Scan** to verify assets and locations ([QR scanning](article:mobile.qr)).

![Work order](screens/phase5-12-work-order.png)

{{diagram wf-29}}

## Escalation

1. Staff cannot finish a task → help, or return the task with instructions.
2. Repair beyond your team → report the problem with a work order; tell the admin if urgent.
3. Repeated problems, missed SLAs, complaints → company admin, who raises an escalation case.
4. Login or access problems → company admin ([Not linked](article:ts.not-linked)).

## FAQs

- **I cannot see Approvals.** Your role must be site manager, department supervisor, supervisor,
  admin or owner, and your login must be linked. Ask the admin.
- **I see tasks from only some sites.** Your login's site scope is set in **Staff access**; up to 10
  sites or all sites.
- **Can I create schedules?** No — ask an admin.
