---
id: role.housekeeping
title: 'Role guide: Housekeeping staff'
module: Role Guides
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [staff]
version: '0.8'
reviewed: '2026-11-15'
owner: Customer Success
description: How cleaners and housekeeping attendants find their cleaning tasks, complete checklists, report problems and get help.
routes: ['/', /tasks, /report]
prerequisites:
  - A login with role Staff, linked to your employee record
screenshots: [phase5-04-my-day.png, phase5-06-checklist-step.png, phase5-14-arabic-rtl.png]
diagrams: [wf-26, wf-27, wf-28, wf-30, wf-36]
related: [train.first-task, train.first-checklist, staff.my-day, staff.rework, mobile.language, train.report-ac]
sources:
  - apps/admin-web/src/management/staffStore.ts
  - apps/staff-web/src/i18n.tsx
  - packages/shared/src/cases.ts
keywords: [housekeeping, cleaner, cleaning, janitor, attendant, room cleaning, toilet check]
---

Housekeeping attendants use the role **Staff** (`staff` — *Staff (housekeeping, security, general)*).
"Housekeeping" is your job title; the app permissions are the same as other staff. You use the
**FacilityOS Staff** web app or the **mobile app**, in English, Malayalam, Hindi or Arabic.

## What you can access

- **Home** (My Day), **My tasks**, **Report**, **Alerts**, **Profile**, and under **More**: calendar,
  your work orders, your reported problems and history.
- Mobile: QR scanning, photos, attendance, offline work.
- You cannot see other people's tasks, approvals or the admin app.

## Responsibilities

- Clean to the checklist, on time.
- Answer every question truthfully and add photos when asked.
- Report problems you see (leaks, broken fittings, pests, missing supplies).

## Daily routine

1. **Check in** (mobile) and open **Home** — your cleaning rounds are listed by time.
2. For each round: **Start task** → **Open checklist** → answer → **Review answers** → submit
   ([Quick start](article:train.first-task)).
3. Problem found? Tap **Report**, choose *Cleaning*, *Plumbing*, *Pest control* or another type,
   describe it and send ([Report a problem](article:staff.report-issue)).
4. Work returned? Open it, read **Reason from your supervisor**, tap **Start correction**
   ([Rework](article:staff.rework)).
5. **Check out** at the end of the shift.

![My Day](screens/phase5-04-my-day.png)

![A checklist question](screens/phase5-06-checklist-step.png)

![The Staff app in Arabic](screens/phase5-14-arabic-rtl.png)

## Escalation

Tell your supervisor (in person or by phone) when: you cannot enter a room, supplies are missing,
something is unsafe, or a task in the app is wrong. Supplies and stock are issued by your supervisor or
admin — the Staff app does not post stock.

## FAQs

- **I see "Your login is not linked to an employee yet".** Ask your supervisor or admin to link it
  ([Not linked](article:ts.not-linked)).
- **How do I change language?** **Profile → Language** ([Language](article:mobile.language)).
- **I have no tasks today.** Check with your supervisor — you may be on leave or the schedule has not
  run ([No tasks](article:ts.no-tasks)).
