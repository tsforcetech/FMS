---
id: templates.raci
title: Set RACI responsibilities on a template
module: Task Templates
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.3'
reviewed: '2026-11-15'
owner: Task Management
description: Record who is Responsible, Accountable, Consulted and Informed for a kind of work, by designation, department, team or employee.
routes: [/task-templates]
permissions:
  - Company owner or admin
screenshots: [phase4-06-template-builder.png]
diagrams: [wf-23]
related: [templates.builder, templates.publish, tasks.approvals, ref.raci-matrix]
sources:
  - apps/admin-web/src/management/TemplateBuilder.tsx
  - packages/shared/src/tasks.ts
keywords: [RACI, responsible, accountable, consulted, informed, responsibility matrix, Accountable owner]
---

The **Responsibilities** step of the template builder records a RACI matrix for the work:

- **R · Responsible** — does the work;
- **A · Accountable** — owns the result and signs it off;
- **C · Consulted** — gives input;
- **I · Informed** — is kept up to date.

Each entry points to a **designation**, **department**, **team** or **employee**, optionally limited
to one **site**.

> **Note:** RACI describes responsibility, not access. Approval rights are always checked against
> company membership and security rules, so naming someone *Accountable* does not let them approve.
> Every approval-required template needs one Accountable owner. The task keeps a snapshot of this
> matrix when it is created.

## Steps

1. Open the template's draft and go to **Responsibilities**.
2. Select **Add responsibility** (up to 30 entries).
3. Choose the **Responsibility** letter, the kind (designation, department, team or employee) and the
   record. Optionally choose a site to limit the entry to that site.
4. Repeat for each party. The matrix at the top counts entries per letter (*None* when empty).
5. Save the draft and [publish](article:templates.publish) it.

![Template builder; RACI is set on the Responsibilities step](screens/phase4-06-template-builder.png)

{{diagram wf-23}}

## Expected result

Each task created from the published version shows the matrix on its **Template & RACI** tab.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *Choose who each responsibility applies to.* | An entry has no record selected. | Choose the designation, department, team or employee, or remove the entry. |
| *Name at least one Responsible party* | No **R** entry. | Add one. |
| *Name an Accountable owner for approval* | Approval is required but no **A** entry exists. | Add one. |

## Troubleshooting

- **Changing RACI** requires a new version; existing tasks keep their snapshot.
- See the [RACI matrix reference](article:ref.raci-matrix) for typical responsibilities by role.
