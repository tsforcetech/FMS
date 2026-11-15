---
id: tasks.dashboard
title: Read the task dashboard
module: Task Management
category: daily-tasks
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.3'
reviewed: '2026-11-15'
owner: Task Management
description: See today's task counts, overdue work, submissions waiting for review, open issues and recent activity on one page.
routes: [/task-dashboard]
permissions:
  - Company owner or admin
screenshots: [phase4-09-task-dashboard.png]
related: [tasks.register, tasks.approvals, tasks.assignments, cases.reported-issues, tasks.history, reports.dashboard]
sources:
  - apps/admin-web/src/management/Tasks.tsx
  - packages/shared/src/tasks.ts
keywords: [overview, overdue, awaiting approval, open issues, recent activity, today]
---

The **task dashboard** is the starting point for whoever runs daily operations. It shows how many
tasks are in each state and lists the few items that need someone's attention now.

## Before you start

- You need the company **owner** or **admin** role to open the admin app.
- The dashboard only shows tasks that exist. Recurring tasks appear after the scheduler has run (see
  [How tasks are generated](article:scheduling.generation)).

## Steps

1. Open **Task management → Task dashboard**.
2. Read the counters at the top. They count tasks by status (for example pending, assigned, in
   progress, awaiting approval, completed).
3. Review the four lists below the counters:
   - **Overdue** — up to five open tasks whose due time has passed. A task is overdue when its due
     time is in the past and it is not completed, rejected or cancelled.
   - **Awaiting approval** — up to five submissions waiting for a reviewer.
   - **Open issues** — up to five issues raised from checklists (failed checks, out-of-range readings,
     damage) that nobody has closed yet.
   - **Recent activity** — the last six actions recorded on tasks (created, assigned, started,
     submitted, approved and so on).
4. Select any item to open the task, or follow the link to the full list:
   **Task register**, **Pending approvals** or **Reported issues**.

![Task dashboard with counters, overdue tasks, approvals and recent activity](screens/phase4-09-task-dashboard.png)

## Expected result

You can see at a glance which tasks are late, which submissions are waiting for review and which
problems were found during work, and open each one directly.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| All counters are zero | No tasks have been created or generated yet. | Create a task from the [Task register](article:tasks.register) or run the scheduler. |
| A task you expected is not in **Overdue** | The list shows at most five items, or the task is awaiting approval, completed or cancelled. | Open the **Task register** and filter by status. |

## Troubleshooting

- **The numbers look out of date:** the page reads data when it opens. Use the refresh button or
  reload the page.
- **A submission waits for a long time:** reviewers cannot approve their own work. Ask another owner,
  admin or site supervisor to review it (see [Approve or return submitted work](article:tasks.approvals)).
- **For trends over a period** (on-time rate, rework, completion by site) use the
  [management dashboard and reports](article:reports.dashboard) instead.
