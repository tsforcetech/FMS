---
id: ts.qr-invalid
title: QR code not accepted
module: Troubleshooting
category: technical-support
audience: public
apps: [mobile, admin]
roles: [staff, technician, supervisor, admin]
version: '0.6'
reviewed: '2026-11-15'
owner: Support
description: The scanner rejects a QR label or says it does not belong to the task.
routes: []
screenshots: [phase6-03-scanner.png, phase4-04-asset-qr.png]
diagrams: [wf-37]
related: [mobile.qr, assets.qr, ts.wrong-site, ts.permissions-denied]
sources:
  - apps/mobile/src/screens/Scan.tsx
  - apps/mobile/src/screens/TaskRun.tsx
  - apps/staff-web/src/i18n.tsx
keywords:
  [
    'QR invalid',
    'This is not a FacilityOS code.',
    'This code does not match any record you can access.',
    'You are not authorized for this asset or location.',
    'This code does not belong to this task’s asset or location.',
    'damaged label',
  ]
---

## Symptom

| Message                                                       | Meaning                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| _This is not a FacilityOS code._                              | The QR code was not printed by FacilityOS.                                        |
| _This code does not match any record you can access._         | The record does not exist (deleted, or another company) or is outside your sites. |
| _You are not authorized for this asset or location._          | The record is at a site not linked to you.                                        |
| _This code does not belong to this task’s asset or location._ | During a task you scanned a different place.                                      |

![The scanner (Chromium runtime test)](screens/phase6-03-scanner.png)

## Likely cause

Wrong label, a reprinted or old label, a damaged label, or a site not linked to you. Offline, a code
not seen before cannot be looked up and the app shows the offline message.

## How to check

1. Read the code printed under the QR and type it under **Or type the code**.
2. Check that you are at the asset or location named in the task.
3. An admin opens the asset or location in the admin app and compares its QR label.

## Resolution

- Scan the correct label, or type the code.
- Damaged or wrong label: the admin prints a new label from the asset or location page.
- Site not linked: see [Wrong site](article:ts.wrong-site).

![Printing an asset QR label in the admin app](screens/phase4-04-asset-qr.png)

{{diagram wf-37}}

## Who can fix it

**Staff** (rescan, go online); **admin** (labels, site links).

## Related

[Scan a QR code](article:mobile.qr) · [Asset QR labels](article:assets.qr)
