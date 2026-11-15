---
id: setup.retention
title: Record your data retention policy
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Security
description: Set how many days GPS locations, attendance, photos, notifications and audit history should be kept. This records the policy; nothing is deleted automatically yet.
routes: [/retention]
permissions:
  - Company owner or admin
screenshots: [admin-retention.png]
related: [setup.audit, setup.backup, mobile.gps, mobile.attendance]
sources:
  - apps/admin-web/src/management/Operations.tsx
  - apps/admin-web/src/management/reportsStore.ts
keywords:
  [
    retention,
    privacy,
    GPS,
    attendance,
    photos,
    purge,
    delete data,
    policy,
    Keep audit history for at least one year,
  ]
---

**Administration → Data retention** records how long your company intends to keep personal and
operational data.

> **Warning:** This page records a **policy only**. On the free Firebase plan there is no server
> job to purge data, so expired records are **not removed automatically**. Purging needs an
> approved server process.

## Before you start

Agree the periods with whoever is responsible for privacy in your company. Defaults are GPS
90 days, attendance 730 days, photos 365 days, notifications 90 days and audit history
2,555 days (about seven years).

## Steps

1. Open **Administration → Data retention**.
2. Enter whole numbers of days for:
   - **GPS locations (days)** — check-in/out coordinates and GPS evidence.
   - **Attendance records (days)** — check-in/out times and corrections.
   - **Photos (days)** — evidence photos in storage, when photo storage is enabled.
   - **Notifications (days)** — in-app notification history.
   - **Audit history (days)** — minimum one year.
3. Optionally explain your decision in **Policy note**.
4. Select **Save policy**.

![Data retention policy](screens/admin-retention.png)

## Expected result

The message _Retention policy saved_ appears and the values are kept for your company. They
document your policy for audits and for a future purge process; existing data is unchanged.

## Common errors

| Message                                             | Why                                                      | What to do                             |
| --------------------------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| _Retention periods must be whole days (1 or more)._ | A field is empty, zero, has decimals or is above 36,500. | Enter a whole number from 1 to 36,500. |
| _Keep audit history for at least one year._         | **Audit history (days)** is below 365.                   | Enter 365 or more.                     |

## Troubleshooting

- **Old GPS data is still visible:** expected — nothing is purged automatically yet.
- **Photos:** photo upload depends on cloud storage that is pending activation; the photo period
  applies once storage is enabled.
