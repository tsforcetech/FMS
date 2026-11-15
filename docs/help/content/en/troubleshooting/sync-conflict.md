---
id: ts.sync-conflict
title: Sync conflict ("Needs review")
module: Troubleshooting
category: technical-support
audience: public
apps: [mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Support
description: An offline change was not applied because the task changed on the server.
routes: []
screenshots: [phase6-07-conflict.png]
diagrams: [wf-40]
related: [mobile.conflicts, mobile.offline, ts.sync-pending]
sources:
  - apps/mobile/src/offline/sync.ts
  - apps/mobile/src/offline/executor.ts
  - apps/staff-web/src/i18n.tsx
keywords:
  [
    'conflict',
    'Needs review',
    'The server changed while you were offline',
    'Your change was not applied',
    'Dismiss',
  ]
---

## Symptom

**Sync status** shows **Needs review**: _The server changed while you were offline. Your change was
not applied; the server version is shown._

![A conflict in Sync status (Chromium runtime test)](screens/phase6-07-conflict.png)

## Likely cause

While the phone was offline, someone changed the same task on the server — reassigned, rescheduled,
cancelled, reviewed it, or you changed it from another device. Each change carries the task version
it was based on; when that no longer matches, the server version wins.

## How to check

Open the task (online) and look at its status and **Task history**.

## Resolution

1. If the task is still yours and open, repeat the step (save or submit again).
2. If it was reassigned or cancelled, there is nothing to redo.
3. Select **Dismiss** on the conflict line.

{{diagram wf-40}}

## Who can fix it

**Staff**; ask the **supervisor** if unsure whether the task should still be done.

## Related

[Sync conflicts](article:mobile.conflicts) · [Work offline](article:mobile.offline)
