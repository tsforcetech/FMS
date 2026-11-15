---
id: cases.escalations
title: Escalate a problem to another department
module: Complaints & Escalations
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Service Operations
description: Raise an escalation to a department, acknowledge and resolve it, redirect it, or escalate further to the next level.
routes: [/escalations]
permissions:
  - Company owner or admin
screenshots: [phase4-16-work-order.png]
diagrams: [wf-34]
related: [cases.reported-issues, cases.complaints, maintenance.work-orders, cases.sla, people.departments]
sources:
  - packages/shared/src/cases.ts
  - apps/admin-web/src/management/Cases.tsx
  - apps/admin-web/src/management/casesStore.ts
keywords: [escalation, ESC, escalate further, level, reassign department, acknowledge, Choose a different department, This escalation level already exists, Enter a reason for escalating]
---

An **escalation** (reference `ESC-…`) routes a problem to another department with its own response and
resolution targets. Escalations can be raised from a reported issue, a work order, a complaint or
manually, and can be escalated again to a higher **level**.

## Steps

### Raise an escalation

1. From a reported issue, work order or complaint select **Escalate**; or open
   **Issues & escalations → Escalations** and select **Raise escalation**.
2. Choose the department (**Escalate to department**) and give the reason.
3. Save. The escalation starts as *Raised* at *Level 1*.

### Work it

| Button | From | To |
| --- | --- | --- |
| **Acknowledge** (can assign people) | Raised | Acknowledged |
| **Reassign department** (reason, new department) | Raised, Acknowledged, In progress | Raised |
| **Start** | Acknowledged | In progress |
| **Resolve** (resolution) | Acknowledged, In progress | Resolved |
| **Close** | Resolved | Closed |

### Escalate further

On an open escalation select **Escalate further** (*Escalate to the next level*). A new, linked
escalation is created one level higher (*Escalation raised.*). The original shows it under
**Escalations**, and the new one shows **Escalated from**.

![Case detail layout with status, SLA and actions (work order shown; escalations look the same plus a Level tag)](screens/phase4-16-work-order.png)

{{diagram wf-34}}

## Expected result

The receiving department sees the escalation, and admins receive an *Escalation raised* in-app
notification.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Choose the department to escalate to.* | No department chosen. | Choose one. |
| *Enter a reason for escalating.* | Reason missing. | Type the reason. |
| *Choose a different department.* | **Reassign department** to the same department. | Pick another department. |
| *This escalation level already exists.* | The next level was already raised. | Open the existing escalation. |
| *Enter a reason or resolution note.* | Resolve or reassign without text. | Type it. |

## Troubleshooting

- Escalations cannot be cancelled; resolve and close them with a note explaining the outcome.
- **Targets for escalations** come from SLA policies that apply to *escalations* or *all* (see
  [SLA policies](article:cases.sla)).
