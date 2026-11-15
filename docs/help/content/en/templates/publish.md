---
id: templates.publish
title: Publish, update and retire checklist versions
module: Task Templates
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.3'
reviewed: '2026-11-15'
owner: Task Management
description: Publish a draft so tasks and schedules can use it, change a live checklist safely with a new version, and retire old versions.
routes: [/task-templates]
prerequisites:
  - A template with a saved draft
permissions:
  - Company owner or admin
screenshots: [phase4-06-template-builder.png, admin-task-templates.png]
diagrams: [wf-22]
related:
  [
    templates.builder,
    templates.raci,
    scheduling.recurring,
    scheduling.changes,
    tasks.register,
  ]
sources:
  - apps/admin-web/src/management/TemplateBuilder.tsx
  - apps/admin-web/src/management/tasksStore.ts
  - apps/admin-web/src/management/scheduling.ts
  - packages/shared/src/tasks.ts
keywords:
  [
    publish,
    version,
    retire,
    new draft,
    read-only,
    Add at least one question,
    Name an Accountable owner for approval,
    Name at least one Responsible party,
    The template version is no longer published,
  ]
---

Publishing turns a draft into a **read-only version** that new tasks and schedules can use. To change
a checklist later you copy it into a new draft and publish that — tasks already created keep the
exact version they were created with.

![The Task management → Task templates screen](screens/admin-task-templates.png)

## Before you start

- The draft must have at least one question.
- At least one **R · Responsible** entry is needed, and if **Approval required** is on, exactly one
  **A · Accountable** owner (see [RACI responsibilities](article:templates.raci)).

## Steps

### Publish a draft

1. Open the template → **Checklist & versions** → open the draft.
2. Go to **Review & publish**. Fix anything listed there; the publish button stays disabled until the
   list is empty.
3. Select **Publish version N** and confirm _Publish version N?_ — "This version becomes read-only and
   available for new tasks."
4. The toast _Version N published._ appears and the versions list shows _Version N is live for new
   tasks._

![Template builder at the review and publish step](screens/phase4-06-template-builder.png)

{{diagram wf-22}}

### Change a published checklist

1. On **Checklist & versions** select **New draft from vN**.
2. Make your changes and publish the new version.
3. New tasks created from the template use the new version. Existing tasks are unchanged.

### Retire a version

Select **Retire** next to the published version and confirm _Retire version N?_ — "New tasks will no
longer use it. Existing tasks keep their copy, and the version stays available for audit."

> **Warning:** Recurring schedules point to a specific version. If you retire the version a schedule
> uses, its next scheduler run fails with _The template version is no longer published. Edit the
> schedule and choose a published version._ Edit the schedule and pick the template again so it takes
> the current published version (see [Change a schedule](article:scheduling.changes)).

## Expected result

The template shows _Version N is live for new tasks._ and appears in **New task** and **New recurring
task**. Without any published version it shows _No published version yet — tasks cannot use this
template._

## Common errors

| Message                                                               | Why                                                      | What to do                                           |
| --------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| _Add at least one question_                                           | The checklist is empty.                                  | Add questions.                                       |
| _Name at least one Responsible party_                                 | No **R** entry in the RACI matrix.                       | Add one under **Responsibilities**.                  |
| _Name an Accountable owner for approval_                              | **Approval required** is on but there is no **A** entry. | Add one Accountable owner, or switch approval off.   |
| _… cannot be required until file storage/the mobile app is available_ | A photo, QR or GPS question is required.                 | Untick **Required** for that question.               |
| _Only the current published version can be retired._                  | The version is not published, or changed meanwhile.      | Reload the list.                                     |
| _Choose a published template version._                                | A task or schedule refers to a draft or retired version. | Publish the template, or choose the current version. |

## Troubleshooting

- **A small typo in a live checklist:** you still need a new version; published versions never change,
  so audits always show exactly what staff answered.
