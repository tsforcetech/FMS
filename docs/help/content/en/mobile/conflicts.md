---
id: mobile.conflicts
title: Sync conflicts (Needs review)
module: Mobile Application
category: daily-tasks
audience: public
apps: [mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Mobile
description: What happens when a task changed on the server while you worked offline, and what to do.
routes: [/sync]
screenshots: [phase6-07-conflict.png]
diagrams: [wf-40]
related: [mobile.offline, ts.sync-conflict, ts.sync-pending]
sources:
  - apps/mobile/src/offline/sync.ts
  - apps/mobile/src/screens/Main.tsx
keywords:
  [
    'conflict',
    'Needs review',
    'The server changed while you were offline',
    'Dismiss',
    'reassigned',
  ]
---

A **conflict** happens when the same task was changed on the server while your phone was offline —
for example your supervisor reassigned it, or it was cancelled. The server version always wins, so
two people never overwrite each other's work.

## Steps

1. Open **Sync status**. Conflicts show **Needs review** with _The server changed while you were
   offline. Your change was not applied; the server version is shown._
2. Open the task to see what it looks like now.
3. If the task is still yours, do the step again (for example save or submit again).
4. Select **Dismiss** to remove the line from **Sync status**.

![A conflict in Sync status (Chromium runtime test)](screens/phase6-07-conflict.png)

{{diagram wf-40}}

## Expected result

The line disappears. Later actions for the same task were also held back and marked, so they are not
applied out of order.

## Common errors

| Message                     | Why                             | What to do                             |
| --------------------------- | ------------------------------- | -------------------------------------- |
| Task no longer in your list | It was reassigned or cancelled. | Dismiss the line; ask your supervisor. |

## Troubleshooting

See [Sync conflict](article:ts.sync-conflict).
