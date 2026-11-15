---
id: cases.customer-requests
title: Handle customer service requests
module: Complaints & Escalations
category: customer-portal
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.7'
reviewed: '2026-11-15'
owner: Service Operations
description: Take in requests from the customer portal as complaints, reply to the customer and keep their status in step.
routes: [/service-requests]
prerequisites:
  - Customer portal logins linked to their client (see Customer access)
permissions:
  - Company owner or admin
screenshots: [phase7-04-admin-service-requests.png, phase7-03-customer-new-request.png, phase7-05-customer-resolved.png]
diagrams: [wf-33, wf-41, wf-42]
related: [cases.complaints, cases.sla, customer.requests, customer.confirm, setup.customer-access, train.customer-request]
sources:
  - apps/admin-web/src/management/Operations.tsx
  - apps/admin-web/src/management/customerStore.ts
  - apps/admin-web/src/management/casesStore.ts
  - packages/shared/src/reports.ts
keywords: [customer request, service request, customer portal, take in, reply to customer, reopen requested, resolution summary, Complaint created from request, Write a reply, This request has reached its message limit]
---

Customers raise **service requests** in the customer portal for the locations their client is allocated.
Each request becomes a normal **complaint** with SLA targets, so your team works it like any other
complaint. Customers see only the status, a short timeline, your replies and the resolution summary —
never internal notes, assignees or costs.

## Before you start

- Link customer logins to their client (see [Customer access](article:setup.customer-access)).
- Make sure [SLA policies](article:cases.sla) exist; targets are counted from when the customer
  submitted the request.

## Steps

1. Open **Issues & escalations → Customer requests**. Filter by status: *Submitted*, *In progress*,
   *Resolved*, *Closed*, *Reopen requested* or *Cancelled*.
2. For a new request select **Take in**. A complaint is created from it (*Complaint created from
   request*). Taking in the same request again never creates a second complaint.
3. Work the complaint in **Complaints** — assign, start, create a work order, resolve (see
   [Complaints](article:cases.complaints)). The customer's status follows automatically:

   | Complaint | Customer sees |
   | --- | --- |
   | Open | Submitted |
   | Assigned, In progress | In progress |
   | Resolved | Resolved |
   | Closed | Closed |
   | Cancelled | Cancelled |

4. To talk to the customer, open the request, type in **Reply to the customer (they will see this)** and
   select **Send reply**. Internal discussion belongs on the complaint.

![Customer requests in the admin app](screens/phase7-04-admin-service-requests.png)

{{diagram wf-41}}

> **Warning:** The **resolution note** you enter when resolving the complaint becomes the **Resolution
> shown to the customer**. Write it for the customer and keep internal details out of it.

## Expected result

The request drawer shows the **Timeline (visible to the customer)**, the **Messages** with the
customer, and the resolution once resolved. The customer can confirm the fix or ask to reopen.

{{diagram wf-42}}

![What the customer sees after resolution](screens/phase7-05-customer-resolved.png)

## When the customer asks to reopen

The request shows *Reopen requested* and the banner *The customer asked to reopen*. Read their message,
then reopen the linked complaint from **Complaints** with a reason.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *No service requests* | Nothing has been submitted (or nothing matches the filter). | Clear the filter. |
| *Write a reply.* | The reply is empty. | Type a message. |
| *This request has reached its message limit.* | The conversation is full. | Continue by phone or email; record the outcome on the complaint. |

## Troubleshooting

- **Customer cannot pick a location:** their client has no active allocation to that place (see
  [Allocation expired](article:ts.allocation-expired)).
- The customer's side is described in [Customer service requests](article:customer.requests).

![The customer's new request form](screens/phase7-03-customer-new-request.png)
