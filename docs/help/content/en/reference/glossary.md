---
id: ref.glossary
title: Glossary
module: Reference
category: getting-started
audience: public
apps: [admin, staff, mobile, customer]
roles: [owner, admin, site_manager, department_manager, supervisor, technician, staff, viewer, customer]
version: '0.8'
reviewed: '2026-11-15'
owner: Customer Success
description: Definitions of the terms used in FacilityOS and this Help Center.
routes: []
screenshots: [phase4-09-task-dashboard.png]
related: [gs.overview, gs.roles, ref.raci-matrix, ref.whats-new]
sources:
  - packages/shared/src/tasks.ts
  - packages/shared/src/cases.ts
  - packages/shared/src/saas.ts
  - packages/shared/src/schedule.ts
  - apps/admin-web/src/management/staffStore.ts
keywords: [glossary, definitions, terms, meaning, vocabulary]
---

![Task dashboard — many of these terms appear here](screens/phase4-09-task-dashboard.png)

| Term | Meaning |
| --- | --- |
| **Admin app** | The FacilityOS web app for company owners and admins (setup, management, reports). |
| **Allocation (contract allocation)** | Links a contract to a site or location for a period; used for shared occupancy. |
| **Approval** | A supervisor's or admin's decision on a submitted task: approve, return for correction (rework) or reject. |
| **Asset** | A tracked item of equipment, furniture or fixture, with code, location, condition and QR label. |
| **Audit history** | The company's record of who changed what and when. |
| **Case** | Common name for a work order, complaint or escalation; each has its own statuses and actions. |
| **Checklist** | The questions in a task template version that staff answer while doing the work. |
| **Code** | A short unique identifier (upper-case letters, digits, `-`, `_`). Imports match existing records by exact code only. |
| **Company (tenant)** | One FacilityOS customer organisation with its own isolated data. |
| **Customer portal** | The app where a client's users raise and follow service requests. |
| **Customer request (service request)** | A request raised by a customer user in the portal. |
| **Department / designation / team** | Organisational groups: department (e.g. Housekeeping), designation (job title), team (working group). |
| **Dry run** | Import validation that checks every row without saving anything. |
| **Escalation** | A case raised when a problem needs attention from another department or higher level. |
| **Evidence** | Photo, QR scan or GPS location captured for a checklist answer (mobile app). |
| **Export** | Downloading a list or report as Excel, PDF or CSV. |
| **Facility / facility type** | A physical facility (e.g. a pump room) and its company-defined category. |
| **Grace** | Days after a subscription period ends when access is still full (7 by default). |
| **Invitation** | A link created for one email and role; it grants membership only when that verified email accepts it. |
| **Location** | A place within a site — building, floor, room or any level you define. |
| **Membership / role** | A person's access to a company and their role (owner, admin, site manager, department supervisor, supervisor, technician, staff, viewer, customer). |
| **My Day** | The Staff/mobile app home screen with today's tasks. |
| **Offline queue** | Work saved on the mobile device without signal, synced when the connection returns. |
| **Opening stock** | The first stock quantity per store and material, posted as an *opening* ledger movement. |
| **Plan / plan version** | Sharaco's package of limits and features; each change is a new, immutable version. |
| **Platform console** | Sharaco's own back office for companies, plans, subscriptions and billing records. |
| **Platform role** | Sharaco staff authority (owner, billing, support, viewer) set only by an operator script. |
| **PPM / preventive plan** | Planned maintenance that creates tasks on a schedule. |
| **QR label** | A code on an asset or location that the mobile app scans to open or verify work. |
| **RACI** | Responsible, Accountable, Consulted, Informed — business responsibility on templates, not a permission. |
| **Read-only subscription** | Suspended, cancelled or expired subscription: data can be viewed and exported but not changed. |
| **Recurring task (schedule)** | A rule that generates tasks from a template on a repeating pattern. |
| **Rework** | Work returned for correction by a supervisor; the worker uses *Start correction*. |
| **Scheduler** | The process that creates tasks from schedules; run from **Scheduler monitor** until automatic runs are activated. |
| **Site** | A property you manage (building, complex, campus) with its own time zone and working hours. |
| **SLA** | Service level agreement — response and resolution targets for cases, with breach tracking. |
| **Staff access (staff link)** | The link between a login and an employee record, with the sites that login may work on. |
| **Staff app** | The FacilityOS Staff web app (and mobile app) for daily work. |
| **Starter pack** | A ready-made set of departments, designations, categories, checklist drafts and SLA suggestions for a business type. |
| **Stock movement** | A ledger entry (receipt, issue, transfer, adjustment, opening, reversal); balances are derived from movements. |
| **Store** | A place where materials are kept. |
| **Subscription** | A company's current plan, dates and status (trial, active, renewal due, grace, past due, suspended, cancelled, expired). |
| **Support access** | Time-limited permission a company gives Sharaco support to see its setup summary. |
| **Task** | One occurrence of work, with assignee, due time, checklist and history. |
| **Task template** | The reusable definition of a task: instructions, checklist, evidence, RACI and assignment defaults. |
| **Usage counters** | Counts of sites, employees, assets, recurring schedules and staff logins checked against plan limits. |
| **Work order** | A repair or maintenance job case: reviewed, assigned, worked, resolved, verified and closed. |
