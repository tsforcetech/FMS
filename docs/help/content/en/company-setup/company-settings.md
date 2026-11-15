---
id: setup.company-settings
title: Edit the company profile
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Onboarding
description: Set the company name, time zone, contact email and phone, country and address on Company settings.
routes: [/company]
helpIds: [setup.company]
permissions:
  - Company owner or admin
screenshots: [admin-company.png]
diagrams: [wf-02]
related: [setup.wizard, setup.branding, sites.create, gs.first-week]
sources:
  - apps/admin-web/src/management/Admin.tsx
  - packages/shared/src/index.ts
  - firebase/firestore.rules
keywords:
  [
    company profile,
    company name,
    time zone,
    contact email,
    address,
    country,
    Save company profile,
  ]
---

**Administration → Company settings** holds the company profile: the name shown across the apps,
the company time zone and the contact details. It also shows read-only facts about the account.

## Before you start

- Decide the company **Time zone**. Each site has its own time zone as well; schedules use the
  site's time zone by default.

## Steps

1. Open **Administration → Company settings**.
2. Under **1 Company profile** enter the **Company name** and choose the **Time zone** from the
   list of supported time zones.
3. Under **2 Contact** enter the **Contact email**, **Contact phone**, **Country** and
   **Address**.
4. Select **Save company profile**.

![Company settings](screens/admin-company.png)

## Expected result

- The message _Company profile saved._ appears.
- The details panel shows the **Company ID**, **Status** (for example _Active_ or _Read only_)
  and **Created** date. These are managed by Sharaco and cannot be edited here.
- The _Company information_ step in **Company setup** is done once the name, time zone and
  contact email are filled in.

## Common errors

| Message                                                                                                             | Why                                                                                               | What to do                                            |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| A field message under the form (for example an invalid email)                                                       | A value does not pass validation; the first problem found is shown.                               | Correct the value and save again.                     |
| _This change was not allowed. A linked record may have changed, or your access was updated. Refresh and try again._ | The security rules refused the change — your membership changed or the subscription is read-only. | Refresh; check **Plan & usage** for read-only status. |
| _You appear to be offline. Check your connection and try again._                                                    | No network connection.                                                                            | Reconnect and save again.                             |

## Troubleshooting

- **Tasks run at the wrong hour:** schedules use the **site** time zone by default, not the
  company time zone. Check the site record.
- **The company status cannot be changed:** status and plan are managed by Sharaco. See
  [Plan & usage](article:saas.plan-usage).
