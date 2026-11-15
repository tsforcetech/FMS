---
id: ts.scheduler-not-active
title: Scheduler not activated (recurring tasks not generated)
module: Troubleshooting
category: technical-support
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Support
description: Recurring tasks do not appear because no automatic scheduler run is recorded.
routes: []
screenshots: [phase4-17-scheduler-monitor.png]
diagrams: [wf-26]
related: [scheduling.generation, scheduling.recurring, ts.no-tasks]
sources:
  - apps/admin-web/src/management/Notifications.tsx
  - apps/admin-web/src/management/scheduling.ts
keywords: ["scheduler", "No server run recorded yet", "The server job has not run in the last 2 hours", "Run scheduler now", "automatic generation"]
---

## Symptom

Schedules are *Active* but no new tasks appear. **Administration → Scheduler monitor** shows *No
server run recorded yet* or *The server job has not run in the last 2 hours*.

![Scheduler monitor](screens/phase4-17-scheduler-monitor.png)

## Likely cause

Automatic generation runs as a scheduled server job every 30 minutes, signed in as a dedicated
scheduler account. It works only after that account has been set up for your installation. Until
then *nothing is generated automatically*.

## How to check

Open **Administration → Scheduler monitor** and read the banner and the list of runs (manual and
server).

## Resolution

1. Select **Run scheduler now**. Tasks for the coming period are generated at once. Running it
   again never creates duplicates.
2. Repeat daily until automatic runs appear, or ask the people who operate your installation to
   activate the server job.

{{diagram wf-26}}

> **Warning:** Do not give the scheduler account more rights than an administrator to "make it work";
> it is designed to run under the same security rules.

## Who can fix it

**Admin** or **owner** (manual run). Activation of the automatic job: whoever operates your
FacilityOS installation.

## Related

[How tasks are generated](article:scheduling.generation)
