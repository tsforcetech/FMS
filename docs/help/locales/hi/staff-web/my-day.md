---
id: staff.my-day
title: होम स्क्रीन पर आपका दिन (My Day)
module: Staff Web
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [staff, technician, supervisor]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: आज के काम, गिनती, आपकी शिफ़्ट और शुरू करने वाला अगला काम देखें।
routes: [/]
prerequisites:
  - आप स्टाफ़ ऐप या मोबाइल ऐप में साइन इन हैं
screenshots: [phase5-04-my-day.png, staff-my-day.png, phase6-01-my-day.png]
diagrams: [wf-36]
related: [staff.tasks, staff.checklist, staff.calendar, ts.no-tasks, ts.task-overdue, mobile.tasks]
sources:
  - apps/staff-web/src/screens/MyDay.tsx
  - apps/staff-web/src/i18n.tsx
  - apps/mobile/src/screens/Main.tsx
keywords: ["home", "today", "Today's work", "Start next task", "Continue task", "No tasks for today", "overdue", "shift", "leave", "होम", "आज", "आज का काम", "अगला काम शुरू करें", "काम जारी रखें", "आज कोई काम नहीं है", "समय निकल गया", "शिफ़्ट", "छुट्टी"]
translationOf: staff.my-day
translatedFrom: '2026-11-15'
translationStatus: draft
---

**होम** पर आपका आज का सारा काम एक ही जगह दिखता है: आपके पास कितने काम हैं, अगला कौन-सा करना है,
और आपकी शिफ़्ट। स्टाफ़ वेब और मोबाइल ऐप, दोनों में साइन इन करने के बाद यही पहली स्क्रीन होती है।

## शुरू करने से पहले

- साइन इन करें ([स्टाफ़ ऐप में साइन इन करें](article:staff.sign-in) देखें)।
- काम तभी दिखते हैं जब आपका सुपरवाइज़र उन्हें आपको सौंपे या शेड्यूलर उन्हें बनाए।

## चरण

1. **होम** खोलें।
2. **Shift today** (आज की शिफ़्ट) वाली लाइन पढ़ें। इसमें आपकी शिफ़्ट, या *No shift assigned today*
   (आज कोई शिफ़्ट नहीं दी गई), *You are on approved leave today* (आज आप मंज़ूर छुट्टी पर हैं) या
   *Holiday* (छुट्टी का दिन) दिखता है।
3. **आज का काम** के नीचे की टाइलें देखें: **सौंपे गए**, **बाकी**, **जारी**, **पूरा हुआ**,
   **समय निकल गया** और **सुधार**। उससे जुड़ी सूची खोलने के लिए कोई टाइल चुनें।
4. अगला काम खोलने के लिए **अगला काम शुरू करें** चुनें। अगर आपने पहले से कोई काम शुरू किया है, तो
   बटन पर **काम जारी रखें** लिखा होगा।
5. आपके भेजे गए काम तब तक **Waiting for approval** (मंज़ूरी का इंतज़ार) के रूप में दिखते हैं, जब तक
   आपका सुपरवाइज़र उन्हें जाँच न ले।

![आज की गिनती और अगले काम के साथ होम (My Day)](screens/phase5-04-my-day.png)

{{diagram wf-36}}

## अपेक्षित परिणाम

- जब करने को कुछ नहीं होता, तो आपको **आज कोई काम नहीं है** दिखता है — *When your supervisor assigns work,
  it appears here.* (जब आपका सुपरवाइज़र काम सौंपेगा, तो वह यहाँ दिखेगा।)
- जब सब कुछ पूरा हो जाता है, तो आपको **All of today’s work is done. Well done!** (आज का सारा काम पूरा हो
  गया। शाबाश!) दिखता है।

![स्टाफ़ वेब पर होम (My Day)](screens/staff-my-day.png)

> **Tip:** मोबाइल ऐप में होम पर आपकी चेक-इन स्थिति भी दिखती है।
> [उपस्थिति](article:mobile.attendance) देखें।

![मोबाइल ऐप में होम (My Day) (Chromium रनटाइम टेस्ट, असली फ़ोन नहीं)](screens/phase6-01-my-day.png)

## आम गलतियाँ

| संदेश | क्यों | क्या करें |
| --- | --- | --- |
| *आज कोई काम नहीं है* | आज आपको कोई काम नहीं सौंपा गया है, या काम अभी तक बनाए नहीं गए हैं। | **मेरे काम → आगामी** देखें; अपने सुपरवाइज़र से पूछें। [काम नहीं दिख रहे](article:ts.no-tasks) देखें। |
| कोई काम **समय निकल गया** में है | उसका तय समय निकल चुका है और काम पूरा नहीं हुआ है। | उसे खोलें और पूरा करें; [काम का समय निकल गया](article:ts.task-overdue) देखें। |
| *You are offline…* (आप ऑफ़लाइन हैं…) | इंटरनेट कनेक्शन नहीं है। | फिर से कनेक्ट करें। मोबाइल ऐप में आपका काम डिवाइस पर सुरक्षित रहता है। |

## समस्या का समाधान

- **गिनती पुरानी लग रही है:** रीफ़्रेश करने के लिए नीचे खींचें (pull to refresh) या **होम** दोबारा खोलें।
- **किसी दूसरी साइट का काम:** आपको सिर्फ़ उन्हीं साइटों के काम दिखते हैं जो आपके अकाउंट से जुड़ी हैं;
  [गलत साइट](article:ts.wrong-site) देखें।
