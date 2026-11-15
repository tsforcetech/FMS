---
id: staff.sign-in
title: Sign in to the staff app
module: Staff Web
category: getting-started
audience: public
apps: [staff]
roles: [staff, technician, supervisor]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: Sign in with the work email and password your supervisor gave you and open your day's work.
routes: [/]
prerequisites:
  - An administrator has created your login and linked it to your employee record
permissions:
  - Any active employee whose login is linked under Administration → Staff access
screenshots: [phase5-02-staff-login.png, phase5-03-not-linked.png]
diagrams: [wf-03]
related:
  [
    staff.my-day,
    ts.not-linked,
    ts.account-revoked,
    mobile.sign-in,
    setup.staff-access,
  ]
sources:
  - apps/staff-web/src/App.tsx
  - apps/staff-web/src/i18n.tsx
  - packages/shared/src/index.ts
keywords:
  [
    'login',
    'password',
    'FacilityOS Staff',
    'Sign in to start your day',
    'Forgot your password?',
    'The email or password is not correct.',
    'not linked',
  ]
---

The staff app (**FacilityOS Staff**) is where technicians, housekeeping, security staff and
supervisors see and do their work. You sign in with a work email and password. You cannot create
your own account: your administrator creates it and links it to your employee record.

## Before you start

- Get your **work email** and **password** from your supervisor or administrator.
- Use a phone, tablet or computer with a modern browser and an internet connection.

## Steps

1. Open the staff app address your company gave you. The page says **Sign in to start your day**.
2. Type your **Email address** and **Password**.
3. Select **Sign in**.
4. If you work for more than one company, you can switch company later under **Profile**.
5. You arrive on **Home** (My Day). The bottom bar has **Home**, **My tasks**, **Report**,
   **Alerts** and **Profile**.

![The staff sign-in screen](screens/phase5-02-staff-login.png)

{{diagram wf-03}}

## Expected result

You see **Today's work** with your tasks for today. Your name, company and sites come from your
employee record — you never choose who you are.

## Forgot your password

Select **Forgot your password?**, enter your email and send. The app always answers _If this email
is eligible, you will receive password reset instructions._ — it never tells anyone whether an
account exists. If no email arrives, ask your administrator.

## Common errors

| Message                                       | Why                                                            | What to do                                                                  |
| --------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| _The email or password is not correct._       | Typing mistake or old password.                                | Check the email, try again or use **Forgot your password?**                 |
| _Too many attempts. Please try again later._  | Several wrong passwords in a row.                              | Wait a few minutes before trying again.                                     |
| _Your login is not linked to an employee yet_ | The account exists but is not connected to an employee record. | Ask your administrator; see [Login not linked](article:ts.not-linked).      |
| _Your staff access has been revoked_          | An administrator removed your staff access.                    | Talk to your supervisor; see [Account revoked](article:ts.account-revoked). |
| _Your employee record is not active_          | Your employee record was made inactive.                        | Ask HR or your administrator.                                               |
| _You do not have access to this company_      | Your membership in this company is not active.                 | Ask your administrator.                                                     |

![Screen shown when a login is not linked to an employee](screens/phase5-03-not-linked.png)

## Troubleshooting

- **Unable to connect:** check Wi-Fi or mobile data and try again. Signing in always needs a connection.
- **Wrong company shown:** open **Profile** and choose the company from the list (only shown when you
  belong to more than one).
- **Shared device:** always use **Profile → Sign out** when you finish.
