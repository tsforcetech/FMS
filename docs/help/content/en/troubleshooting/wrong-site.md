---
id: ts.wrong-site
title: Task, asset or work order at a site you cannot see
module: Troubleshooting
category: technical-support
audience: public
apps: [staff, mobile]
roles: [staff, technician, supervisor, admin]
version: '0.6'
reviewed: '2026-11-15'
owner: Support
description: Staff cannot open a task, scan a label or act on a work order because it is at a site not linked to them.
routes: []
screenshots: [phase6-08-scan-result.png, phase5-01-admin-link-login.png]
related: [setup.staff-access, ts.access-denied, ts.qr-invalid, people.employees]
sources:
  - apps/staff-web/src/screens/TaskView.tsx
  - apps/mobile/src/screens/Scan.tsx
  - firebase/firestore.rules
keywords: ["wrong site", "other site", "You are not authorized for this asset or location.", "This code does not match any record you can access.", "site scope", "All my sites"]
---

## Symptom

- A task opens but the buttons are missing, or *You do not have permission for this. Ask your
  supervisor.*
- Scanning shows *You are not authorized for this asset or location.* or *This code does not match
  any record you can access.*
- A task you were told about is not in **My tasks**.

## Likely cause

Staff can only see and work on records at the sites linked to their login. The task, asset or work
order is at another site, or the task is assigned to someone else.

## How to check

1. In **Profile**, look at your sites (or *All my sites*).
2. The supervisor checks the task's site and assignee in the admin app.

![Scan result for a place the user can access](screens/phase6-08-scan-result.png)

## Resolution

- If you should work at that site, an administrator adds it to your link in **Administration →
  Staff access**.
- If the task should be yours, the supervisor reassigns it to you.

![Staff access with site selection](screens/phase5-01-admin-link-login.png)

## Who can fix it

Company **owner** or **admin** (site links); **supervisor** or admin (reassignment).

## Related

[Access denied](article:ts.access-denied) · [QR code not accepted](article:ts.qr-invalid)
