---
id: ts.sync-pending
title: Sync pending does not clear
module: Troubleshooting
category: technical-support
audience: public
apps: [mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Support
description: The mobile app keeps showing Sync pending or an action stays unsent.
routes: []
screenshots: [phase6-06-sync-pending.png]
diagrams: [wf-39]
related: [mobile.offline, ts.sync-conflict, ts.account-revoked]
sources:
  - apps/mobile/src/offline/sync.ts
  - apps/mobile/src/screens/Main.tsx
keywords: ["Sync pending", "not syncing", "Sync now", "Last synced", "stuck", "Saved on this device"]
---

## Symptom

The top bar keeps showing **Sync pending**, or **Sync status** lists actions that are not **Synced**.

![Sync status with pending actions (Chromium runtime test)](screens/phase6-06-sync-pending.png)

## Likely cause

- The phone is still offline or the connection is weak.
- An action failed on the server (for example the task was reassigned) and is shown with its error.
- An earlier action of the same task conflicted, so later actions are held back.
- Access was revoked (the app then removes its data).

## How to check

1. Open **Sync status** and read **Last synced** and each line's state.
2. Open a web page on the phone to test the connection.

## Resolution

1. Move to a place with signal and select **Sync now**.
2. For **Needs review** lines, see [Sync conflict](article:ts.sync-conflict).
3. For failed lines, open the task online and redo the step if it is still yours, then **Dismiss**.

{{diagram wf-39}}

> **Warning:** Do not sign out or reinstall the app while actions are pending — the unsent work is
> stored only on this phone and is deleted on sign-out.

## Who can fix it

**Staff**; **supervisor** if the task was reassigned.

## Related

[Work offline and sync](article:mobile.offline)
