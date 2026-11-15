---
id: faq.general
title: General questions
module: FAQs
category: getting-started
audience: public
apps: [admin, staff, mobile, customer]
roles:
  [
    owner,
    admin,
    site_manager,
    department_manager,
    supervisor,
    technician,
    staff,
    viewer,
    customer,
  ]
version: '0.8'
reviewed: '2026-11-15'
owner: Support
description: Common questions about what FacilityOS is, who uses which app, languages, security and support.
routes: []
screenshots: []
related:
  [
    gs.overview,
    gs.roles,
    faq.staff,
    faq.customer,
    faq.billing,
    ts.access-denied,
  ]
sources:
  - docs/phase5-report.md
  - docs/phase6-report.md
  - docs/phase7-report.md
  - firebase/firestore.rules
keywords:
  [
    'FAQ',
    'what is FacilityOS',
    'which app',
    'languages',
    'data security',
    'support',
  ]
---

## What is FacilityOS?

A facility management system by Sharaco Technologies. Companies use it to manage sites, assets,
inventory, staff, checklist tasks, maintenance work orders, complaints and customer requests. See
[What is FacilityOS](article:gs.overview).

## Which app should I use?

| You are                                        | Use                                     |
| ---------------------------------------------- | --------------------------------------- |
| Owner, administrator, manager                  | The **admin app**                       |
| Technician, housekeeping, security, supervisor | The **staff web** or the **mobile app** |
| A customer or tenant of the facility provider  | The **customer portal**                 |
| Sharaco platform staff                         | The **platform console**                |

## Can I create my own account?

No. Staff logins are linked to an employee record by an administrator, and customer logins are
linked to locations by the facility provider. Company owners and admins can invite people with
**Administration → Invitations**.

## Which languages are available?

The help center and the staff and mobile apps support English, Malayalam, Hindi and Arabic. English
is complete; the other app languages are marked _preview_. The admin app and customer portal are in
English.

## Can other companies see our data?

No. Every company's data is separated on the server by security rules, and every request is checked
against your role, company and — for staff — your sites. Customers see only their own requests and
locations.

## Something is not working. Where do I start?

Look up the exact message in the **Troubleshooting** section, for example
[Access denied](article:ts.access-denied). Then contact your company administrator; administrators
contact Sharaco.

## Are email and push notifications sent?

Not yet. Notifications appear inside the apps (**Alerts**, **Notifications**, **Updates**). Email and
push delivery need services that are not activated.
