---
id: faq.customer
title: Questions from customers
module: FAQs
category: customer-portal
audience: public
apps: [customer]
roles: [customer]
version: '0.8'
reviewed: '2026-11-15'
owner: Support
description: Short answers for customers using the customer portal.
routes: []
screenshots: []
related: [customer.sign-in, customer.requests, customer.confirm, customer.locations, ts.allocation-expired]
sources:
  - apps/customer-web/src/App.tsx
  - apps/admin-web/src/management/customerStore.ts
  - docs/phase7-report.md
keywords: ["FAQ", "customer questions", "tenant", "request", "emergency", "privacy"]
---

## How do I get access?

Your facility provider creates your login and links it to your organisation and locations. Contact
them if you do not have one.

## Can I see who is working on my request?

No. You see the progress, status and the team's replies. Staff names, internal notes, work orders
and costs are not shown in the portal.

## Can other tenants see my requests?

No. You see only your own organisation's requests and the locations shared with your login. This is
enforced by the server.

## A location is missing or shows "Ended".

The service period for that location is not active, or it is not shared with your login. Contact
your facility team. See [Location period ended](article:ts.allocation-expired).

## What should I do in an emergency?

Raise an **Emergency** request **and** call your building's emergency number. The portal is not an
emergency line.

## Why was my request refused as a duplicate?

You already have an open request for the same location, category and description. Open that request
and add a message instead.

## The problem is back after I confirmed it.

Raise a new service request and mention the earlier reference (SR-…).

## Can I attach photos?

Not yet.

## How do I change my password?

Open **Profile → Change password**. A reset link is sent to your email.
