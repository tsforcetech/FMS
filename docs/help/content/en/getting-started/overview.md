---
id: gs.overview
title: What is FacilityOS
module: Getting Started
category: getting-started
audience: public
apps: [admin, staff, mobile, customer]
roles: [owner, admin, site_manager, department_manager, supervisor, technician, staff, viewer, customer]
version: '0.8'
reviewed: '2026-11-15'
owner: Product
description: An overview of FacilityOS — the apps, the main records and how work flows from setup to daily tasks, maintenance and customer requests.
routes: [/]
prerequisites:
  - A FacilityOS company account provisioned by Sharaco
permissions:
  - Anyone with a FacilityOS login can read this overview
screenshots: [phase4-dashboard-desktop.png, phase5-04-my-day.png]
diagrams: [wf-02]
related: [gs.sign-in, gs.navigation, gs.roles, gs.first-week, setup.wizard]
sources:
  - apps/admin-web/src/nav.ts
  - apps/admin-web/src/App.tsx
  - packages/shared/src/index.ts
keywords: [introduction, facility management, CAFM, apps, admin portal, staff portal, customer portal, mobile app]
---

**FacilityOS** is a facility-management system by Sharaco Technologies. A company uses it to
describe the properties it looks after, the people who do the work, the assets and materials
involved, and then to plan, carry out, approve and report on that work.

## Before you start

You need a login that Sharaco or your company administrator has provisioned. Accounts are never
created by simply typing an email address into the app: the company owner is provisioned by
Sharaco, and other people join through an invitation or a trusted provisioning step (see
[Roles and permissions](article:gs.roles)).

## Steps

Use this overview to find the right app and the right part of the Help Center.

1. **Identify which app you use.** FacilityOS has four apps that share the same data:

   | App | Who uses it | What it is for |
   | --- | --- | --- |
   | **Admin app** | Company owners and administrators | Company setup, master data, task templates, schedules, maintenance, cases, reports, administration |
   | **Staff portal** (`/staff/`) | Staff, technicians, supervisors and managers linked to an employee | *My Day*, checklists, reporting issues, work orders, approvals for supervisors |
   | **Mobile app** (Android/iOS) | The same staff logins | Everything in the staff portal plus QR scanning, photos, GPS, attendance and offline work |
   | **Customer portal** (`/customer/`) | Customer logins linked to a client | Seeing their places, raising service requests and confirming resolutions |

2. **Learn the building blocks.** Almost everything in the admin app is a record with a
   permanent **Code**, a **Status** and a history:
   - *Property*: **Sites** → **Locations** (building, floor, zone, room…) → **Facilities**.
   - *Clients & contracts*: **Clients**, **Contracts** and **Contract allocations**, which connect a
     contract to a site or a space. Sites never need a client.
   - *People & teams*: **Employees**, **Departments**, **Designations**, **Teams**, **Shifts** and
     **Leave & holidays**.
   - *Assets* and *Materials & inventory*: the asset register with QR labels and transfers, and a
     stock ledger of materials in stores.
3. **Follow the work cycle.** Task templates (checklists) are published, recurring schedules
   turn them into tasks, staff complete them in *My Day*, supervisors approve them, and reports
   summarise the results. Maintenance, work orders, complaints and customer requests follow
   their own tracked lifecycles.
4. **Start setup.** New companies start with **Administration → Company setup** — see
   [Your first week](article:gs.first-week).

![The admin app overview dashboard with demo data](screens/phase4-dashboard-desktop.png)

{{diagram wf-02}}

## Expected result

You know which app to open, which records you will set up first and which Help Center module
covers each area. Staff who open the staff portal or the mobile app see their own tasks in
*My Day*:

![My Day in the staff portal](screens/phase5-04-my-day.png)

> **Note:** Some features depend on infrastructure that is not active yet: email delivery of
> notifications and invitations, push notifications, automatic scheduler runs without an
> administrator, online payments and cloud photo storage. Articles say so wherever this matters.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Access denied* — "This account has no active administrator membership." | The login is not an owner or admin of any active company. Staff use the staff portal instead. | Staff: open `/staff/`. Administrators: ask your company owner to check your membership. |
| *Unable to sign in. Check your email and password or contact your administrator.* | Wrong email or password, or the account is disabled. | See [Signing in](article:gs.sign-in). |

## Troubleshooting

- **I can sign in but see no tasks:** staff logins must be linked to an employee record with
  sites before work appears. An administrator does this in
  [Staff access](article:setup.staff-access).
- **A menu item I expected is missing:** the admin app shows the same menu to every owner and
  admin. If a page says *Module pending activation*, that part of the system is not switched on
  for your company yet.
