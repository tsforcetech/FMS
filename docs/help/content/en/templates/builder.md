---
id: templates.builder
title: Build a checklist template
module: Task Templates
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.3'
reviewed: '2026-11-15'
owner: Task Management
description: Create a task template and build its checklist — sections, question types, limits, conditions and evidence — as a draft version.
routes: [/task-templates]
permissions:
  - Company owner or admin
screenshots: [phase4-06-template-builder.png, admin-task-templates.png]
diagrams: [wf-21]
related:
  [
    templates.categories,
    templates.publish,
    templates.raci,
    tasks.execution,
    train.first-checklist,
    scheduling.recurring,
  ]
sources:
  - apps/admin-web/src/management/TemplateBuilder.tsx
  - apps/admin-web/src/management/tasksStore.ts
  - packages/shared/src/tasks.ts
  - packages/shared/src/operations.ts
keywords:
  [
    checklist builder,
    question,
    answer type,
    section,
    conditional question,
    show only when,
    expected range,
    critical limits,
    escalate on failure,
    evidence,
    draft,
    This template already has a draft,
  ]
---

A **task template** describes a kind of work once — for example _Daily AC inspection_ — so that every
task created from it asks the same questions. The checklist is built as a **version**: you edit a
**draft**, then publish it. Published versions never change.

![The Task management → Task templates screen](screens/admin-task-templates.png)

## Before you start

- Create the [task category](article:templates.categories) and the responsible department.
- Decide which readings need limits (for example supply-air temperature 12–18 °C).

## Steps

1. Open **Task management → Task templates** and select **Add task template**. Enter the name and
   choose the **Category**, **Responsible department**, **Default priority** and an optional
   **Description**. Save it.
2. Open the template and go to the **Checklist & versions** tab. Select **Build the checklist** (or
   **New draft from vN** if versions already exist).
3. **Template information** — set the title, **Estimated duration (minutes)**, **Priority**,
   **Instructions for staff**, whether **Approval required** is on, and (optional) the **Applicable
   site types**, **facility types** and **asset categories**.
4. **Checklist** — add questions, grouped into sections (**New section**, move or remove sections).
   For each question set:
   - the **label** (required) and optional **Help text**;
   - the **Answer type** — _Yes / No_, _Pass / Fail_, _Single choice_, _Multiple choice_, _Whole
     number_, _Decimal number_, _Temperature_, _Reading with unit_, _Short text_, _Long text_, _Date_,
     _Time_, _Asset condition_, _Photo evidence_, _QR verification_ or _GPS location_;
   - **Required**;
   - for choices: up to 20 **Choices** (no `|` character);
   - for numbers: **Unit**, **Minimum/Maximum allowed** (values outside are refused), **Expected
     from/to** and **Critical below/above** (values outside are accepted but raise an exception);
   - **Show only when** — show the question only when another question (**Condition question**) has a
     given answer;
   - **Escalate on failure** — raise a failed or out-of-range answer as critical instead of a warning.
5. **Evidence** — choose per question whether photo, QR or GPS proof is wanted (see the note below).
6. **Responsibilities** — build the RACI matrix (see [RACI responsibilities](article:templates.raci)).
7. **Assignment defaults** — choose **Assign by** (_Choose per task_, employee, department, team,
   shift or site) to pre-fill assignees when a task is created.
8. Use the **staff checklist preview** to check what staff will see, then **Save draft**
   (_Draft saved._).

![Template builder with sections, question types and limits](screens/phase4-06-template-builder.png)

{{diagram wf-21}}

> **Note:** Photo upload, QR and GPS proof are captured by the mobile app. A photo, QR or GPS
> question cannot be made _required_ until file storage and the mobile app are available — publishing
> shows _… cannot be required until file storage/the mobile app is available_.

## Expected result

A draft version exists with your questions. Tasks cannot use it until you
[publish it](article:templates.publish).

## Common errors

| Message                                                        | Why                                             | What to do                                         |
| -------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| _This template already has a draft. Edit or publish it first._ | Only one draft at a time.                       | Select **Continue editing** on the existing draft. |
| _This draft changed. Reload before saving._                    | Someone else saved the same draft.              | Reload, then repeat your change.                   |
| _Published versions cannot be edited. Create a new draft._     | The version was published.                      | Use **New draft from vN**.                         |
| _A question cannot depend on itself_                           | **Show only when** points to the same question. | Choose another condition question.                 |
| _Conditional questions form a loop: …_                         | Two or more questions depend on each other.     | Break the loop.                                    |

## Troubleshooting

- **Allowed vs expected vs critical:** use _allowed_ for physically impossible values, _expected_ for
  normal operating range and _critical_ for values that need immediate action.
- **Leaving with unsaved changes** asks _Discard unsaved changes?_ — choose **Discard changes** only if
  you meant to.
- **Assignment defaults** only pre-fill tasks created by hand; recurring schedules assign
  automatically with their own strategy (see [Assignment strategies](article:scheduling.assignment)).
