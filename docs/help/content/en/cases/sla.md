---
id: cases.sla
title: Set SLA policies and monitor service levels
module: Complaints & Escalations
category: maintenance
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.4'
reviewed: '2026-11-15'
owner: Service Operations
description: Define response and resolution targets by priority, site and department, and watch breached and at-risk work orders, complaints and escalations.
routes: [/sla, /sla-policies]
permissions:
  - Company owner or admin
screenshots: [phase7-06-admin-sla-report.png]
diagrams: [wf-35]
related: [maintenance.work-orders, cases.complaints, cases.escalations, reports.sla, sites.create, people.leave, scheduling.generation]
sources:
  - packages/shared/src/schedule.ts
  - packages/shared/src/operations.ts
  - apps/admin-web/src/management/Cases.tsx
  - apps/admin-web/src/management/casesStore.ts
  - apps/admin-web/src/management/scheduling.ts
keywords: [SLA, service level, response target, resolution target, breached, at risk, business hours, calendar hours, SLA policy, No SLA]
---

Service levels apply to **work orders**, **complaints** and **escalations**. When one of these is
created, FacilityOS finds the matching **SLA policy**, calculates the **response** and **resolution**
due times and **stores them on the record**. Changing a policy later does not change records that
already exist.

## Before you start

- For business-hours targets, set the site's working days and opening hours and the company holidays.

## Steps

### Create SLA policies

1. Open **Issues & escalations → SLA policies** and select **Add SLA policy**.
2. Under **Targets**, choose:
   - **Priority** — *critical*, *high*, *medium* or *low*;
   - **Applies to** — *all*, *work orders*, *complaints* or *escalations*;
   - **Response target (minutes)** and **Resolution target (minutes)**;
   - **Clock** — *calendar* (every minute counts) or *business* ("Business hours follow the site
     working days and opening hours, skipping holidays").
3. Under **Scope**, optionally choose a **Site** and/or **Department**. Leave them empty for every site
   or department.
4. Save. Create one policy per priority at least.

**Which policy wins:** for the record's priority and type, the most specific active policy is used —
site **and** department, then site, then department, then company-wide. A policy for the specific
record type beats one for *all*.

### Monitor service levels

1. Open **Issues & escalations → SLA monitoring**.
2. **Service levels** shows open work orders, complaints and escalations, how many are **Breached** and
   how many are **Due within 8 hours**.
3. **Breached** lists open items past their resolution target; **At risk** lists items due in the next 8
   hours. Open an item to assign or escalate it.

![SLA performance report with response and resolution breaches](screens/phase7-06-admin-sla-report.png)

{{diagram wf-35}}

## Expected result

- Each case shows its **Response target**, **Resolution target** and an SLA tag (*Breached Nh* when
  late). A case created when no policy matches shows *No SLA*.
- The first review, assignment, start or resolution records the response time.
- When the scheduler runs, admins receive one *SLA breach* in-app notification per breached record.

## How breach is decided

A record is **breached** only when it is still open after its stored resolution target. Response is
breached when the first response came after the response target. The
[SLA performance report](article:reports.sla) measures both against the stored targets.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *No SLA* on a record | No active policy matched its priority, type, site and department. | Add a company-wide policy for that priority. New records will get targets. |
| Targets look too long at weekends | The policy uses the *business* clock. | Expected: business minutes skip non-working days and holidays. |

## Troubleshooting

- **No breach notifications:** they are sent by the scheduler. Check **Scheduler monitor** (see
  [How tasks are generated](article:scheduling.generation)).
- **Need different targets for one client site:** add a policy scoped to that site; it wins over the
  company-wide one for new records.
