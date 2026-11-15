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
screenshots: [phase8-05-invitation-created.png, phase8-06-join-accepted.png]
diagrams: [wf-03]
related: [gs.roles, setup.staff-access, setup.customer-access, setup.user-access, gs.sign-in]
sources:
  - apps/admin-web/src/management/SaasPages.tsx
  - apps/admin-web/src/management/tenantSaas.ts
  - apps/admin-web/src/Join.tsx
  - firebase/firestore.rules
keywords: [invite, invitation, join, invitation link, verify email, accept invitation, expired invitation, revoke invitation, Copy link]
---

**Administration → Invitations** lets an owner or admin invite a person by email address and
role. The person opens the link, signs in or creates an account with **that same email**,
verifies the address and accepts. The membership is created only for that verified email — the
link alone grants nothing.

> **Note:** Email delivery is not automated yet. FacilityOS creates the link; you copy it and send
> it yourself (for example by your own email or messaging).

## Before you start

- Decide the role: Admin (owner only), Site manager, Department manager, Supervisor, Technician,
  Staff, Viewer or Customer. See [Roles and permissions](article:gs.roles).
- Check the person's exact email address. It must match the account they will sign in with.

## Steps

1. Open **Administration → Invitations** and select **Invite someone**.
2. Enter the **Email** and choose the **Role**. The *Admin* role is offered only to the owner
   (*Only the owner can invite admins. Owners are provisioned by Sharaco.*).
3. Set **Expires after (days)** — from 1 to 14 days.
4. Optionally add a **Note (optional)**.
5. Select **Create invitation**. A green banner *Invitation for <email>* shows the link. Select
   **Copy** (*Link copied*) and send it to the person.
6. Later you can **Copy link** again or **Revoke** a pending invitation from the list
   (*Invitation revoked*). The list shows **Email**, **Role**, **Status** and **Expires**;
   overdue invitations show *Expired*.

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

- The invitation status becomes *Accepted* and the person appears on
  [User access](article:setup.user-access) with the invited role.
- Owners and admins can open the admin app straight away. For staff and customers the join page
  says *An administrator may still need to link you to your employee or client record* — do that
  in [Staff access](article:setup.staff-access) or
  [Customer access](article:setup.customer-access).

![The join page after accepting](screens/phase8-06-join-accepted.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Enter a valid email address.* | The email is not valid. | Correct the address. |
| *Choose a role.* | No valid role was selected. | Choose a role. |
| *Invitations expire after 1 to 14 days.* | The expiry is outside 1–14. | Enter a number from 1 to 14. |
| *Verify your email address first, then accept the invitation.* | The account email is not verified. | Open the verification email, then accept. **Send again** in the *Verify your email first* banner sends it again (*Verification email sent again.*). |
| *This invitation is for <email>. Sign in with that email.* | The person signed in with another address. | Sign out and sign in with the invited email. |
| *This invitation does not exist or was addressed to a different email.* | The link is wrong or for someone else. | Ask the admin to check the link. |
| *This invitation has expired. Ask for a new one.* | The expiry date passed. | The admin creates a new invitation. |
| *This invitation was already accepted.* / *This invitation was revoked.* | The link can no longer be used. | Ask the admin for a new invitation if needed. |
| *Use at least 8 characters for the password.* | The new password is too short. | Choose a longer password. |
| *An account with this email exists. Sign in instead.* | The person already has a FacilityOS login. | Use **Sign in** with that account. |

## Troubleshooting

- **The person never received an email:** this is expected — invitations are not emailed
  automatically. Send the copied link yourself.
- **You need to invite an owner:** owners are provisioned by Sharaco only.
- **A link was sent to the wrong person:** **Revoke** it at once. It still only works for the
  invited, verified email address.
