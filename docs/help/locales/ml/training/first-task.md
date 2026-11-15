---
id: train.first-task
title: 'ക്വിക്ക് സ്റ്റാർട്ട്: നിങ്ങളുടെ ആദ്യ ജോലി പൂർത്തിയാക്കുക'
module: Training & Quick Starts
category: getting-started
audience: public
apps: [staff, mobile]
roles: [technician, staff, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: FacilityOS Staff ആപ്പിൽ സൈൻ ഇൻ ചെയ്യുന്നത് മുതൽ ഒരു ജോലി പൂർത്തിയാക്കുന്നത് വരെയുള്ള പത്ത് ഘട്ടങ്ങൾ.
routes: ['/', '/task/:id']
prerequisites:
  - ഒരു അഡ്മിനിസ്ട്രേറ്റർ നിങ്ങളുടെ ലോഗിൻ നിങ്ങളുടെ ജീവനക്കാരുടെ രേഖയുമായി ബന്ധിപ്പിച്ചിട്ടുണ്ട്
screenshots: [phase5-04-my-day.png, phase5-05-task-detail.png]
diagrams: [wf-36]
related: [staff.my-day, staff.tasks, staff.checklist, train.first-checklist, staff.sign-in]
sources:
  - apps/staff-web/src/screens/MyDay.tsx
  - apps/staff-web/src/screens/TaskView.tsx
  - apps/staff-web/src/i18n.tsx
keywords: [first day, how to start, Start task, Mark as completed, My Day, ആദ്യ ദിവസം, എങ്ങനെ തുടങ്ങാം, ജോലി ആരംഭിക്കുക, പൂർത്തിയായതായി അടയാളപ്പെടുത്തുക, ഹോം]
translationOf: train.first-task
translatedFrom: '2026-11-15'
translationStatus: draft
---

1. FacilityOS Staff ആപ്പ് തുറന്ന്, നിങ്ങളുടെ സൂപ്പർവൈസർ തന്ന ഇമെയിലും പാസ്‌വേഡും ഉപയോഗിച്ച് സൈൻ ഇൻ ചെയ്യുക.
2. **ഹോം** (My Day — എന്റെ ദിവസം) സ്ക്രീനിൽ ഇന്നത്തെ ജോലികൾ കാണാം. അവ ചെയ്തുതീർക്കേണ്ട സമയത്തിന്റെ ക്രമത്തിലാണ്.
3. ഒരു ജോലി തുറക്കാൻ അതിൽ ടാപ്പ് ചെയ്യുക. **Instructions** (നിർദ്ദേശങ്ങൾ), **Location** (സ്ഥലം),
   **Due** (അവസാന സമയം) എന്നിവ വായിക്കുക.
4. ജോലി തുടങ്ങുമ്പോൾ **ജോലി ആരംഭിക്കുക** ടാപ്പ് ചെയ്യുക.
5. **Open checklist** (ചെക്ക്‌ലിസ്റ്റ് തുറക്കുക) ടാപ്പ് ചെയ്ത് ഓരോ ചോദ്യത്തിനും ഉത്തരം നൽകുക
   ([നിങ്ങളുടെ ആദ്യ ചെക്ക്‌ലിസ്റ്റ്](article:train.first-checklist) കാണുക).
6. ഇടവേള വേണോ? **നിർത്തുക** ടാപ്പ് ചെയ്യുക, പിന്നീട് **തുടരുക** ടാപ്പ് ചെയ്യുക.
7. **ഉത്തരങ്ങൾ പരിശോധിക്കുക** ടാപ്പ് ചെയ്ത്, ഹൈലൈറ്റ് ചെയ്ത എന്തും തിരുത്തുക.
8. **അംഗീകാരത്തിനായി സമർപ്പിക്കുക** (നിങ്ങളുടെ സൂപ്പർവൈസർ ഇത് പരിശോധിക്കേണ്ടതാണെങ്കിൽ) അല്ലെങ്കിൽ
   **പൂർത്തിയായതായി അടയാളപ്പെടുത്തുക** ടാപ്പ് ചെയ്യുക.
9. *Submitted. Your supervisor will review it.* (സമർപ്പിച്ചു. നിങ്ങളുടെ സൂപ്പർവൈസർ ഇത് പരിശോധിക്കും.) അല്ലെങ്കിൽ
   *Task completed.* (ജോലി പൂർത്തിയായി.) എന്ന സന്ദേശം കാണാം.
10. പിന്നീട് **അറിയിപ്പുകൾ** പരിശോധിക്കുക — ജോലി തിരികെ നൽകിയാൽ *തിരുത്താനായി തിരികെ നൽകി* എന്ന് കാണാം.

![ഇന്നത്തെ ജോലികളുള്ള ഹോം സ്ക്രീൻ (My Day)](screens/phase5-04-my-day.png)

![ജോലി ആരംഭിക്കുക ബട്ടണുള്ള ജോലിയുടെ വിശദാംശങ്ങൾ](screens/phase5-05-task-detail.png)

പൂർണ്ണ ഗൈഡ്: [ഒരു ജോലി ചെയ്യുക](article:staff.tasks).
