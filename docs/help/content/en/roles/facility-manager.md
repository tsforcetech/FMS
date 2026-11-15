---
id: role.facility-manager
title: 'Role guide: Facility manager'
module: Role Guides
category: getting-started
audience: public
apps: [admin, staff, mobile]
roles: [admin, site_manager]
version: '0.8'
reviewed: '2026-11-15'
owner: Customer Success
description: How a facility manager is set up in FacilityOS (as company admin or site/facility manager), what they can access and how they run the operation.
routes: ['/', /approvals, /maintenance]
screenshots:
  [
    phase4-09-task-dashboard.png,
    phase4-16-work-order.png,
    phase7-06-admin-sla-report.png,
    admin-home.png,
    admin-approvals.png,
    admin-maintenance.png,
  ]
diagrams: [wf-29, wf-31, wf-32, wf-34, wf-35, wf-43]
related:
  [
    role.owner-admin,
    role.site-manager,
    gs.roles,
    maintenance.dashboard,
    cases.sla,
    reports.dashboard,
    ref.raci-matrix,
  ]
sources:
  - apps/admin-web/src/data.ts
  - apps/admin-web/src/management/staffStore.ts
  - packages/shared/src/inventory.ts
keywords: [facility manager, FM, operations manager, site manager, admin]
---

_Facility manager_ is a job title, not a separate permission. In FacilityOS it maps to one of two
roles — choose based on what the person must do:

| If the facility manager must…                                                       | Give the role                                | Apps                                          |
| ----------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------- |
| Set up sites, people, templates, schedules, run reports and exports                 | **Company admin** (`admin`)                  | Admin app + Staff/mobile                      |
| Supervise work on site, approve tasks, work on jobs, without changing company setup | **Site / facility manager** (`site_manager`) | Staff web and mobile app (with **Approvals**) |

> **Note:** A `site_manager` cannot open the admin app. The site-scoped admin permissions shown in
> **Roles & permissions** are prepared but **not enforced yet**, so today only owners and admins
> manage master data.

![The Home screen](screens/admin-home.png)

![The Task management → Pending approvals screen](screens/admin-approvals.png)

![The Maintenance → Maintenance dashboard screen](screens/admin-maintenance.png)

## Responsibilities

- Make sure every planned task is generated, assigned, done on time and approved.
- Own maintenance: preventive plans, work orders, verification of fixes.
- Own service quality: complaints, customer requests, SLA breaches and escalations.
- Report to management and the client.

## Daily workflows

**As company admin** — follow the admin routine in [Owner and admin guide](article:role.owner-admin),
with emphasis on:

1. **Maintenance → Maintenance dashboard** and **Work orders**: review new jobs (**Mark reviewed**,
   **Assign**), then **Verify fix** and **Close** resolved ones ([Work orders](article:maintenance.work-orders)).
2. **Issues & escalations → SLA monitoring**: act on items close to breach ([SLA](article:cases.sla)).
3. **Reports & analytics → SLA performance** weekly ([SLA report](article:reports.sla)).

**As site/facility manager** — follow the [Site manager guide](article:role.site-manager).

![Work order in the admin app](screens/phase4-16-work-order.png)

![SLA performance report](screens/phase7-06-admin-sla-report.png)

{{diagram wf-35}}

## Escalation

1. Unsafe condition → stop work, make safe, report as _Urgent / unsafe_, phone the owner.
2. SLA at risk → reassign or raise an escalation case to the responsible department.
3. Contract or client dispute → company owner.
4. System problem → company admin, then Sharaco support.

## FAQs

- **Should every facility manager be admin?** Only if they must change setup. Fewer admins means
  fewer accidental changes; every admin change is in **Audit history**.
- **Can I limit an admin to certain sites?** Not yet.
