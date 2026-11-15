---
id: train.report-ac
title: 'ക്വിക്ക് സ്റ്റാർട്ട്: എയർ കണ്ടീഷനിങ് പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക'
module: Training & Quick Starts
category: maintenance
audience: public
apps: [staff, mobile]
roles: [technician, staff, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: കേടായ AC (അല്ലെങ്കിൽ ഏതെങ്കിലും തകരാർ) Staff ആപ്പിൽ നിന്ന് റിപ്പോർട്ട് ചെയ്ത് ഒരു റിപ്പയർ വർക്ക് ഓർഡർ ആവശ്യപ്പെടുക.
routes: [/report]
screenshots: [phase5-08-report-issue.png, phase5-09-issue-confirmation.png]
diagrams: [wf-33, wf-32]
related: [staff.report-issue, cases.reported-issues, maintenance.work-orders, train.work-order]
sources:
  - apps/staff-web/src/screens/Issues.tsx
  - apps/staff-web/src/i18n.tsx
  - packages/shared/src/cases.ts
keywords: [AC not cooling, air conditioning, leak, fault, report problem, Also request a repair (work order), Send report, AC തണുപ്പിക്കുന്നില്ല, എയർ കണ്ടീഷനിങ്, ചോർച്ച, തകരാർ, പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക, റിപ്പോർട്ട് അയയ്ക്കുക]
translationOf: train.report-ac
translatedFrom: '2026-11-15'
translationStatus: draft
---

1. **റിപ്പോർട്ട്** ടാപ്പ് ചെയ്യുക (അല്ലെങ്കിൽ ഒരു ജോലിക്കുള്ളിലെ **പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക**).
2. **ഒരു പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക** ഫോം തുറക്കും.
3. **Problem type** (പ്രശ്നത്തിന്റെ തരം) എന്നതിന് താഴെ **HVAC** ടാപ്പ് ചെയ്യുക (മറ്റ് തിരഞ്ഞെടുപ്പുകളിൽ
   *Electrical* (ഇലക്ട്രിക്കൽ), *Plumbing* (പ്ലംബിങ്), *Cleaning* (ശുചീകരണം), *Security* (സുരക്ഷ),
   *Other* (മറ്റുള്ളവ) എന്നിവ ഉൾപ്പെടുന്നു).
4. **Site** (സൈറ്റ്), **Location** (സ്ഥലം) എന്നിവയും, അറിയാമെങ്കിൽ **Asset** (ഉപകരണം — AC യൂണിറ്റ്) എന്നതും
   തിരഞ്ഞെടുക്കുക.
5. **How serious?** (എത്ര ഗുരുതരം?) എന്നതിൽ *Needs attention* (ശ്രദ്ധ ആവശ്യമാണ്) അല്ലെങ്കിൽ
   *Urgent / unsafe* (അടിയന്തരം / സുരക്ഷിതമല്ല) തിരഞ്ഞെടുക്കുക (വൈദ്യുതി ഉപകരണങ്ങൾക്ക് അടുത്ത് വെള്ളം ഉണ്ടെങ്കിൽ
   അത് അടിയന്തരമാണ്).
6. **എന്താണ് പ്രശ്നം?** എന്നതിൽ അത് വിവരിക്കുക — ഉദാഹരണത്തിന് "റൂം 204-ലെ AC ചൂടുള്ള കാറ്റ് പുറത്തുവിടുന്നു,
   വെള്ളം ഇറ്റുന്നു".
7. മെയിന്റനൻസ് ടീമിന് ഉടൻ തന്നെ ഒരു ജോലി ലഭിക്കാൻ **Also request a repair (work order)**
   (ഒരു റിപ്പയറും ആവശ്യപ്പെടുക — വർക്ക് ഓർഡർ) ടിക്ക് ചെയ്യുക.
8. **റിപ്പോർട്ട് അയയ്ക്കുക** ടാപ്പ് ചെയ്യുക.
9. *Problem reported* (പ്രശ്നം റിപ്പോർട്ട് ചെയ്തു) എന്ന സ്ക്രീനിലെ **Reference number** (റഫറൻസ് നമ്പർ)
   കുറിച്ചുവെക്കുക. **My reported problems** (ഞാൻ റിപ്പോർട്ട് ചെയ്ത പ്രശ്നങ്ങൾ) എന്നതിൽ അത് പിന്തുടരുക.

![ഒരു പ്രശ്നം റിപ്പോർട്ട് ചെയ്യാനുള്ള ഫോം](screens/phase5-08-report-issue.png)

![റഫറൻസ് നമ്പറോടുകൂടിയ സ്ഥിരീകരണം](screens/phase5-09-issue-confirmation.png)

പൂർണ്ണ ഗൈഡ്: [ഒരു പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക](article:staff.report-issue).
