---
id: cases.reported-issues
title: Act on issues reported from checklists
module: Complaints & Escalations
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Service Operations
description: Review failed checks, out-of-range readings and problems reported by staff, then acknowledge, close, create a work order or escalate.
routes: [/reported-issues]
permissions:
  - Company owner or admin
screenshots: [phase5-08-report-issue.png, phase5-09-issue-confirmation.png]
diagrams: [wf-34]
related: [tasks.execution, staff.report-issue, maintenance.work-orders, cases.escalations, tasks.history, tasks.dashboard]
sources:
  - apps/admin-web/src/management/Cases.tsx
  - apps/admin-web/src/management/Tasks.tsx
  - packages/shared/src/tasks.ts
  - packages/shared/src/cases.ts
keywords: [reported issue, exception, failed check, out of range reading, damage, critical, warning, acknowledge, create work order from issue, A work order already exists for this issue]
---

An **issue** (task exception) is created automatically when a submitted checklist contains a failed
check, an out-of-range reading or a poor or critical asset condition, and manually when staff use
**Report an issue** on a task. Each issue has a severity (*Warning* or *Critical*) and a status
(*Open*, *Acknowledged*, *Closed*).

## Steps

1. Open **Issues & escalations → Reported issues**. The list shows **Open** issues; change the status
   filter to **Acknowledged**, **Closed** or **All**.
2. Each row shows the issue type (for example *Out of range reading*, *Failed check*, *Damage*), the
   description, when it was detected, the site and an **Open task** link. Critical issues have a red
   icon, warnings amber.
3. Choose what to do:
   - **Create work order** — creates a corrective [work order](article:maintenance.work-orders) linked
     to the issue (*Work order created.*). Afterwards the row shows **View work order**.
   - **Escalate** — raises an [escalation](article:cases.escalations) to another department.
     Afterwards the row shows **View escalation**.
4. To acknowledge or close the issue, open **Task management → Task history → Issues** (or the task's
   **Issues** tab) and select **Acknowledge** or **Close**, with an optional **Note**.

![Staff reporting a problem from a task](screens/phase5-08-report-issue.png)

{{diagram wf-34}}

## Expected result

Each issue leads to exactly one work order and one first-level escalation at most. Pressing the button
twice, or on two screens, never creates a duplicate — *A work order already exists for this issue.*

![Confirmation shown to staff after reporting an issue](screens/phase5-09-issue-confirmation.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *No reported issues* | No issues match the filter. | Change the status filter. |
| *A work order already exists for this issue.* | It was created before. | Select **View work order**. |
| *Choose the department to escalate to.* | Escalation without a department. | Choose the department. |

## Troubleshooting

- **Expected an issue but none appeared:** only answers outside *expected* or *critical* limits, failed
  checks, *No* on an escalate-on-failure question, and *Poor*/*Critical* condition create issues. Check
  the limits in the [template](article:templates.builder).
- Staff can report problems from the staff portal and mobile app (see
  [Report an issue](article:staff.report-issue)).
