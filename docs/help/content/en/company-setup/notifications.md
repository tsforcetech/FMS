---
id: setup.notifications
title: Use the notification centre and settings
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Task Management
description: Read and clear in-app notifications, choose which notification types you receive, and understand that email and push delivery are pending activation.
routes: [/notifications, /notification-settings]
permissions:
  - Company owner or admin (each person manages their own preferences)
screenshots:
  [
    phase4-18-notifications.png,
    admin-notification-settings.png,
    admin-notifications.png,
  ]
related:
  [
    gs.navigation,
    tasks.approvals,
    cases.escalations,
    cases.sla,
    staff.notifications,
  ]
sources:
  - apps/admin-web/src/management/Notifications.tsx
  - apps/admin-web/src/management/notifyStore.ts
  - packages/shared/src/cases.ts
keywords:
  [
    notifications,
    bell,
    unread,
    mark all read,
    preferences,
    email,
    push,
    task overdue,
    SLA breach,
    Pending activation,
  ]
---

FacilityOS creates **in-app notifications** when something needs attention — a task is assigned,
overdue or waiting for approval, a work order or complaint is created, an SLA is breached and so
on. Each notification is stored once per event and person, so repeated scheduler runs do not
create duplicates.

> **Note:** Only in-app notifications are delivered today. **Email delivery** and
> **push notifications** are shown as _Pending activation_: no email or push message is sent until
> an approved provider is connected.

![The Notifications → Notification centre screen](screens/admin-notifications.png)

## Before you start

Notifications appear for the person the event concerns (for example the assignee or the
approver). Owners and admins see their own notifications in the admin app.

## Steps

### Read notifications

1. Select the bell in the top bar, or open **Notifications → Notification centre**.
2. Use **Show** to switch between **All** and **Unread**.
3. Select a notification to open the related task, work order or case. It is marked as read.
4. Select **Mark all read** to clear the unread count. You see _N marked as read._ (or
   _Nothing unread._).

![The notification centre](screens/phase4-18-notifications.png)

### Choose what you receive

1. Open **Notifications → Notification settings**.
2. Under **In-app notifications**, switch types on or off: _New task assigned_, _Task due soon_,
   _Task overdue_, _Task reassigned_, _Task submitted_, _Task awaiting approval_,
   _Task rejected_, _Rework required_, _Task approved_, _Work order created_,
   _Work order assigned_, _Escalation raised_, _SLA breach_, _Maintenance due_,
   _Complaint registered_ and _Issue status updated_.
3. Select **Save preferences**. The message _Preferences saved._ appears.

![Notification settings](screens/admin-notification-settings.png)

## Expected result

- The bell shows the number of unread notifications and the centre lists them newest first.
- Types you switched off no longer appear in your notification centre.
- The **Email and push** section stays _Pending activation_.

## Common errors

| Message                                                                                                             | Why                                                | What to do                      |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------- |
| _You are all caught up_                                                                                             | The **Unread** filter is on and nothing is unread. | Switch **Show** to **All**.     |
| _No notifications yet_                                                                                              | No events concerned you yet.                       | Nothing to do.                  |
| _This change was not allowed. A linked record may have changed, or your access was updated. Refresh and try again._ | Saving preferences or marking as read was refused. | Refresh the page and try again. |

## Troubleshooting

- **A colleague did not get an email:** emails are not sent yet; ask them to check the
  notification centre in their app.
- **Overdue or due-soon notifications are missing:** these are created when the scheduler runs.
  Check **Administration → Scheduler monitor**.
- **Preferences are personal.** Switching a type off for yourself does not change what others
  receive.
