---
id: customer.confirm
title: Confirm a resolution or ask to reopen
module: Customer Portal
category: customer-portal
audience: public
apps: [customer]
roles: [customer]
version: '0.7'
reviewed: '2026-11-15'
owner: Customer Portal
description: Open a request, read its progress and messages, then confirm the fix or ask for it to be reopened.
routes: [/requests/:id]
screenshots: [phase7-05-customer-resolved.png]
diagrams: [wf-42]
related: [customer.requests, customer.updates, cases.customer-requests]
sources:
  - apps/customer-web/src/App.tsx
  - apps/admin-web/src/management/customerStore.ts
keywords: ["confirm", "Yes, confirm", "No, ask to reopen", "What is still wrong?", "Messages", "Progress", "resolved", "message limit"]
---

When the facility team finishes the work, the request becomes *Resolved* and appears in **To
confirm** on Overview. Please check the work and tell the team whether it is fixed.

## Steps

1. Open the request from **Requests** or the **To confirm** tile.
2. Read the **Progress** timeline and the team's **Messages**.
3. If the problem is fixed, select **Yes, confirm**. You see *Thank you for confirming*.
4. If it is not fixed, select **No, ask to reopen**, write **What is still wrong?** and select
   **Ask to reopen**.
5. At any time you can add a message (up to 500 characters) and select **Send**.

![A resolved request waiting for confirmation](screens/phase7-05-customer-resolved.png)

{{diagram wf-42}}

## Expected result

- Confirmed: the request shows *You confirmed the resolution on …* and moves to **Service history**.
- Reopen: the status becomes *Reopen requested* and the team is told.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Write a message.* | The message is empty. | Write the reason or message. |
| *This request has reached its message limit.* | A request holds at most 30 messages. | Contact your facility team directly, or raise a new request if it is a new problem. |

## Troubleshooting

- You do not see the team's internal notes or who did the work — only progress and replies meant
  for you.
