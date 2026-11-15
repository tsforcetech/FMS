---
id: ts.evidence-missing
title: Photo, QR or GPS evidence missing
module: Troubleshooting
category: technical-support
audience: public
apps: [staff, mobile, admin]
roles: [staff, technician, supervisor, admin]
version: '0.6'
reviewed: '2026-11-15'
owner: Support
description: Why supervisors do not see photos, and why some evidence shows as pending.
routes: []
screenshots: [phase6-04-evidence.png]
related: [mobile.photos, mobile.qr, mobile.gps, staff.checklist, faq.staff]
sources:
  - packages/shared/src/tasks.ts
  - apps/mobile/src/screens/TaskRun.tsx
  - apps/mobile/src/platform.ts
keywords: ["photo missing", "evidence pending", "upload", "Upload is pending activation", "Photo / QR / GPS evidence will be captured in the mobile app"]
---

## Symptom

- A supervisor cannot see photos from a task.
- The staff web shows *Photo / QR / GPS evidence will be captured in the mobile app; it is recorded
  as pending.*
- QR or GPS evidence taken on the phone is not visible on the web.

## Likely cause

- **Photos are never uploaded yet.** They stay encrypted on the phone that took them: *Saved
  encrypted on this device. Upload is pending activation (needs cloud storage).*
- The task was done on the staff web, which cannot capture evidence.
- QR or GPS evidence was captured offline and has not synced.

## How to check

1. On the phone, open **Sync status** and look for **Sync pending**.
2. Check whether the task was done on the web or the phone.

![Evidence card in the mobile app (Chromium runtime test)](screens/phase6-04-evidence.png)

## Resolution

- QR/GPS: connect the phone and select **Sync now**.
- Photos: nothing can be done until cloud storage is activated. Until then, evidence questions are
  not mandatory and do not block submission.

## Who can fix it

**Staff** (sync). Photo upload: whoever operates your FacilityOS installation (requires a paid cloud
storage plan).

## Related

[Photos](article:mobile.photos) · [Staff FAQ](article:faq.staff)
