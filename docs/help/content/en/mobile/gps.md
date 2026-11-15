---
id: mobile.gps
title: Capture your location (GPS)
module: Mobile Application
category: daily-tasks
audience: public
apps: [mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Mobile
description: Record one GPS reading for a task question or attendance, with its accuracy.
routes: [/task/:id, /attendance]
screenshots: [phase6-04-evidence.png, phase6-02-attendance.png]
related: [mobile.attendance, mobile.tasks, ts.permissions-denied]
sources:
  - apps/mobile/src/platform.ts
  - apps/mobile/src/screens/TaskRun.tsx
  - packages/shared/src/field.ts
keywords:
  [
    'GPS',
    'location',
    'Capture location',
    'accuracy',
    'tracking',
    'Location permission is off',
  ]
---

Some questions ask for your location, and attendance can record where you checked in.

> **Note:** The app takes **one reading only when you press the button**. It never tracks you in
> the background.

## Steps

1. In a task, select **Capture location** on the **Evidence** card.
2. Allow location the first time.
3. Wait for the reading. It shows the coordinates and **Accuracy ±{m} m** with a level:
   _good_ (25 m or better), _fair_ (up to 100 m) or _poor_.

![GPS evidence in a task (Chromium runtime test with emulated GPS)](screens/phase6-04-evidence.png)

## Expected result

The reading is saved with the task (offline too) and sent when you sync.

![Attendance with a location reading (Chromium runtime test)](screens/phase6-02-attendance.png)

## Common errors

| Message                                                                           | Why                                | What to do                                                      |
| --------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------- |
| _Location permission is off. You can continue; the record will show no location._ | Location blocked.                  | See [Camera or location denied](article:ts.permissions-denied). |
| _Location could not be determined. Try again in the open._                        | No GPS signal (indoors, basement). | Move near a window or outside and try again.                    |

## Troubleshooting

- _poor_ accuracy: wait a few seconds outdoors and capture again.
