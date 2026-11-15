---
id: gs.sign-in
title: Signing in and choosing your company
module: Getting Started
category: getting-started
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Product
description: Sign in to the admin app with your email and password, reset a forgotten password and switch between companies.
routes: [/]
prerequisites:
  - An owner or admin membership in an active (or read-only) company
permissions:
  - Company owner or admin. Other roles use the staff portal, mobile app or customer portal.
screenshots: [phase4-01-login.png]
diagrams: [wf-03]
related: [gs.overview, gs.navigation, gs.roles, setup.invitations]
sources:
  - apps/admin-web/src/App.tsx
  - packages/shared/src/index.ts
keywords: [login, log in, password, forgot password, reset password, switch company, Access denied, Unable to sign in, Too many attempts]
---

The admin app opens with the **Sign in to your workspace** page. After you sign in, FacilityOS
checks your company memberships and opens the company you administer.

## Before you start

- You need an email address and password for a FacilityOS login. Logins are created by Sharaco
  (company owners), by accepting an [invitation](article:setup.invitations), or by the trusted
  provisioning procedure.
- Only **owners** and **admins** can open the admin app. Staff use the staff portal (`/staff/`)
  or the mobile app; customers use the customer portal (`/customer/`).

## Steps

1. Open the admin app address your company was given.
2. Enter your **Email address** and **Password**, then select **Sign in**.
3. Wait while *Verifying company access…* is shown. FacilityOS checks that your membership is
   active, that your role is owner or admin and that the company is active or read-only.
4. If you belong to more than one company, use the company selector in the top bar
   (**Current company**) to switch. If you belong to many companies, select
   **Load more companies** at the bottom of the page.
5. To sign out, open the profile menu (your name in the top-right corner) and select
   **Sign out**.

### Reset a forgotten password

1. On the sign-in page type your **Email address**.
2. Select **Forgot your password?**
3. The page shows *If this email is eligible, you will receive password reset instructions.* The
   message is the same whether or not the address exists, so it cannot be used to discover
   accounts. Follow the link in the email to set a new password.

![The sign-in page](screens/phase4-01-login.png)

{{diagram wf-03}}

## Expected result

The **Overview** dashboard of your company opens. Your name appears in the top-right corner and
the company name in the company selector.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Enter a valid email address and your password.* | The email is not a valid address or the password is empty. | Correct the fields and try again. |
| *Enter your email address first.* | You selected **Forgot your password?** with an empty or invalid email. | Type your email, then select the link again. |
| *Unable to sign in. Check your email and password or contact your administrator.* | Wrong credentials, or the account was disabled. | Check the address and password, or use **Forgot your password?** |
| *Too many attempts. Please try again later.* | Several failed attempts in a short time. | Wait a few minutes before trying again. |
| *Unable to connect. Check your connection and try again.* | No network connection. | Check your connection. |
| *Access denied* — "This account has no active administrator membership. Contact your company owner to arrange access." | You signed in, but have no active owner/admin membership. | Staff use `/staff/`. Otherwise ask the owner to check your membership; select **Refresh access** after it is fixed. |
| *Access denied* — "Your company membership is no longer active or does not allow admin access." | Your membership was suspended, your role changed, or the company is suspended. | Contact your company owner (or Sharaco for a suspended company). |

## Troubleshooting

- **The page keeps showing *Checking your session…***: reload the page. If it continues, check
  your network connection.
- **I see *Unable to load your workspace***: select **Refresh access**. If you belong to many
  companies, **Check more memberships** loads further memberships.
- **Do not share passwords.** Each person must have their own login; access is checked per
  login by the database security rules.
