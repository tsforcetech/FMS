---
id: train.report-ac
title: 'क्विक स्टार्ट: एयर कंडीशनिंग की समस्या रिपोर्ट करें'
module: Training & Quick Starts
category: maintenance
audience: public
apps: [staff, mobile]
roles: [technician, staff, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: Staff ऐप से खराब AC (या कोई भी खराबी) रिपोर्ट करें और मरम्मत के लिए वर्क ऑर्डर माँगें।
routes: [/report]
screenshots: [phase5-08-report-issue.png, phase5-09-issue-confirmation.png]
diagrams: [wf-33, wf-32]
related: [staff.report-issue, cases.reported-issues, maintenance.work-orders, train.work-order]
sources:
  - apps/staff-web/src/screens/Issues.tsx
  - apps/staff-web/src/i18n.tsx
  - packages/shared/src/cases.ts
keywords: [AC not cooling, air conditioning, leak, fault, report problem, Also request a repair (work order), Send report, AC ठंडा नहीं कर रहा, एयर कंडीशनिंग, रिसाव, खराबी, समस्या बताएं, रिपोर्ट भेजें]
translationOf: train.report-ac
translatedFrom: '2026-11-15'
translationStatus: draft
---

1. **रिपोर्ट** पर टैप करें (या किसी काम के अंदर **समस्या बताएं** पर)।
2. **समस्या रिपोर्ट करें** फ़ॉर्म खुलता है।
3. **Problem type** (समस्या का प्रकार) के नीचे **HVAC** पर टैप करें (दूसरे विकल्पों में *Electrical* (बिजली),
   *Plumbing* (प्लंबिंग), *Cleaning* (सफ़ाई), *Security* (सुरक्षा) और *Other* (अन्य) शामिल हैं)।
4. **Site** (साइट), **Location** (जगह) और, अगर आपको पता हो, तो **Asset** (उपकरण — AC यूनिट) चुनें।
5. **How serious?** (कितना गंभीर?) में *Needs attention* (ध्यान देने की ज़रूरत) या *Urgent / unsafe*
   (अत्यावश्यक / असुरक्षित) चुनें (बिजली के सामान के पास पानी हो तो यह अत्यावश्यक है)।
6. **समस्या क्या है?** में इसके बारे में लिखें — जैसे "कमरा 204 का AC गर्म हवा दे रहा है, पानी टपक रहा है"।
7. **Also request a repair (work order)** (मरम्मत भी माँगें — वर्क ऑर्डर) पर टिक करें, ताकि मेंटेनेंस टीम
   को तुरंत काम मिल जाए।
8. **रिपोर्ट भेजें** पर टैप करें।
9. *Problem reported* (समस्या रिपोर्ट हो गई) स्क्रीन पर **Reference number** (रेफ़रेंस नंबर) नोट कर लें।
   **My reported problems** (मेरी रिपोर्ट की गई समस्याएँ) में इसकी स्थिति देखते रहें।

![समस्या रिपोर्ट करने का फ़ॉर्म](screens/phase5-08-report-issue.png)

![रेफ़रेंस नंबर के साथ पुष्टि](screens/phase5-09-issue-confirmation.png)

पूरी गाइड: [समस्या रिपोर्ट करें](article:staff.report-issue)।
