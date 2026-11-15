---
id: role.supervisor
title: 'Role guide: Department supervisor and team leader'
module: Role Guides
category: getting-started
audience: public
apps: [staff, mobile]
roles: [supervisor, department_manager]
version: '0.8'
reviewed: '2026-11-15'
owner: Customer Success
description: How department supervisors and team leaders review and approve work, support their team and escalate problems.
routes: ['/', /approvals]
prerequisites:
  - A login with role Department supervisor or Supervisor / team leader, linked to your employee record
screenshots:
  [phase5-07-review.png, phase5-11-rework.png, phase6-02-attendance.png]
diagrams: [wf-27, wf-28, wf-29, wf-30, wf-34, wf-36]
related:
  [
    staff.supervisor,
    train.approve-inspection,
    staff.rework,
    staff.report-issue,
    ref.raci-matrix,
    role.site-manager,
  ]
sources:
  - apps/admin-web/src/management/staffStore.ts
  - apps/staff-web/src/screens/Approvals.tsx
  - apps/staff-web/src/i18n.tsx
  - packages/shared/src/tasks.ts
keywords:
  [
    supervisor,
    team leader,
    department supervisor,
    department manager,
    approve,
    rework,
  ]
---

Two roles cover supervision:

- **Department supervisor** (`department_manager`) — leads a department such as housekeeping,
  security or MEP.
- **Supervisor / team leader** (`supervisor`) — leads a team or shift.

Both use the **Staff web** and **mobile app**, and both see **Approvals**. Neither has the admin app.
Department-scoped rights shown on **Roles & permissions** are planned, not enforced yet.

## What you can access

- Your own tasks, checklists, work orders, calendar and history.
- **More → Approvals** for submitted tasks on the sites linked to your login.
- **Report** problems; on mobile: QR, photos, GPS, attendance and offline work.

## Responsibilities

- Check the quality of submitted work and decide quickly.
- Coach staff when work is returned.
- Make sure problems found on rounds are reported.
- Tell the admin about leave, absences and shift changes so automatic assignment stays correct.

## Daily routine

1. Start of shift: on mobile **Check in** ([Attendance](article:mobile.attendance)); review **Home**.
2. Through the day: **More → Approvals** — open each task, read answers and **Failed checks**, then
   **Approve**, **Return for correction** or **Reject** ([Quick start](article:train.approve-inspection)).
3. When you return work, write a reason the worker can act on; they see _Work returned for
   correction_ and use **Start correction** ([Rework](article:staff.rework)).
4. Report faults found on inspection ([Report a problem](article:staff.report-issue)).
5. End of shift: aim for _Nothing waiting for your review_; **Check out**.

![Reviewing answers](screens/phase5-07-review.png)

![Work returned for correction](screens/phase5-11-rework.png)

{{diagram wf-30}}

## Escalation

| Situation                                       | Action                                                         |
| ----------------------------------------------- | -------------------------------------------------------------- |
| Worker cannot complete (no access, no material) | Help; if blocked, report a problem and inform the site manager |
| Unsafe condition                                | _Urgent / unsafe_ report, make safe, phone the site manager    |
| Task never appears or is unassigned             | Ask the admin ([No tasks](article:ts.no-tasks))                |
| Disagreement on standards                       | Site manager / facility manager                                |

## FAQs

- **Do I approve because I am "Accountable" on the template?** No. RACI letters are business
  labels; approval rights come from your role ([RACI matrix](article:ref.raci-matrix)).
- **Can I approve tasks from another department?** Approvals are filtered by site, not department.
  Agree with your manager which tasks you review.
