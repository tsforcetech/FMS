---
id: staff.supervisor
title: Review your team's work (supervisors)
module: Staff Web
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [supervisor, site_manager]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: Approve submitted tasks, return them for correction or reject them, and follow work orders at your sites.
routes: [/approvals, /task/:id]
permissions:
  - Supervisor linked to the site of the task
screenshots: [phase5-07-review.png, phase5-11-rework.png]
diagrams: [wf-29, wf-30]
related: [tasks.approvals, staff.rework, staff.work-orders, role.supervisor]
sources:
  - apps/staff-web/src/screens/Approvals.tsx
  - apps/staff-web/src/screens/TaskView.tsx
  - apps/staff-web/src/i18n.tsx
keywords:
  [
    'approvals',
    'Approve',
    'Return for correction',
    'Reject',
    'Reason',
    'Nothing waiting for your review',
    'supervisor',
    'inspection',
  ]
---

Supervisors see an **Approvals** list with every task _Waiting for approval_ at their sites.

## Before you start

Your login must be linked as a supervisor for the site. You only see tasks at your linked sites.

## Steps

1. Open **Approvals**. With nothing to check you see _Nothing waiting for your review_.
2. Open a task. Read the answers, **Failed checks**, remarks and **Task history**.
3. Choose:
   - **Approve** — the work is accepted and the task is _Completed_.
   - **Return for correction** — the worker must fix it (rework).
   - **Reject** — the work is not accepted and the task is closed as _Rejected_.
4. For **Return for correction** and **Reject**, write a **Reason**.
5. Confirm. The worker gets an alert.

![Reviewing a submitted checklist](screens/phase5-07-review.png)

{{diagram wf-29}}

## Expected result

The task leaves your **Approvals** list. A returned task shows the reason to the worker.

![What the worker sees after Return for correction](screens/phase5-11-rework.png)

{{diagram wf-30}}

## Common errors

| Message                                                                    | Why                                   | What to do                                     |
| -------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| _Enter a reason so the team knows what to correct._                        | No reason for return or reject.       | Write a reason.                                |
| _You submitted this work, so another authorised reviewer must approve it._ | You cannot approve your own work.     | Ask another supervisor or a manager.           |
| _You do not have permission for this. Ask your supervisor._                | The task's site is not linked to you. | Ask an administrator to check your site links. |

## Troubleshooting

- For work orders, supervisors also get **Verify fix**, **Close** and **Reopen** on the work order
  page (see [Work orders](article:staff.work-orders)).
- Reviews need a connection, also in the mobile app.
