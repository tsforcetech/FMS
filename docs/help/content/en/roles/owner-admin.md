---
id: role.owner-admin
title: 'Role guide: Company owner and administrator'
module: Role Guides
category: getting-started
audience: public
apps: [admin, staff, mobile]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Customer Success
description: What company owners and admins can do in FacilityOS, their responsibilities, daily and weekly routines, and how to escalate.
routes: ['/', /onboarding, /approvals, /management]
screenshots: [phase8-02-onboarding-progress.png, phase4-09-task-dashboard.png, phase7-07-admin-management-dashboard.png]
diagrams: [wf-02, wf-03, wf-04, wf-21, wf-25, wf-29, wf-43]
related: [gs.roles, gs.first-week, setup.wizard, setup.invitations, setup.staff-access, setup.customer-access, saas.plan-usage, ref.raci-matrix, role.facility-manager]
sources:
  - apps/admin-web/src/data.ts
  - apps/admin-web/src/nav.ts
  - packages/shared/src/inventory.ts
  - apps/admin-web/src/management/tenantSaas.ts
  - apps/admin-web/src/management/staffStore.ts
keywords: [owner, admin, administrator, company admin, permissions, responsibilities, admin app]
---

**Company owner** and **Company admin** are the only roles that can open the **FacilityOS admin
app**. They set up and run the company: sites, people, assets, inventory, templates, schedules,
maintenance, cases, reports, exports, imports, invitations and access. Owners and admins can also use
the Staff web and mobile app (with **Approvals**) once their login is linked to an employee record.

## Owner vs admin

| | Owner | Admin |
| --- | --- | --- |
| Admin app — all modules | Yes | Yes |
| Invite people | Yes, including **admins** | Yes, all roles except admin and owner |
| Change an existing person's role | No — roles are set by invitation or trusted provisioning | No |
| Plan & usage, support-access approval | Yes | Yes |

Nobody can invite an **owner** from inside the company; the first owner is created by Sharaco when
the company is registered.

## Responsibilities

- Complete **Administration → Company setup** (company information, logo, sites, locations,
  departments, employees, roles, assets, templates, schedules, staff access).
- Invite people and link logins to employee records (**Staff access**) or client records
  (**Customer access**).
- Publish checklist templates and create recurring schedules; make sure the scheduler runs.
- Watch approvals, overdue work, SLA breaches and escalations; act on the management dashboard.
- Keep the plan within its limits and approve or revoke Sharaco support access.

![Company setup progress](screens/phase8-02-onboarding-progress.png)

## Daily routine

1. Open **Task management → Task dashboard**: overdue, unassigned and awaiting-approval work
   ([Task dashboard](article:tasks.dashboard)).
2. Check **Administration → Scheduler monitor**; press **Run scheduler now** if no automatic run is
   shown ([How tasks are generated](article:scheduling.generation)).
3. Assign anything in **Task assignments** ([Assignments](article:tasks.assignments)).
4. Review **Pending approvals** ([Approvals](article:tasks.approvals)).
5. Check **Issues & escalations** — reported issues, complaints, customer requests, escalations and
   **SLA monitoring** ([Escalations](article:cases.escalations)).
6. Check **Maintenance → Work orders** for jobs waiting for review or verification
   ([Work orders](article:maintenance.work-orders)).

![Task dashboard](screens/phase4-09-task-dashboard.png)

## Weekly routine

- **Reports & analytics → Management dashboard**; export what management needs
  ([Management dashboard](article:reports.dashboard), [Exports](article:exports.overview)).
- Review leave, shifts and team membership so automatic assignment works.
- Review **Plan & usage** and **Audit history**.

![Management dashboard](screens/phase7-07-admin-management-dashboard.png)

{{diagram wf-43}}

## Escalation

| Problem | Escalate to |
| --- | --- |
| Plan limit, read-only subscription, billing | Sharaco account contact ([Plan & usage](article:saas.plan-usage)) |
| Something in the app does not work as documented | Sharaco support (approve support access only if asked) |
| Data loss or wrong data | Sharaco support — operators hold manual backups |
| Operational issue at a site | The site manager or the responsible department, using an escalation case |

## FAQs

- **Can a site manager use the admin app?** No. Only owners and admins can; site managers use the
  Staff web and mobile app.
- **Can I give someone "admin for one site only"?** Not today. The **Roles & permissions** page shows
  the planned site and department scopes, but they are not enforced yet.
- **Who approves tasks?** Owners, admins, supervisors, site managers and department supervisors — by
  role, not by RACI letters. See [RACI matrix](article:ref.raci-matrix).
