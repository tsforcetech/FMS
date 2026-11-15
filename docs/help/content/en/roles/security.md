---
id: role.security
title: 'Role guide: Security staff'
module: Role Guides
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [staff]
version: '0.8'
reviewed: '2026-11-15'
owner: Customer Success
description: How security guards complete patrol and inspection checklists, verify checkpoints by QR, report incidents and escalate.
routes: ['/', /scan, /report]
prerequisites:
  - A login with role Staff, linked to your employee record
screenshots: [phase6-03-scanner.png, phase6-08-scan-result.png, phase6-02-attendance.png]
diagrams: [wf-27, wf-36, wf-37, wf-38, wf-39]
related: [mobile.qr, mobile.attendance, mobile.offline, staff.report-issue, train.first-checklist, role.housekeeping]
sources:
  - apps/admin-web/src/management/staffStore.ts
  - apps/mobile/src/screens/Scan.tsx
  - apps/mobile/src/screens/Attendance.tsx
  - packages/shared/src/cases.ts
keywords: [security, guard, patrol, rounds, checkpoint, incident, QR checkpoint]
---

Security guards use the role **Staff** (`staff`). There is no separate "security" permission: patrol
rounds and post checks are **checklist tasks** that your company sets up from templates and
recurring schedules. The **mobile app** is recommended because it can scan checkpoint QR labels,
take photos and work offline.

## What you can access

- **Home / My tasks** — your patrol and inspection rounds.
- **Scan** (mobile) — scan a QR label at a location or asset to open your tasks there or verify a
  checkpoint (**Verify for task**).
- **Report** — report incidents and faults (Problem type *Security*, *Fire & safety*, etc.).
- **Attendance** (mobile) — **Check in** / **Check out**.

## Responsibilities

- Complete each round on time and verify checkpoints where required.
- Record findings truthfully, with photos where asked.
- Report security and safety issues immediately.

## Daily routine

1. **Check in** at the start of the shift ([Attendance](article:mobile.attendance)).
2. Open your next round, **Start task**.
3. At each checkpoint **Scan** the QR label; *Verified* confirms you were there
   ([QR scanning](article:mobile.qr)).
4. Answer the checklist questions; add photos for anything abnormal.
5. Submit the round. Repeat for each round.
6. Incident or fault → **Report**, choose the type, *Urgent / unsafe* if needed
   ([Report a problem](article:staff.report-issue)).
7. **Check out** at the end of the shift.

![Scanning a checkpoint](screens/phase6-03-scanner.png)

![Scan result](screens/phase6-08-scan-result.png)

## Escalation

> **Warning:** For fire, intrusion, injury or any emergency, follow your site's emergency procedure
> and call emergency services first. FacilityOS records the event afterwards; it does not raise
> alarms.

Then inform your supervisor and report it in the app.

## FAQs

- **The scan says *You are not authorized for this asset or location*.** The checkpoint is on a site not
  linked to your login — tell your supervisor ([Wrong site](article:ts.wrong-site)).
- **No signal on the roof.** Keep working; the app queues your answers and syncs later
  ([Offline work](article:mobile.offline)).
