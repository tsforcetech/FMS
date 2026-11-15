---
id: customer.sign-in
title: Sign in to the customer portal
module: Customer Portal
category: customer-portal
audience: public
apps: [customer]
roles: [customer]
version: '0.7'
reviewed: '2026-11-15'
owner: Customer Portal
description: Sign in to the customer portal, read the Overview and understand what you can and cannot see.
routes: [/, /profile]
prerequisites:
  - Your facility provider has created your login and linked it to your organisation and locations
screenshots:
  [phase7-02-customer-overview.png, customer-home.png, customer-profile.png]
diagrams: [wf-04]
related:
  [
    customer.locations,
    customer.requests,
    setup.customer-access,
    faq.customer,
    ts.access-denied,
  ]
sources:
  - apps/customer-web/src/App.tsx
  - apps/admin-web/src/management/customerStore.ts
  - firebase/firestore.rules
  - docs/phase7-report.md
keywords:
  [
    'customer login',
    'tenant',
    'client portal',
    'Overview',
    'Forgot password?',
    'Your portal access has been withdrawn',
    'Your account is not set up yet',
    'This is not a customer account',
  ]
---

The **FacilityOS customer portal** is for the organisations your facility provider looks after —
for example a tenant in a business centre. Here you _raise service requests and follow their
progress_.

## What you can see

- Only the **locations your agreement covers** (shared with your login by the facility provider).
- Your organisation's own **service requests**, their progress and the team's replies.

You never see the provider's internal notes, staff names, work orders, costs or any other
customer's data. This is enforced by the server, not only hidden on screen.

## Steps

1. Open the customer portal address from your facility provider.
2. Enter your **Email** and password and select **Sign in**.
3. You arrive on **Overview** with your organisation name and four tiles: **Open**, **In
   progress**, **To confirm** and **Resolved**.
4. Use the bottom bar: **Overview**, **Requests**, **New**, **Updates** and **Profile**.

![The customer Overview](screens/phase7-02-customer-overview.png)

{{diagram wf-04}}

## Expected result

If requests were resolved and wait for you, a banner says _… request(s) resolved — please check and
confirm, or ask us to reopen._

![Customer portal home](screens/customer-home.png)

## Password

- On the sign-in page select **Forgot password?**: _If an account exists for this email, a reset
  link has been sent._
- When signed in, **Profile → Change password** sends a reset link to your email.
- **Profile** also shows **Signed in as**, **Organisation** and **Facility provider**, and has
  **Sign out**.

![Customer profile](screens/customer-profile.png)

## Common errors

| Message                                                                           | Why                                                      | What to do                             |
| --------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| _Your portal access has been withdrawn_                                           | The provider removed your portal access.                 | Contact your facility management team. |
| _Your account is not set up yet_                                                  | The login exists but is not linked to your organisation. | Contact your facility management team. |
| _This is not a customer account_                                                  | The login is a staff or admin login.                     | Staff use the staff portal.            |
| _Unable to sign in. Check your email and password or contact your administrator._ | Wrong email or password.                                 | Try again or use **Forgot password?**. |

## Troubleshooting

See [Access denied](article:ts.access-denied).
