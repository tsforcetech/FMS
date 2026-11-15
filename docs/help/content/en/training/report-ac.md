---
id: train.report-ac
title: 'Quick start: report an air-conditioning problem'
module: Training & Quick Starts
category: maintenance
audience: public
apps: [staff, mobile]
roles: [technician, staff, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Report a broken AC (or any fault) from the Staff app and request a repair work order.
routes: [/report]
screenshots: [phase5-08-report-issue.png, phase5-09-issue-confirmation.png]
diagrams: [wf-33, wf-32]
related: [staff.report-issue, cases.reported-issues, maintenance.work-orders, train.work-order]
sources:
  - apps/staff-web/src/screens/Issues.tsx
  - apps/staff-web/src/i18n.tsx
  - packages/shared/src/cases.ts
keywords: [AC not cooling, air conditioning, leak, fault, report problem, Also request a repair (work order), Send report]
---

1. Tap **Report** (or **Report problem** inside a task).
2. The **Report a problem** form opens.
3. Under **Problem type** tap **HVAC** (other choices include *Electrical*, *Plumbing*, *Cleaning*,
   *Security* and *Other*).
4. Choose the **Site**, **Location** and, if you know it, the **Asset** (the AC unit).
5. Set **How serious?** — *Needs attention* or *Urgent / unsafe* (water near electrics is urgent).
6. Describe it in **What is the problem?** — for example "Room 204 AC blowing warm air, dripping".
7. Tick **Also request a repair (work order)** so maintenance gets a job straight away.
8. Tap **Send report**.
9. Note the **Reference number** on *Problem reported*. Follow it under **My reported problems**.

![Report a problem form](screens/phase5-08-report-issue.png)

![Confirmation with reference number](screens/phase5-09-issue-confirmation.png)

Full guide: [Report a problem](article:staff.report-issue).
