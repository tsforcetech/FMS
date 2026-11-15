---
id: staff.notifications
title: Alerts, profile and settings
module: Staff Web
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [staff, technician, supervisor]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: Read your alerts, choose which alerts you get, change language and company, and sign out.
routes: [/notifications, /profile]
screenshots: [phase5-10-notifications.png, staff-profile.png]
related: [staff.my-day, mobile.language, ts.no-tasks]
sources:
  - apps/staff-web/src/screens/Profile.tsx
  - apps/staff-web/src/i18n.tsx
  - packages/shared/src/cases.ts
keywords:
  [
    'alerts',
    'notifications',
    'Mark all read',
    'You are all caught up',
    'profile',
    'shift',
    'leave',
    'Employee ID',
    'language',
    'Sign out',
    'push',
  ]
---

**Alerts** tells you when something changes — for example _New task assigned_, _Task due soon_,
_Rework required_ or _Work order assigned_. **Profile** shows your details and settings.

## Steps

1. Select **Alerts** in the bottom bar. New alerts are highlighted. Select one to open the task or
   work order.
2. Select **Mark all read** to clear the badge. With nothing new you see _You are all caught up_.
3. Select **Profile** to see your **Employee ID**, company, sites, **My shift**, **Working days**
   and upcoming **Leave**.
4. Under **Notifications** switch alert types on or off and save.
5. Under **Language** choose your language (see [Change language](article:mobile.language)).
6. If you work for more than one company, choose the company in the company list.
7. Select **Sign out** when you finish, especially on a shared device.

![The alerts list](screens/phase5-10-notifications.png)

![The profile page](screens/staff-profile.png)

> **Note:** Alerts appear inside the app only. Email and push delivery are not connected yet, so
> you do not get a phone notification when the app is closed.

## Expected result

Alert settings are saved for your account and apply on the staff web and mobile app.

## Common errors

| Message                                                                                         | Why                                                                   | What to do                                                       |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| _Check-in/check-out and location attendance are planned for the mobile app and are not active._ | Shown on the staff web profile: attendance is done in the mobile app. | Use the mobile app; see [Attendance](article:mobile.attendance). |

## Troubleshooting

- Shift or leave is wrong: your supervisor or HR updates it in the admin app.
