---
id: ts.platform-not-authorized
title: "Not a Sharaco platform account"
module: Troubleshooting
category: technical-support
audience: public
apps: [platform]
roles: [owner, admin, platform]
version: '0.8'
reviewed: '2026-11-15'
owner: Support
description: Someone signs in to the Sharaco platform console without a platform role.
routes: []
screenshots: [phase8-10-platform-overview.png]
related: [gs.sign-in, saas.plan-usage, ts.access-denied]
sources:
  - apps/platform-web/src/App.tsx
  - firebase/firestore.rules
keywords: ["platform console", "Not a Sharaco platform account", "Your platform role needs a verified email address.", "super admin"]
---

## Symptom

The platform console shows **Not a Sharaco platform account** with either:

- *This console is for Sharaco platform staff. Company administrators sign in to the FacilityOS
  admin app instead — a company admin role never grants platform access.*, or
- *Your platform role needs a verified email address.*

## Likely cause

- A company owner or admin opened the platform console. Company roles never give platform access.
- A Sharaco staff member has a platform role, but their email address is not verified yet.

## How to check

Check which app you meant to use. Company users manage their company in the **FacilityOS admin
app**; plan and usage are under **Administration → Plan & usage**.

## Resolution

- Company users: sign out and use the admin app.
- Sharaco staff: verify the email address, then sign in again. Platform roles are granted only by
  Sharaco's platform operators through their internal procedure — not from inside any company.

![The platform console for authorised Sharaco staff](screens/phase8-10-platform-overview.png)

## Who can fix it

Sharaco platform operators (for platform roles). Nobody in a customer company can grant platform
access.

## Related

[Signing in](article:gs.sign-in) · [Plan and usage](article:saas.plan-usage)
