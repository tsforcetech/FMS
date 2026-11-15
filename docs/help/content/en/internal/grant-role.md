---
id: ops.grant-role
title: 'Operator runbook: grant or revoke a platform role'
module: Sharaco Platform Administration
category: technical-support
audience: internal
apps: [platform]
roles: [platform]
version: '0.8'
reviewed: '2026-11-15'
owner: Platform Operations
description: Give a Sharaco staff member a platform console role, change it, or remove it, using the trusted operator script.
routes: []
screenshots: [platform-settings.png]
prerequisites:
  - Operator access to the Google Cloud project with Application Default Credentials
  - Node.js and the repository dependencies installed (npm ci)
  - Written approval for the role from the platform owner
  - The person's Firebase account exists and its email is verified
permissions:
  - Sharaco operator with project credentials (not available to any app user)
related: [platform.overview, platform.audit, role.platform-admin, ts.platform-not-authorized]
sources:
  - scripts/grant-platform-role.mjs
  - packages/shared/src/saas.ts
  - firebase/firestore.rules
keywords: [platformRole, custom claim, Admin SDK, grant-platform-role, revoke, owner, billing, support, viewer, The account email is not verified]
---

Platform authority comes **only** from the `platformRole` custom claim on a Firebase Auth account,
and the security rules accept it only together with a verified email. The claim can only be set with
the Admin SDK by `scripts/grant-platform-role.mjs`, run by an operator with their own Application
Default Credentials. No app, company role or console button can grant it.

> **Warning:** This repository is public. Never paste real emails, passwords, tokens, key files or
> command output containing personal data into tickets, chat, commits or documentation. The values
> below are placeholders.

## Roles

| `--role` | Console label | Use for |
| --- | --- | --- |
| `owner` | Platform owner | Very few people; can register companies and do everything |
| `billing` | Billing administrator | Plans, subscriptions, invoices |
| `support` | Support | Requesting support access to companies |
| `viewer` | Read-only viewer | Reporting and oversight |

Grant the least privileged role that does the job.

## Steps — grant or change a role

1. Confirm the approval and that the person has signed in once with their Sharaco email and verified
   it.
2. Sign in with your operator Google account:

   ```bash
   gcloud auth application-default login
   ```

3. Run the script, repeating the project ID in `--confirm-project` (a guard against the wrong
   project):

   ```bash
   node scripts/grant-platform-role.mjs --project facilityos-43386 --confirm-project facilityos-43386 --email <staff-email> --role <owner|billing|support|viewer>
   ```

4. The script sets the claim, **revokes the person's refresh tokens** so the change takes effect, and
   writes *platform.role.granted* to the platform audit log (By: *trusted-operator*).
5. Ask the person to sign out and sign in again, and to check **Configuration → Your platform role**.

![Configuration page showing the role after sign-in](screens/platform-settings.png)

## Steps — revoke a role

```bash
node scripts/grant-platform-role.mjs --project facilityos-43386 --confirm-project facilityos-43386 --email <staff-email> --revoke
```

The claim is removed, sessions are revoked and *platform.role.revoked* is logged. Do this the same day
someone leaves Sharaco or changes job.

## Local testing

Against the emulators use a `demo-*` project ID with `FIREBASE_AUTH_EMULATOR_HOST` set. The script
refuses demo projects without the emulators and real projects with them.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Required: --project ID --confirm-project ID --email EMAIL (--role owner\|billing\|support\|viewer \| --revoke)* | Missing or mismatched arguments. | Repeat the same project ID; give a valid role. |
| *The account email is not verified…* | Rules require a verified email. | Ask the person to verify, then rerun. |
| *demo-\* projects only with the emulators, real projects only without them.* | Environment mismatch. | Unset the emulator variables for the live project. |
| User not found | No Firebase account for that email. | Ask the person to create/sign in to an account first. |

## Rules to remember

- A tenant **owner/admin** is never a platform user; do not grant a platform role to a customer's
  staff.
- Keep a record of who holds which role, and review it regularly.
- MFA enforcement for platform staff is **pending** Identity Platform MFA approval.
