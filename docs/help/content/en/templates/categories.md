---
id: templates.categories
title: Organise templates with task categories
module: Task Templates
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.3'
reviewed: '2026-11-15'
owner: Task Management
description: Create task categories and one level of subcategories, each with an optional responsible department.
routes: [/task-categories]
permissions:
  - Company owner or admin
screenshots: [phase4-06-template-builder.png]
diagrams: [wf-21]
related: [templates.builder, people.departments, reports.tasks, import.templates]
sources:
  - packages/shared/src/operations.ts
  - apps/admin-web/src/management/Records.tsx
keywords: [category, subcategory, housekeeping, HVAC inspection, fire and safety, parent category, archive category]
---

**Task categories** group your templates — for example *Housekeeping*, *HVAC inspection* or *Fire &
safety*. One level of subcategories is supported (for example *Housekeeping → Washrooms*). A category
can name the **Responsible department** that normally owns that kind of work.

## Before you start

- Create your departments first if you want to link them (see [Departments](article:people.departments)).
- A starter pack in the setup wizard may already have created common categories.

## Steps

1. Open **Task management → Task categories** and select **Add task category**.
2. Enter the **Name** (and code, if your company uses codes).
3. To create a subcategory, choose a top-level **Parent category**. Leave it empty for a top-level
   category.
4. Optionally choose the **Responsible department** and add a **Description**.
5. Select **Save task category**.
6. When you create a template, choose this category in **Category** on the template record.

![Template builder; the category is chosen on the template record](screens/phase4-06-template-builder.png)

{{diagram wf-21}}

## Expected result

The category appears in the list and can be chosen on task templates. Reports can then be read per
template and category.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| The parent list does not offer a subcategory | Only one level of subcategories is allowed. | Choose a top-level category as the parent. |
| Cannot archive the category | Templates or subcategories still reference it. | Archive or move those first — records still linked must be archived or reassigned. |

## Troubleshooting

- **Many categories to create:** use the Import Center with the task template workbook (see
  [Import templates](article:import.templates)).
- **Renaming a category** does not change any task already created; tasks keep a snapshot of their
  template version.
