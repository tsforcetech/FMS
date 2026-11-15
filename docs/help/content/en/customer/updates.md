---
id: customer.updates
title: Updates from your facility team
module: Customer Portal
category: customer-portal
audience: public
apps: [customer]
roles: [customer]
version: '0.7'
reviewed: '2026-11-15'
owner: Customer Portal
description: Follow status changes and replies on your requests in one timeline.
routes: [/updates, /profile]
screenshots: [customer-updates.png]
related: [customer.confirm, customer.requests, customer.sign-in]
sources:
  - apps/customer-web/src/App.tsx
keywords: ["Updates", "notifications", "replies", "unread", "badge", "email"]
---

**Updates** shows the latest changes on your requests — new statuses and replies from the team —
newest first.

## Steps

1. Look at the **Updates** badge in the bottom bar: it shows how many requests changed since your
   last visit.
2. Open **Updates**. New items are highlighted.
3. Select an item to open the request.

![Updates timeline](screens/customer-updates.png)

## Expected result

Opening **Updates** marks the items as seen and clears the badge. This is remembered in this
browser only, so another device shows them as new again.

> **Note:** Updates appear in the portal only. Email notifications are not connected yet — check the
> portal for progress.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| No updates | Nothing changed on your requests. | Nothing to do. |
