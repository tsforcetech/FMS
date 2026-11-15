---
id: customer.requests
title: Raise a service request
module: Customer Portal
category: customer-portal
audience: public
apps: [customer]
roles: [customer]
version: '0.7'
reviewed: '2026-11-15'
owner: Customer Portal
description: Report a problem at your premises and follow it in the Requests list.
routes: [/new, /requests]
screenshots:
  [phase7-03-customer-new-request.png, customer-new.png, customer-requests.png]
diagrams: [wf-41]
related:
  [
    customer.confirm,
    customer.updates,
    customer.locations,
    cases.customer-requests,
    train.customer-request,
  ]
sources:
  - apps/customer-web/src/App.tsx
  - apps/admin-web/src/management/customerStore.ts
  - docs/phase7-report.md
keywords:
  [
    'service request',
    'New service request',
    'What is it about?',
    'How urgent?',
    'Describe the problem',
    'Submit request',
    'Needs attention',
    'SR reference',
    'complaint',
  ]
---

A **service request** tells your facility provider that something needs attention — for example the
air conditioning is not working in your office.

## Steps

1. Select **New** in the bottom bar (or **New service request** on Overview).
2. Choose the **Location**.
3. Choose **What is it about?**: Cleaning, Air conditioning, Electrical, Plumbing, Furniture, Pest
   control, Access / keys, Internet / IT or Other.
4. Choose **How urgent?**: _Low — when convenient_, _Normal_, _Urgent — affects our work_ or
   _Emergency — safety risk or flooding_.
5. Under **Describe the problem**, write what is wrong and where (at least a few words).
6. Select **Submit request**.

![New service request form](screens/phase7-03-customer-new-request.png)

{{diagram wf-41}}

> **Warning:** _For emergencies involving danger to people, also call your building’s emergency
> number._

## Expected result

The request gets a reference such as **SR-261115-AB12CD** and the status _Submitted_. The facility
team reviews it; as they work, it moves to _In progress_ and then _Resolved_.

![New request](screens/customer-new.png)

## Following your requests

Open **Requests** (**Service requests**). The **Needs attention** tab shows open requests and
resolved ones waiting for your confirmation; **All** shows everything. Statuses are _Submitted_,
_In progress_, _Resolved_, _Closed_, _Reopen requested_ and _Cancelled_.

![Service requests list](screens/customer-requests.png)

## Common errors

| Message                                                                 | Why                                                         | What to do                                                  |
| ----------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| _You already have an open request for this (SR-…)._                     | Same location, category and description as an open request. | Open that request and add a message instead.                |
| _This location’s service period has ended. Contact your facility team._ | The location is not active.                                 | See [Location period ended](article:ts.allocation-expired). |
| _Describe the problem in a few words._                                  | The description is too short.                               | Write a little more.                                        |
| _Choose a category._                                                    | No category chosen.                                         | Choose one.                                                 |

## Troubleshooting

- You cannot attach photos to a request yet.
