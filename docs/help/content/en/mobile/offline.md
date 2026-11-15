---
id: mobile.offline
title: Work offline and sync
module: Mobile Application
category: daily-tasks
audience: public
apps: [mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Mobile
description: What works without a connection, how saved work is sent later, and how to use Sync status.
routes: [/sync]
screenshots: [phase6-05-offline-submit.png, phase6-06-sync-pending.png]
diagrams: [wf-39, wf-40]
related: [mobile.conflicts, mobile.tasks, ts.sync-pending, ts.sync-conflict]
sources:
  - apps/mobile/src/offline/sync.ts
  - apps/mobile/src/offline/vault.ts
  - apps/mobile/src/screens/Main.tsx
  - docs/phase6-report.md
keywords: ["offline", "sync", "Sync pending", "Synced", "Sync now", "Last synced", "Sync status", "no signal", "basement"]
---

Basements, plant rooms and car parks often have no signal. The mobile app keeps working: it saves
your task actions on the phone and sends them when you are back online.

## What works offline

| Works offline | Needs a connection |
| --- | --- |
| Open tasks downloaded earlier | First sign-in and first download |
| Start, pause, resume, start correction | Attendance check-in/out |
| Save progress, submit | Approvals (supervisors) |
| Photo, QR and GPS evidence | Work orders |
| Report a problem from a task | Reports without a task, scanning unknown codes |

## Steps

1. Work as usual. When offline the app shows *Offline — your work is saved on this device and will
   sync when you reconnect.*
2. Each saved action shows *Saved on this device. It will be sent when you are online.*
3. The top bar shows **Sync pending** with a count. Tap it to open **Sync status**.
4. When the connection returns, the app syncs by itself. You can also select **Sync now**.
5. Check that every line shows **Synced** and note **Last synced**.

![Submitting offline (Chromium runtime test)](screens/phase6-05-offline-submit.png)

{{diagram wf-39}}

![Sync status with pending actions (Chromium runtime test)](screens/phase6-06-sync-pending.png)

## Expected result

Actions are sent in the order you did them. Sending twice never creates duplicates.

{{diagram wf-40}}

> **Warning:** Do not sign out or switch company while **Sync pending** shows a number. Signing out
> deletes the phone's saved data, including unsent work.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| **Needs review** | The server changed the task while you were offline. | See [Sync conflicts](article:mobile.conflicts). |
| Line stays pending | Still no connection. | Move to a place with signal and select **Sync now**. |
| A line shows an error | The server refused it, for example the task was reassigned or access changed. | See [Sync pending](article:ts.sync-pending). |

## Troubleshooting

- A task you never opened online cannot be opened offline.
- See [Sync pending](article:ts.sync-pending).
