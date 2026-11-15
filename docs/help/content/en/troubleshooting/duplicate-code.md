---
id: ts.duplicate-code
title: '"This code is already reserved"'
module: Troubleshooting
category: technical-support
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Support
description: Saving a site, employee, asset or other record fails because its code is already used.
routes: []
screenshots: [phase4-02-site-form.png]
related: [sites.create, import.overview, ts.import-failed]
sources:
  - apps/admin-web/src/management/store.ts
  - packages/shared/src/importing.ts
keywords:
  [
    'duplicate code',
    'This code is already reserved. Choose another code.',
    'unique code',
    'code exists',
  ]
---

## Symptom

Saving a record shows _This code is already reserved. Choose another code._

![A record form with its code field](screens/phase4-02-site-form.png)

## Likely cause

Codes are unique within your company for each kind of record (for example all site codes). Another
record of the same kind already holds the code — possibly one hidden by your list filters, such as an
archived or inactive record. Codes are reserved on the server, so two people saving the same code at
the same time cannot both succeed.

## How to check

Search the list for the code with all filters cleared, including archived or inactive records.

## Resolution

- Choose another code (for example add a suffix such as `-02`).
- If the existing record is the same thing, edit that record instead of creating a new one.

## Who can fix it

Company **owner** or **admin**.

## Related

[Create a site](article:sites.create) · [Import failed](article:ts.import-failed)
