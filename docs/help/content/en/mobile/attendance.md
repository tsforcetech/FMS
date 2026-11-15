---
id: mobile.attendance
title: Check in and check out (attendance)
module: Mobile Application
category: daily-tasks
audience: public
apps: [mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Mobile
description: Record the start and end of your working day in the mobile app; needs a connection.
routes: [/attendance]
screenshots: [phase6-02-attendance.png]
diagrams: [wf-38]
related: [mobile.gps, staff.my-day, reports.attendance, ts.permissions-denied]
sources:
  - apps/mobile/src/screens/Attendance.tsx
  - apps/staff-web/src/i18n.tsx
  - docs/phase6-report.md
keywords:
  [
    'attendance',
    'Check in',
    'Check out',
    'Checked in at',
    'late',
    'clock in',
    'punch',
    'Needs a connection',
  ]
---

Use **Attendance** to check in when you start work and check out when you finish. The official
time is the **server time**, not the phone clock.

## Before you start

- You need an internet connection: _Needs a connection: the server clock is the official attendance
  time._
- Attendance is in the mobile app only; the staff web does not record attendance.

## Steps

1. Open **Profile** and select **Attendance** (Home also shows your check-in status).
2. Select **Check in**. The app takes one location reading if allowed.
3. At the end of the day open **Attendance** again and select **Check out**.

![Attendance with check-in time and location (Chromium runtime test, not a physical phone)](screens/phase6-02-attendance.png)

{{diagram wf-38}}

## Expected result

- The screen shows **Checked in at** and later **Checked out at** with the time.
- If you check in more than 5 minutes after your shift start, it shows _{n} min late_.
- Your recent days are listed under **History**.

> **Note:** If location is off, you can still check in: _Location permission is off. You can
> continue; the record will show no location._ GPS is approximate and recorded only when you check
> in or out.

## Common errors

| Message                                                                 | Why                                        | What to do                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| _Needs a connection: the server clock is the official attendance time._ | You are offline; the buttons are disabled. | Connect and try again.                                            |
| _Location could not be determined; continuing without it._              | No GPS signal.                             | The check-in still counts; it has no location.                    |
| Wrong time recorded                                                     | Mistakes happen.                           | Ask your supervisor or admin — they can correct it with a reason. |

## Troubleshooting

- You cannot correct your own attendance. Supervisors and admins make corrections, and each
  correction keeps its reason.
