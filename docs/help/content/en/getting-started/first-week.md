---
id: gs.first-week
title: 'Your first week: setting up a new company'
module: Getting Started
category: getting-started
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Product
description: A day-by-day plan for a new company — company details, property, people, assets, checklists, schedules and staff access.
routes: [/onboarding, /company, /sites, /employees, /staff-access]
prerequisites:
  - The company owner login provisioned by Sharaco
permissions:
  - Company owner or admin
screenshots: [phase8-02-onboarding-progress.png, phase8-01-onboarding-starter-pack.png]
diagrams: [wf-02, wf-08, wf-13]
related: [setup.wizard, setup.company-settings, sites.create, sites.locations, people.employees, setup.staff-access, scheduling.recurring, import.overview]
sources:
  - apps/admin-web/src/management/Onboarding.tsx
  - apps/admin-web/src/management/onboardingStore.ts
  - packages/shared/src/onboarding.ts
keywords: [onboarding, setup plan, go live, first steps, implementation]
---

This plan takes a new company from an empty account to staff completing checklists. It follows
the twelve steps of **Administration → Company setup**, grouped into five working days.

## Before you start

- Sign in as the company owner (or an admin the owner invited).
- Collect: the company time zone and contacts, your logo, the list of sites with their
  buildings/floors/rooms, departments and job titles, employees, and the checklists you use
  today. Large lists can be imported from Excel (see [Bulk import](article:import.overview)).

## Steps

1. **Day 1 — Company.** Open **Administration → Company setup**. Complete *Company information*
   ([Company settings](article:setup.company-settings)) and *Logo & preferences*
   ([Branding](article:setup.branding)).
2. **Day 1 — Property.** Add the first site ([Create a site](article:sites.create)), then its
   buildings, floors and rooms ([Locations](article:sites.locations)). Add clients, contracts and
   allocations only if you serve clients at the site
   ([Contract allocations](article:clients.allocations)).
3. **Day 2 — People.** Create departments and designations
   ([Departments](article:people.departments)), then employees
   ([Employees](article:people.employees)), teams and shifts. In the *Task templates* step choose
   an industry starter pack to create typical departments and designations as a starting point.
4. **Day 3 — Assets and materials.** Register the equipment and furniture you maintain
   ([Asset register](article:assets.register)) and, if you track consumables, materials, stores and
   opening stock ([Materials](article:inventory.materials)).
5. **Day 4 — Checklists and schedules.** Install starter checklist templates (they arrive as
   drafts), adjust and publish them ([Publish a template](article:templates.publish)), then create
   recurring schedules ([Recurring tasks](article:scheduling.recurring)).
6. **Day 5 — Staff access and go-live.** Invite staff
   ([Invitations](article:setup.invitations)), link their logins to employees and sites
   ([Staff access](article:setup.staff-access)), run the scheduler from
   **Administration → Scheduler monitor**, and check that tasks appear in *My Day*. Finally open
   *Review & activate* and select **Mark setup complete**.

![Company setup progress](screens/phase8-02-onboarding-progress.png)

{{diagram wf-02}}

## Expected result

- **Company setup** shows every step done and *Setup marked complete*.
- Staff sign in to the staff portal or mobile app and see their tasks in *My Day*.
- Supervisors see submitted work waiting for approval.

![Choosing an industry starter pack](screens/phase8-01-onboarding-starter-pack.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Your plan allows N sites. Archive unused records or ask Sharaco to upgrade your plan. Existing data stays available.* | The plan limit was reached (the same message exists for employees and assets). | Archive unused records or ask Sharaco about a larger plan. |
| *Choose a published template version.* | You tried to schedule a template that is still a draft. | Publish the template first. |
| No tasks appear on day 5 | The scheduler has not run. | Select **Run scheduler now** on **Scheduler monitor**. See [Scheduler not activated](article:ts.scheduler-not-active). |

## Troubleshooting

- **Staff see *not linked***: the login is not linked to an employee yet — see
  [Not linked](article:ts.not-linked).
- **Tasks are unassigned:** check leave, shifts and the schedule's assignment pool — see
  [No eligible staff](article:ts.no-eligible-staff).
- **Invitation emails do not arrive:** email delivery is not automated yet. Copy the invitation
  link and send it yourself.

{{diagram wf-13}}
