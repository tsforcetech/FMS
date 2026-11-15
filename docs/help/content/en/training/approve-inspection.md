---
id: train.approve-inspection
title: 'Quick start: approve an inspection'
module: Training & Quick Starts
category: daily-tasks
audience: public
apps: [staff, mobile, admin]
roles: [supervisor, site_manager, department_manager, owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Review a submitted inspection checklist and approve it, return it for correction or reject it.
routes: [/approvals]
permissions:
  - Supervisor, site manager or department supervisor (Staff/mobile app), or owner/admin
screenshots: [phase5-11-rework.png, admin-approvals.png]
diagrams: [wf-29, wf-30]
related: [staff.supervisor, tasks.approvals, staff.rework, ref.raci-matrix]
sources:
  - apps/staff-web/src/screens/Approvals.tsx
  - apps/staff-web/src/i18n.tsx
  - apps/admin-web/src/management/Tasks.tsx
  - apps/admin-web/src/management/staffStore.ts
keywords: [approve, inspection, review, return for correction, rework, reject, pending approval]
---

**In the Staff or mobile app (supervisors):**

1. Tap **More → Approvals** (shown only to supervisors, site managers, department supervisors and
   owners/admins). Tasks from your linked sites are listed.
2. Open a task and read the answers, **Failed checks** and remarks.
3. Choose one:
   - **Approve** — the task is finished.
   - **Return for correction** — enter a **Reason**; the worker sees *Work returned for correction*.
   - **Reject** — enter a **Reason**; the task is closed as rejected.
4. When the list says *Nothing waiting for your review*, you are done.

**In the admin app (owners/admins):** open **Task management → Pending approvals**, open the task
and choose **Approve**, **Request rework** or **Reject**.

![What the worker sees after Return for correction](screens/phase5-11-rework.png)

![Pending approvals in the admin app](screens/admin-approvals.png)

> **Note:** The *Accountable* person named on a template (RACI) is a business label. Who can approve
> is decided by role, not by RACI — see [RACI matrix](article:ref.raci-matrix).

Full guides: [Supervisor approvals](article:staff.supervisor), [Approvals](article:tasks.approvals).
