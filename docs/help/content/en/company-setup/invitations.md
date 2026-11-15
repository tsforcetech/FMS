---
id: setup.invitations
title: Invite people to your company
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Security
description: Create an invitation link for an email address and role, share it, and see how the person joins with a verified email.
routes: [/invitations, /join]
helpIds: [setup.staff]
permissions:
  - Company owner or admin. Only the owner can invite admins; nobody invites an owner.
screenshots:
  [
    phase8-05-invitation-created.png,
    phase8-06-join-accepted.png,
    admin-invitations.png,
  ]
diagrams: [wf-03]
related:
  [
    gs.roles,
    setup.staff-access,
    setup.customer-access,
    setup.user-access,
    gs.sign-in,
  ]
sources:
  - apps/admin-web/src/management/SaasPages.tsx
  - apps/admin-web/src/management/tenantSaas.ts
  - apps/admin-web/src/Join.tsx
  - firebase/firestore.rules
keywords:
  [
    invite,
    invitation,
    join,
    invitation link,
    verify email,
    accept invitation,
    expired invitation,
    revoke invitation,
    Copy link,
  ]
---

**Administration → Invitations** lets an owner or admin invite a person by email address and
role. The person opens the link, signs in or creates an account with **that same email**,
verifies the address and accepts. The membership is created only for that verified email — the
link alone grants nothing.

> **Note:** Email delivery is not automated yet. FacilityOS creates the link; you copy it and send
> it yourself (for example by your own email or messaging).

![The Administration → Invitations screen](screens/admin-invitations.png)

## Before you start

- Decide the role: Admin (owner only), Site manager, Department manager, Supervisor, Technician,
  Staff, Viewer or Customer. See [Roles and permissions](article:gs.roles).
- Check the person's exact email address. It must match the account they will sign in with.

## Steps

1. Open **Administration → Invitations** and select **Invite someone**.
2. Enter the **Email** and choose the **Role**. The _Admin_ role is offered only to the owner
   (_Only the owner can invite admins. Owners are provisioned by Sharaco._).
3. Set **Expires after (days)** — from 1 to 14 days.
4. Optionally add a **Note (optional)**.
5. Select **Create invitation**. A green banner _Invitation for <email>_ shows the link. Select
   **Copy** (_Link copied_) and send it to the person.
6. Later you can **Copy link** again or **Revoke** a pending invitation from the list
   (_Invitation revoked_). The list shows **Email**, **Role**, **Status** and **Expires**;
   overdue invitations show _Expired_.

![An invitation created with its link](screens/phase8-05-invitation-created.png)

### What the invited person does

1. Opens the link. The page **Join a company on FacilityOS** appears.
2. Signs in with their **Email** and **Password**, or chooses **Create account** (password of at
   least 8 characters).
3. Opens the verification email, returns and selects **I have verified — accept** (or
   **Accept invitation** if already verified).
4. Sees **You have joined** and selects **Continue**.

{{diagram wf-03}}

## Expected result

- The invitation status becomes _Accepted_ and the person appears on
  [User access](article:setup.user-access) with the invited role.
- Owners and admins can open the admin app straight away. For staff and customers the join page
  says _An administrator may still need to link you to your employee or client record_ — do that
  in [Staff access](article:setup.staff-access) or
  [Customer access](article:setup.customer-access).

![The join page after accepting](screens/phase8-06-join-accepted.png)

## Common errors

| Message                                                                  | Why                                        | What to do                                                                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Enter a valid email address._                                           | The email is not valid.                    | Correct the address.                                                                                                                                |
| _Choose a role._                                                         | No valid role was selected.                | Choose a role.                                                                                                                                      |
| _Invitations expire after 1 to 14 days._                                 | The expiry is outside 1–14.                | Enter a number from 1 to 14.                                                                                                                        |
| _Verify your email address first, then accept the invitation._           | The account email is not verified.         | Open the verification email, then accept. **Send again** in the _Verify your email first_ banner sends it again (_Verification email sent again._). |
| _This invitation is for <email>. Sign in with that email._               | The person signed in with another address. | Sign out and sign in with the invited email.                                                                                                        |
| _This invitation does not exist or was addressed to a different email._  | The link is wrong or for someone else.     | Ask the admin to check the link.                                                                                                                    |
| _This invitation has expired. Ask for a new one._                        | The expiry date passed.                    | The admin creates a new invitation.                                                                                                                 |
| _This invitation was already accepted._ / _This invitation was revoked._ | The link can no longer be used.            | Ask the admin for a new invitation if needed.                                                                                                       |
| _Use at least 8 characters for the password._                            | The new password is too short.             | Choose a longer password.                                                                                                                           |
| _An account with this email exists. Sign in instead._                    | The person already has a FacilityOS login. | Use **Sign in** with that account.                                                                                                                  |

## Troubleshooting

- **The person never received an email:** this is expected — invitations are not emailed
  automatically. Send the copied link yourself.
- **You need to invite an owner:** owners are provisioned by Sharaco only.
- **A link was sent to the wrong person:** **Revoke** it at once. It still only works for the
  invited, verified email address.
