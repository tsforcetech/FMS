---
id: setup.audit
title: Review the audit history
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Security
description: See who changed tasks, work orders, complaints, escalations, stock and asset locations, and when — and understand how the history is protected.
routes: [/audit]
permissions:
  - Company owner or admin
screenshots: [admin-audit.png]
related: [setup.retention, setup.operations, tasks.history, inventory.movements, assets.transfer]
sources:
  - apps/admin-web/src/management/Operations.tsx
  - apps/admin-web/src/management/reportsStore.ts
  - firebase/firestore.rules
keywords: [audit, audit trail, history, who changed, events, append-only, tamper, stock movements, asset transfers]
---

**Administration → Audit history** brings together the event histories that FacilityOS writes
whenever important records change: task events, work order / complaint / escalation events,
stock movements and asset transfers.

## Before you start

Events are written in the same transaction as the change itself, so every recorded change has an
event. Master-data edits (for example renaming a site) are not part of this page.

## Steps

1. Open **Administration → Audit history**.
2. Choose the **Period**: **24 hours**, **7 days** or **30 days**.
3. Choose the source: **All events**, **Tasks**, **Work orders, complaints, escalations**,
   **Stock movements** or **Asset transfers**.
4. Read the table: **When**, **Source**, **Action**, **Record**, **Detail** and **By**.
5. Use **Export** to save the list to Excel or PDF if you need to keep it outside FacilityOS.

![Audit history](screens/admin-audit.png)

## Expected result

You see the most recent events for the chosen period and source (up to the latest 300 events),
newest first.

> **Note:** The banner **How this history is protected** explains the limits: the security rules
> let the apps create events but never edit or delete them. That is append-only protection by
> access rules — not a cryptographically tamper-evident ledger, and a project owner with server
> access could still alter data.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *No events in this period* | Nothing of that source happened in the period. | Choose a longer period or **All events**. |
| *This view is still being prepared by the database. Please try again in a few minutes.* | A database index needed for the query is still building. | Wait a few minutes and reload. See [Index pending](article:ts.index-pending). |

## Troubleshooting

- **I need older events:** open the record itself — task history, the asset's movement history or
  the stock ledger keep all their events. See [Task history](article:tasks.history).
- **How long is history kept?** The company policy is set in
  [Data retention](article:setup.retention); audit history must be kept for at least one year.
