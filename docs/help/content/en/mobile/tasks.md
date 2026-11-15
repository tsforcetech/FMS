---
id: mobile.tasks
title: Do your tasks in the mobile app
module: Mobile Application
category: daily-tasks
audience: public
apps: [mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Mobile
description: Open, start and complete checklist tasks on the phone, with photo, QR and GPS evidence and offline saving.
routes: [/, /tasks, /task/:id]
screenshots: [phase6-04-evidence.png, phase6-05-offline-submit.png]
diagrams: [wf-27, wf-39]
related:
  [
    staff.checklist,
    mobile.qr,
    mobile.photos,
    mobile.gps,
    mobile.offline,
    staff.rework,
  ]
sources:
  - apps/mobile/src/screens/Main.tsx
  - apps/mobile/src/screens/TaskRun.tsx
  - apps/mobile/src/offline/sync.ts
keywords:
  [
    'mobile tasks',
    'checklist on phone',
    'evidence',
    'Saved on this device',
    'start task',
    'submit',
  ]
---

The mobile app shows the same tasks as the staff web. The bottom bar has **Home**, **My tasks**,
**Scan**, **Issues** and **Profile**. The checklist works the same way as on the web (see
[Complete a checklist](article:staff.checklist)), with two extras: you can capture evidence, and you
can keep working without a connection.

## Steps

1. Open **Home** and select **Start next task**, or open **My tasks** and choose a task.
2. Select **Start task**.
3. Answer each step and select **Next**. For questions that need evidence, an **Evidence** card
   appears:
   - **Take photo** (**Before** / **After**) — see [Photos](article:mobile.photos).
   - **Scan QR code** — scan the label on the asset or location; see [QR scanning](article:mobile.qr).
   - **Capture location** — records GPS once; see [GPS](article:mobile.gps).
4. Select **Review answers**, then **Submit for approval** or **Mark as completed**.

![Evidence capture in a task (Chromium runtime test, not a physical phone)](screens/phase6-04-evidence.png)

{{diagram wf-27}}

## Expected result

- Online: the task is submitted at once.
- Offline: you see _Saved on this device. It will be sent when you are online._ The top bar shows
  **Sync pending** until it is sent.

![Submitting while offline (Chromium runtime test)](screens/phase6-05-offline-submit.png)

{{diagram wf-39}}

## What works offline

Start, pause, resume, start correction, save progress, submit, evidence and reporting a problem from
a task. These are saved on the phone and sent in order when you reconnect. Only tasks that were
downloaded while you were online can be opened offline. Approvals, work orders, standalone reports
and attendance need a connection.

## Common errors

| Message                                                                         | Why                                                              | What to do                                        |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| _Offline — your work is saved on this device and will sync when you reconnect._ | No connection.                                                   | Keep working; it syncs later.                     |
| _You do not have permission for this. Ask your supervisor._                     | The task is not yours, or it was never downloaded to this phone. | Go online and open it again; ask your supervisor. |
| **Needs review** in Sync status                                                 | The task changed on the server while you were offline.           | See [Sync conflicts](article:mobile.conflicts).   |

## Troubleshooting

See [Sync pending](article:ts.sync-pending) and [Cannot submit a task](article:ts.cannot-submit).
