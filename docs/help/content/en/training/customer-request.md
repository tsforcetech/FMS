---
id: train.customer-request
title: 'Quick start: raise a service request (customers)'
module: Training & Quick Starts
category: customer-portal
audience: public
apps: [customer]
roles: [customer]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Raise a request in the customer portal, follow it and confirm when it is resolved.
routes: [/new, /requests, '/requests/:id']
screenshots:
  [phase7-03-customer-new-request.png, phase7-05-customer-resolved.png]
diagrams: [wf-41, wf-42]
related: [customer.requests, customer.confirm, customer.sign-in, role.customer]
sources:
  - apps/customer-web/src/App.tsx
keywords:
  [
    customer,
    tenant,
    service request,
    complaint,
    Submit request,
    Yes,
    confirm,
    Ask to reopen,
  ]
---

1. Sign in to the FacilityOS customer portal with the account your facility provider set up.
2. Select **New service request**.
3. Choose the **Location** (only your own locations are listed).
4. Choose **What is it about?** and write **Describe the problem**.
5. Choose **How urgent?** — _Low — when convenient_, _Normal_, _Urgent — affects our work_ or
   _Emergency — safety risk or flooding_.
6. Select **Submit request**. Note the **Reference**.
7. Follow it under **Requests** and **Updates**; add a message if needed.
8. When it shows **To confirm**, open it: select **Yes, confirm** if fixed, or **Ask to reopen** and
   say **What is still wrong?**

![New service request form](screens/phase7-03-customer-new-request.png)

![A resolved request waiting for confirmation](screens/phase7-05-customer-resolved.png)

> **Warning:** For emergencies that endanger people, also phone your facility provider or emergency
> services — do not rely on the portal alone.

Full guide: [Service requests](article:customer.requests).
