---
id: faq.staff
title: Questions from field staff
module: FAQs
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [staff, technician, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Support
description: Short answers for technicians, housekeeping, security staff and supervisors.
routes: []
screenshots: []
related:
  [
    staff.my-day,
    staff.checklist,
    mobile.install,
    mobile.offline,
    mobile.photos,
    ts.no-tasks,
  ]
sources:
  - apps/staff-web/src/i18n.tsx
  - apps/mobile/src/offline/sync.ts
  - docs/phase6-report.md
keywords:
  [
    'FAQ',
    'staff questions',
    'offline',
    'photos',
    'attendance',
    'iPhone',
    'password',
  ]
---

## I forgot my password.

On the sign-in page select **Forgot your password?**. If no email arrives, ask your administrator.

## Why do I see "No tasks for today"?

Nothing is assigned to you today, or the tasks have not been created yet. Check **My tasks →
Upcoming** and ask your supervisor. See [No tasks showing](article:ts.no-tasks).

## Can I work without internet?

In the **mobile app**, yes — for tasks that were downloaded before. Your work is saved on the phone
and sent when you reconnect. Attendance, approvals and work orders need a connection. On the
**staff web**, keep the page open and save when the connection returns. See
[Work offline](article:mobile.offline).

## Can my supervisor see my photos?

Not yet. Photos are kept encrypted on your phone because cloud upload is not activated. See
[Photos](article:mobile.photos).

## Is the app tracking my location?

No. The app reads your location only when you press **Capture location**, **Check in** or **Check
out**.

## Is there an iPhone app?

Not yet. The iOS app has not been built or published. Use the staff web in Safari. Android users
can install the test build — see [Install the mobile app](article:mobile.install).

## I made a mistake in a submitted task.

Tell your supervisor. They can return it for correction, and you redo it from **Rework**. See
[Rework](article:staff.rework).

## My check-in time is wrong.

Only a supervisor or admin can correct attendance, with a reason. Ask your supervisor.

## Why can't I approve my own work?

The system always needs a second person to approve. Another supervisor or manager must review it.
