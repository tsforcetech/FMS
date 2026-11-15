---
id: staff.report-issue
title: Report a problem
module: Staff Web
category: maintenance
audience: public
apps: [staff, mobile]
roles: [staff, technician, supervisor]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: Report a fault or unsafe condition to the maintenance team, from a task or on its own.
routes: [/report, /issues, /report-task/:id]
screenshots: [phase5-08-report-issue.png, phase5-09-issue-confirmation.png]
diagrams: [wf-34]
related:
  [
    staff.work-orders,
    staff.checklist,
    cases.reported-issues,
    maintenance.work-orders,
    train.report-ac,
  ]
sources:
  - apps/staff-web/src/screens/Issues.tsx
  - apps/staff-web/src/i18n.tsx
  - apps/mobile/src/screens/Main.tsx
keywords:
  [
    'Report a problem',
    'Problem type',
    'How serious?',
    'Urgent / unsafe',
    'Also request a repair (work order)',
    'Send report',
    'Reference number',
    'My reported problems',
    'AC',
    'leak',
  ]
---

Use **Report** when something is broken, dirty, unsafe or missing — for example an air
conditioner not cooling or a water leak. _Tell us what is wrong. It goes straight to the
maintenance team._

## Steps

1. Select **Report problem** inside a task, or **Report** in the bottom bar.
2. Choose the **Problem type**: HVAC, Electrical, Plumbing, Civil / structural, Fire & safety,
   Cleaning, Pest control, Security, IT / low current, Furniture, Landscaping or Other.
3. Choose **How serious?**: _Needs attention_ or _Urgent / unsafe_.
4. Describe it under **What is the problem?**.
5. From a task, the **Related task** is filled in. Tick **Also request a repair (work order)** if
   it needs a repair. Without a task, choose the site and, if you know it, the location or asset.
6. Select **Send report**.

![The Report a problem form](screens/phase5-08-report-issue.png)

{{diagram wf-34}}

## Expected result

You see **Problem reported** with a **Reference number**. If a work order was created its number
is shown too. _Urgent / unsafe_ reports become high-priority work orders. Your reports are listed
under **My reported problems**.

![Confirmation with the reference number](screens/phase5-09-issue-confirmation.png)

> **Warning:** For danger to people (fire, electric shock, flooding) follow your site emergency
> procedure first, then report.

> **Note:** In the mobile app a report made from a task can be sent offline; it shows _Saved on this
> device. It will be sent when you are online._ Reports without a task need a connection.
> Photos cannot be attached to reports yet.

## Common errors

| Message                                                      | Why                           | What to do                    |
| ------------------------------------------------------------ | ----------------------------- | ----------------------------- |
| _Problem type_ / _What is the problem?_ / _Site_ highlighted | The field is required.        | Fill it in and send again.    |
| _You do not have permission for this. Ask your supervisor._  | The site is not one of yours. | Report it to your supervisor. |

## Troubleshooting

- You do not see your report in **My reported problems**: check your connection; in the mobile app
  open **Sync status**.
