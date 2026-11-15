---
id: mobile.sign-in
title: Sign in on the mobile app
module: Mobile Application
category: getting-started
audience: public
apps: [mobile]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Mobile
description: Sign in on the phone, stay signed in for offline work, and sign out safely.
routes: [/, /profile]
screenshots: [phase6-01-my-day.png, phase5-03-not-linked.png]
diagrams: [wf-03]
related: [staff.sign-in, mobile.offline, ts.not-linked, ts.account-revoked]
sources:
  - apps/mobile/src/App.tsx
  - apps/mobile/src/offline/vault.ts
  - docs/phase6-report.md
keywords:
  [
    'login',
    'mobile sign in',
    'sign out',
    'shared phone',
    'revoked',
    'company switch',
  ]
---

The mobile app uses the same login as the staff web. Your access is exactly the same as on the
staff web — the phone never gives you more.

## Steps

1. Open the app and enter your **Email address** and **Password**.
2. Select **Sign in**. **The first sign-in needs an internet connection.** The app then downloads
   your tasks.
3. You stay signed in. Next time you open the app — even without a connection — you see the
   tasks that were downloaded during your last sync.
4. To sign out, open **Profile → Sign out**.

![Home after sign-in (Chromium runtime test)](screens/phase6-01-my-day.png)

{{diagram wf-03}}

## Expected result

Home shows your name, today's work and the sync status in the top bar.

> **Warning:** **Sign out deletes everything this app saved on the phone**, including actions that
> are not yet synced. Open **Sync status** and make sure everything says **Synced** before you sign
> out or switch company.

> **Note:** Tasks, drafts and photos on the phone are stored encrypted. If your access is revoked,
> the app deletes its data from the phone the next time it checks with the server.

## Common errors

| Message                                                   | Why                             | What to do                                         |
| --------------------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| _Your login is not linked to an employee yet_             | Not linked by an administrator. | See [Login not linked](article:ts.not-linked).     |
| _Your staff access has been revoked_                      | Access removed.                 | See [Account revoked](article:ts.account-revoked). |
| _Unable to connect. Check your connection and try again._ | No connection on first sign-in. | Connect to Wi-Fi or mobile data.                   |

![Not linked screen](screens/phase5-03-not-linked.png)

## Troubleshooting

- Password reset works the same as on the staff web: **Forgot your password?**.
