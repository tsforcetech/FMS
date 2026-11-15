---
id: ts.allocation-expired
title: "This location’s service period has ended"
module: Troubleshooting
category: customer-portal
audience: public
apps: [customer, admin]
roles: [customer, owner, admin]
version: '0.7'
reviewed: '2026-11-15'
owner: Support
description: A customer cannot raise a request for a location whose contract allocation has ended or not started.
routes: []
screenshots: [customer-locations.png, phase7-03-customer-new-request.png]
related: [customer.locations, clients.allocations, clients.contracts, setup.customer-access]
sources:
  - apps/admin-web/src/management/customerStore.ts
  - apps/customer-web/src/App.tsx
keywords: ["allocation expired", "This location’s service period has ended. Contact your facility team.", "None of your locations is currently active", "Ended", "Starts later"]
---

## Symptom

- Submitting a request shows *This location’s service period has ended. Contact your facility team.*
- **New service request** shows *None of your locations is currently active. Contact your facility
  team.*
- **My locations** shows the place as **Ended** or **Starts later**.

![My locations with status](screens/customer-locations.png)

## Likely cause

Each location is shared with the customer through a contract allocation with a start and end date.
Outside those dates, new requests are not accepted for it. Existing requests stay visible.

## How to check

The facility provider's admin opens **Clients & contracts → Contract allocations** and checks the
allocation's dates and status, and **Administration → Customer access** for the places linked to
the login.

## Resolution

- If the service continues, the admin extends or renews the contract allocation, and makes sure the
  customer login includes it.
- If it has really ended, the customer contacts the facility team directly.

![New service request form](screens/phase7-03-customer-new-request.png)

## Who can fix it

The facility provider's **owner** or **admin**.

## Related

[Contract allocations](article:clients.allocations) · [Your locations](article:customer.locations)
