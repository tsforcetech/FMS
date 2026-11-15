---
id: train.first-task
title: 'क्विक स्टार्ट: अपना पहला काम पूरा करें'
module: Training & Quick Starts
category: getting-started
audience: public
apps: [staff, mobile]
roles: [technician, staff, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: FacilityOS Staff ऐप में साइन इन करने से लेकर एक काम पूरा करने तक के दस चरण।
routes: ['/', '/task/:id']
prerequisites:
  - किसी एडमिनिस्ट्रेटर ने आपके लॉगिन को आपके कर्मचारी रिकॉर्ड से जोड़ दिया है
screenshots: [phase5-04-my-day.png, phase5-05-task-detail.png]
diagrams: [wf-36]
related:
  [
    staff.my-day,
    staff.tasks,
    staff.checklist,
    train.first-checklist,
    staff.sign-in,
  ]
sources:
  - apps/staff-web/src/screens/MyDay.tsx
  - apps/staff-web/src/screens/TaskView.tsx
  - apps/staff-web/src/i18n.tsx
keywords:
  [
    first day,
    how to start,
    Start task,
    Mark as completed,
    My Day,
    पहला दिन,
    कैसे शुरू करें,
    काम शुरू करें,
    पूरा हुआ चिह्नित करें,
    होम,
  ]
translationOf: train.first-task
translatedFrom: '2026-11-15'
translationStatus: draft
---

1. FacilityOS Staff ऐप खोलें और अपने सुपरवाइज़र से मिले ईमेल और पासवर्ड से साइन इन करें।
2. **होम** (My Day — मेरा दिन) पर आज के काम देखें। ये काम पूरा करने के समय के क्रम में दिखते हैं।
3. किसी काम को खोलने के लिए उस पर टैप करें। **Instructions** (निर्देश), **Location** (जगह) और
   **Due** (पूरा करने का समय) पढ़ें।
4. जब आप काम शुरू करें, तो **काम शुरू करें** पर टैप करें।
5. **Open checklist** (चेकलिस्ट खोलें) पर टैप करें और हर सवाल का जवाब दें
   ([आपकी पहली चेकलिस्ट](article:train.first-checklist) देखें)।
6. ब्रेक चाहिए? **रोकें** पर टैप करें, फिर बाद में **फिर से शुरू करें** पर टैप करें।
7. **उत्तर जाँचें** पर टैप करें और जो कुछ भी हाइलाइट किया गया हो, उसे ठीक करें।
8. **मंज़ूरी के लिए भेजें** (अगर आपके सुपरवाइज़र को इसे जाँचना है) या **पूरा हुआ चिह्नित करें** पर टैप करें।
9. आपको _Submitted. Your supervisor will review it._ (भेज दिया गया। आपका सुपरवाइज़र इसे जाँचेगा।) या
   _Task completed._ (काम पूरा हुआ।) दिखेगा।
10. बाद में **सूचनाएँ** देखें — अगर काम लौटाया गया है, तो आपको _काम सुधार के लिए लौटाया गया_ दिखेगा।

![आज के कामों के साथ होम (My Day)](screens/phase5-04-my-day.png)

![काम शुरू करें बटन के साथ काम का विवरण](screens/phase5-05-task-detail.png)

पूरी गाइड: [किसी काम पर काम करें](article:staff.tasks)।
