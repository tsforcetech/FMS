---
id: ts.cannot-submit
title: Cannot submit a task
module: Troubleshooting
category: technical-support
audience: public
apps: [staff, mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Support
description: The Submit or Mark as completed button does not work or shows an error.
routes: []
screenshots: [phase5-07-review.png, phase6-05-offline-submit.png]
related: [staff.checklist, mobile.offline, ts.evidence-missing, ts.access-denied, ts.read-only]
sources:
  - apps/staff-web/src/screens/TaskView.tsx
  - packages/shared/src/tasks.ts
  - apps/mobile/src/screens/TaskRun.tsx
keywords: ["cannot submit", "Submit for approval", "Complete the highlighted answers first.", "paused", "offline", "submit fails"]
---

## Symptom

**Submit for approval** or **Mark as completed** is missing or shows an error.

## Likely cause

| Message or sign | Cause |
| --- | --- |
| *Complete the highlighted answers first.* | A required answer is missing or invalid. |
| No submit button | The task is paused (select **Resume**), not started, or already submitted. |
| *You are offline. Your answers stay on this screen; save when the connection returns.* | Staff web without connection. |
| *You do not have permission for this. Ask your supervisor.* | Task reassigned, site link removed, or the company is read-only. |

## How to check

1. Go to **Review answers** and look at the highlighted steps.
2. Check the task status at the top.
3. Check your connection.

![Review answers](screens/phase5-07-review.png)

## Resolution

- Answer the highlighted questions, then submit.
- Paused: select **Resume**, then submit.
- Offline on the web: keep the page open and submit when online. In the mobile app, submit offline —
  it is saved and sent later.

![Submitting offline in the mobile app (Chromium runtime test)](screens/phase6-05-offline-submit.png)

## Who can fix it

**Staff** (answers, connection); **supervisor** or **admin** (assignment, access).

## Related

[Complete a checklist](article:staff.checklist) · [Evidence missing](article:ts.evidence-missing)
