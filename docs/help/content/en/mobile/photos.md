---
id: mobile.photos
title: Take photo evidence
module: Mobile Application
category: daily-tasks
audience: public
apps: [mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Mobile
description: Take before and after photos in a task; photos are kept encrypted on the phone until cloud upload is activated.
routes: [/task/:id]
screenshots: [phase6-04-evidence.png]
related: [mobile.tasks, ts.evidence-missing, ts.permissions-denied, faq.staff]
sources:
  - apps/mobile/src/screens/TaskRun.tsx
  - apps/mobile/src/platform.ts
  - docs/phase6-report.md
keywords: ["photo", "camera", "Take photo", "Before", "After", "Saved encrypted on this device", "upload pending", "evidence"]
---

Some checklist questions ask for a photo — for example before and after cleaning.

> **Warning:** Photos are **not uploaded** yet. They are kept on the phone only. Upload needs
> cloud file storage, which is not activated. Supervisors on the web cannot see the photos.

## Steps

1. In a task, find the **Evidence** card of the question.
2. Select **Take photo** and choose **Before** or **After**.
3. Allow the camera the first time and take the picture.

![Evidence card with photo, QR and GPS (Chromium runtime test)](screens/phase6-04-evidence.png)

## Expected result

The card shows the photo phase you captured and *Saved encrypted on this device. Upload is pending
activation (needs cloud storage).* The photo is made smaller (up to 1280 px) and encrypted. A photo
never blocks you from submitting the task.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Camera permission is off.* | Camera blocked. | See [Camera or location denied](article:ts.permissions-denied). |
| *The camera is not available.* | No camera, or it is used by another app. | Close other camera apps and try again. |

## Troubleshooting

- **Signing out deletes the photos** on the phone, together with all other saved data.
- See [Evidence missing](article:ts.evidence-missing).
