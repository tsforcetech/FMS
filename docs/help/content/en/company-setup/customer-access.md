---
id: setup.customer-access
title: Give a customer access to the customer portal
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Customer Experience
description: Link a customer login to one client and, optionally, to specific allocated places, and revoke or restore that access.
routes: [/customer-access]
prerequisites:
  - A login with the customer role (from an invitation with role Customer, or trusted provisioning)
  - An active client with at least one contract allocation
permissions:
  - Company owner or admin
screenshots: [phase7-01-admin-link-customer.png, phase7-02-customer-overview.png]
diagrams: [wf-04]
related: [gs.roles, clients.clients, clients.allocations, setup.invitations, customer.sign-in, customer.locations]
sources:
  - apps/admin-web/src/management/Operations.tsx
  - apps/admin-web/src/management/customerStore.ts
  - firebase/firestore.rules
keywords: [customer login, customer portal, client access, places, allocations, revoke access, restore access]
---

Customers use the customer portal (`/customer/`) to see their places and raise service requests.
A customer sees only what their **customer link** allows: one client and, optionally, specific
allocations such as *Office 201*.

## Before you start

- The customer's login must have the **customer** role. Invite them with the role *Customer*
  ([Invitations](article:setup.invitations)) or have the operator provision it. Staff and admin
  logins can never be linked as customers.
- The client must be active and have at least one
  [contract allocation](article:clients.allocations): the places a customer sees are the
  allocations of that client's contracts.

## Steps

1. Open **Administration → Customer access** and read the banner **How customers sign in**.
2. Select **Link a customer login**.
3. Choose the **Customer login** (*Choose a provisioned customer login…*).
4. Choose the **Client**.
5. Enter the **Contact name** shown to your team.
6. Under **Places this login may see**, tick specific allocations (up to 10), or leave them all
   unticked to show all of the client's allocations.
7. Select **Save**. The message *Customer access saved* appears.
8. To stop access, open the row and select **Revoke access** (*Access revoked*). Select
   **Restore access** to give it back.

![Linking a customer login](screens/phase7-01-admin-link-customer.png)

{{diagram wf-04}}

## Expected result

The row shows the contact, login, client, places and status. When the customer signs in to the
portal, they see only those places:

![The customer portal overview](screens/phase7-02-customer-overview.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Choose a customer login.* / *Choose the client.* | A required choice is empty. | Select both. |
| *This login is not a customer membership. Customer logins are provisioned separately; staff and admins cannot be linked as customers.* | The login has a staff or admin role. | Invite the customer with the role *Customer*. |
| *Choose an active client.* | The client is archived. | Choose an active client. |
| *This client has no allocations to show. Allocate a site or space to one of its contracts first.* | No allocations exist for the client's contracts. | Create a [contract allocation](article:clients.allocations). |
| *Choose at most 10 allocations, or leave empty for all of the client’s allocations.* | More than ten places were ticked. | Untick some, or untick all to allow every allocation. |
| *This login is linked to another client. Revoke it and provision a new login for the other client.* | One login can serve only one client. | Use a separate login for each client. |

## Troubleshooting

- **The form shows *This client has no contract allocations yet.***: allocate a site or space to
  one of the client's contracts first.
- **A customer still sees an old place:** places come from allocations. Remove the allocation from
  the link, or close the allocation.
- **An email address alone never grants access.** Customers always need both the customer role
  and this link.
