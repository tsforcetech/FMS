---
id: cases.complaints
title: Register and resolve complaints
module: Complaints & Escalations
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Service Operations
description: Register a complaint from a client, staff member or inspection, assign it, link a work order, resolve, close or reopen it.
routes: [/complaints]
permissions:
  - Company owner or admin
screenshots: [phase4-16-work-order.png, phase7-04-admin-service-requests.png]
diagrams: [wf-33]
related: [cases.customer-requests, maintenance.work-orders, cases.escalations, cases.sla, reports.sla]
sources:
  - packages/shared/src/cases.ts
  - apps/admin-web/src/management/Cases.tsx
  - apps/admin-web/src/management/casesStore.ts
keywords: [complaint, CMP, client complaint, register complaint, resolve, reopen, This complaint already has a work order, Work order created and linked]
---

A **complaint** (reference `CMP-…`) records dissatisfaction or a service problem reported by a client,
a staff member, an inspection or a checklist exception. Requests from the customer portal also become
complaints (see [Customer requests](article:cases.customer-requests)).

## Steps

### Register a complaint

1. Open **Issues & escalations → Complaints** and select **Register complaint**.
2. Enter the **Title** and **Description**, choose **Priority**, **Severity**, **Problem category**,
   **Source** (*Admin*, *Staff*, *Client* or *Inspection*) and **Reported by**.
3. Under **Where**, choose the **Site** and optionally **Location**, **Facility**, **Asset**,
   **Department** and **Client**.
4. Select **Create** (*Complaint created.*). Response and resolution targets come from the matching
   [SLA policy](article:cases.sla) and are stored now.

### Work it to closure

| Button | From | To |
| --- | --- | --- |
| **Assign** | Open, Assigned | Assigned |
| **Start** | Assigned | In progress |
| **Resolve** (resolution) | Assigned, In progress | Resolved |
| **Close** | Resolved | Closed |
| **Reopen** (reason) | Resolved, Closed | In progress |
| **Cancel** (reason) | Open, Assigned | Cancelled |

- **Create work order** creates one linked work order for repair work (*Work order created and
  linked.*). It is offered once per complaint.
- **Escalate** raises an escalation to another department.

![Case detail layout with status, SLA, facts and history (work order shown; complaints look the same)](screens/phase4-16-work-order.png)

{{diagram wf-33}}

## Expected result

The complaint shows its status, SLA state and full **History**. For a complaint that came from the
customer portal, the customer sees the matching status (*Submitted*, *In progress*, *Resolved*,
*Closed*, *Cancelled*) — never internal notes, assignees or costs.

![Customer requests list linked to complaints](screens/phase7-04-admin-service-requests.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Enter a title.* | Title missing. | Add a title. |
| *Choose a site.* | No site selected. | Choose the site. |
| *Enter a reason or resolution note.* | Resolve, reopen and cancel need text. | Type it. |
| *This complaint already has a work order.* | A work order was already created from it. | Open the linked work order. |
| *This record was updated by someone else. Reload and try again.* | Concurrent change. | Reload. |

## Troubleshooting

- **Customer asked to reopen:** the request shows *Reopen requested*; reopen the complaint here with a
  reason (see [Customer requests](article:cases.customer-requests)).
- **Complaint is late:** see [SLA monitoring](article:cases.sla).
