---
id: mobile.qr
title: Scan a QR code
module: Mobile Application
category: daily-tasks
audience: public
apps: [mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Mobile
description: Scan the QR label on an asset or location to see your open tasks there or to prove you were on site.
routes: [/scan, /task/:id]
screenshots: [phase6-03-scanner.png, phase6-08-scan-result.png]
diagrams: [wf-37]
related: [mobile.tasks, assets.qr, ts.qr-invalid, ts.permissions-denied]
sources:
  - apps/mobile/src/screens/Scan.tsx
  - apps/mobile/src/screens/TaskRun.tsx
  - apps/mobile/src/platform.ts
keywords:
  [
    'QR',
    'scan',
    'label',
    'Scan QR code',
    'Or type the code',
    'This is not a FacilityOS code.',
    'Verify for task',
    'Verified',
    'camera',
  ]
---

Assets and locations can have FacilityOS QR labels. Scanning one shows your open tasks there, or
proves you were at the right place for a task.

## Steps

1. Select **Scan** in the bottom bar, then **Scan QR code**.
2. Allow the camera the first time. _Point the camera at the QR label on the asset or location._
3. If the label is damaged, type the code under **Or type the code** and open it.
4. The result shows the asset or location and **My open tasks here**. Open a task, or select
   **Report problem**.
5. Inside a task, a QR question asks you to scan. When the code matches the task's asset or
   location you see **Verified**.

![The QR scanner (Chromium runtime test with a camera stream, not a physical phone)](screens/phase6-03-scanner.png)

{{diagram wf-37}}

## Expected result

![Scan result with open tasks for that place (Chromium runtime test)](screens/phase6-08-scan-result.png)

A QR check inside a task is saved with the task and works offline.

## Common errors

| Message                                                       | Why                                              | What to do                                                      |
| ------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| _This is not a FacilityOS code._                              | The QR code is from something else.              | Scan the FacilityOS label.                                      |
| _This code does not match any record you can access._         | Unknown code, or a place outside your sites.     | Check the label; ask your supervisor.                           |
| _You are not authorized for this asset or location._          | The place is at a site not linked to you.        | Ask your supervisor.                                            |
| _This code does not belong to this task’s asset or location._ | You scanned another place's label during a task. | Go to the right asset or location.                              |
| _Camera permission is off._                                   | Camera blocked for the app.                      | See [Camera or location denied](article:ts.permissions-denied). |

## Troubleshooting

See [QR code not accepted](article:ts.qr-invalid).
