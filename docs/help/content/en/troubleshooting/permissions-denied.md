---
id: ts.permissions-denied
title: Camera or location permission denied
module: Troubleshooting
category: technical-support
audience: public
apps: [mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Support
description: The mobile app cannot use the camera or GPS because the phone blocked it.
routes: []
screenshots: [phase6-03-scanner.png, phase6-02-attendance.png]
related: [mobile.qr, mobile.photos, mobile.gps, mobile.attendance]
sources:
  - apps/mobile/src/platform.ts
  - apps/mobile/src/screens/Scan.tsx
  - apps/mobile/src/screens/TaskRun.tsx
  - apps/mobile/src/screens/Attendance.tsx
keywords:
  [
    'camera permission',
    'location permission',
    'Camera permission is off.',
    'Location permission is off',
    'Scanning is not available on this device.',
    'The camera is not available.',
    'settings',
  ]
---

## Symptom

- _Camera permission is off._ (scan or photo)
- _Camera permission is off or no camera is available. Type the code instead._
- _Scanning is not available on this device._ / _The camera is not available._
- _Location permission is off. You can continue; the record will show no location._
- _Location could not be determined. Try again in the open._

![Scanner screen (Chromium runtime test)](screens/phase6-03-scanner.png)

## Likely cause

You chose **Don't allow** when the phone asked, or the permission was turned off later in the
phone's settings. "Could not be determined" means GPS has no signal, not a permission problem.

## How to check

On Android open **Settings → Apps → FacilityOS → Permissions** (menu names vary by phone) and look at
**Camera** and **Location**.

## Resolution

1. Allow **Camera** and **Location** ("While using the app" is enough) for FacilityOS.
2. Go back to the app and try again.
3. If you cannot allow the camera, type the QR code by hand. If you cannot allow location, you can
   still check in and capture evidence — the record shows no location.

![Attendance without location still works (Chromium runtime test)](screens/phase6-02-attendance.png)

> **Note:** The app uses the camera and GPS only when you press a button. It does not track your
> location in the background.

## Who can fix it

**Staff** (phone settings), or your IT team if the phone is managed.

## Related

[QR scanning](article:mobile.qr) · [GPS](article:mobile.gps)
