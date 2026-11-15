---
id: setup.wizard
title: Use the company setup wizard
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Onboarding
description: Work through the twelve Company setup steps, track progress from your real records and install industry starter packs.
routes: [/onboarding]
helpIds: [setup.company, setup.site, setup.locations, setup.departments, setup.employees, setup.assets, setup.templates, setup.review]
prerequisites:
  - A company owner or admin login
permissions:
  - Company owner or admin
screenshots: [phase8-02-onboarding-progress.png, phase8-01-onboarding-starter-pack.png]
diagrams: [wf-02]
related: [gs.first-week, setup.company-settings, setup.branding, sites.create, people.employees, templates.publish, scheduling.recurring, setup.staff-access, import.overview]
sources:
  - apps/admin-web/src/management/Onboarding.tsx
  - apps/admin-web/src/management/onboardingStore.ts
  - packages/shared/src/onboarding.ts
keywords: [onboarding, wizard, setup progress, starter pack, industry template, mark as done, mark setup complete, review and activate]
---

**Administration → Company setup** guides a new company through twelve steps. Progress is read
from your real records — a step is done when its records exist or when you mark it done — so you
can leave and come back at any time.

## Before you start

- Sign in as the owner or an admin.
- A client or contract is not needed to start: sites are properties in their own right.

## Steps

1. Open **Administration → Company setup**. The **Setup progress** card shows the percentage
   complete, *N of 10 steps done* (the optional *Roles & permissions* step and the final review are not counted) and the next outstanding step.
2. Work through the steps in the list. Each step explains what it needs and has a button that
   opens the right page:

   | Step | Opens |
   | --- | --- |
   | Company information | **Company settings** — name, contact details and time zone |
   | Logo & preferences | The branding form inside the wizard |
   | First site | **Property → Sites** |
   | Buildings, floors & rooms | **Property → Locations** |
   | Departments | **People & teams → Departments** |
   | Employees | **People & teams → Employees** |
   | Roles & permissions *(optional)* | **People & teams → Roles & permissions** |
   | Assets & facilities | **Assets → Asset register** |
   | Task templates | Starter packs and **Task management → Task templates** |
   | Recurring schedules | **Task management → Recurring tasks** |
   | Staff access | **Administration → Staff access** |
   | Review & activate | The summary inside the wizard |

3. When a step's records exist it shows as done automatically. If a step does not apply to you,
   select **Mark as done**; select **Reopen step** to undo that.
4. **Install a starter pack** in the *Task templates* step: choose the **Industry** (Business
   centre, Commercial building, Residential building, Hotel, Warehouse, Retail facility or
   Corporate office), tick the departments, designations, task categories and checklist templates
   you want, and select **Install selected**. Checklist templates are created as **drafts** and no
   schedules are created — review and publish the templates yourself.
5. Open **Review & activate**. When every required step is done, select
   **Mark setup complete**.

![Setup progress with the step list](screens/phase8-02-onboarding-progress.png)

{{diagram wf-02}}

## Expected result

- Progress reaches 100% and the review step shows *Setup marked complete*.
- Starter-pack installs show *Installed N item(s); M already existed.* Installing again never
  creates duplicates.

![Selecting items from an industry starter pack](screens/phase8-01-onboarding-starter-pack.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Finish the outstanding steps first.* | You tried to complete setup with required steps still open. | Complete the steps marked *To do*, or mark ones that do not apply as done. |
| *Installed 0 item(s); N already existed.* | Everything you selected was installed earlier. | Nothing to do. |
| *Your plan allows N … Archive unused records or ask Sharaco to upgrade your plan.* | A plan limit stopped a record being created. | See [Plan & usage](article:saas.plan-usage). |

## Troubleshooting

- **A step stays *To do* although I added data:** each step checks that at least one record of
  that type exists (for example a site, an asset or facility, a task template or a staff link).
  The *Company information* step also needs the name, time zone and contact email. Reload the
  page after adding the record.
- **Starter tasks never appear for staff:** starter templates are drafts. Publish them and create a
  recurring schedule.
- **Many employees to add:** use **Administration → Import data** to load them from Excel — see
  [Bulk import](article:import.overview).
