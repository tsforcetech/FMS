---
id: train.first-task
title: 'بدء سريع: أنجِز مهمتك الأولى'
module: Training & Quick Starts
category: getting-started
audience: public
apps: [staff, mobile]
roles: [technician, staff, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: عشر خطوات من تسجيل الدخول حتى إنهاء مهمة في تطبيق FacilityOS Staff.
routes: ['/', '/task/:id']
prerequisites:
  - قام أحد المسؤولين بربط حساب الدخول الخاص بك بسجل الموظف الخاص بك
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
    اليوم الأول,
    كيف أبدأ,
    ابدأ المهمة,
    وضع علامة مكتملة,
    الرئيسية,
  ]
translationOf: train.first-task
translatedFrom: '2026-11-15'
translationStatus: draft
---

1. افتح تطبيق FacilityOS Staff وسجّل الدخول بالبريد الإلكتروني وكلمة المرور اللذين أعطاك إياهما مشرفك.
2. في **الرئيسية** (My Day — يومي) تجد مهام اليوم مرتبة حسب موعد استحقاقها.
3. اضغط على مهمة لفتحها. اقرأ **Instructions** (التعليمات) و**Location** (الموقع) و**Due** (موعد الاستحقاق).
4. اضغط **ابدأ المهمة** عندما تبدأ العمل.
5. اضغط **Open checklist** (فتح قائمة التحقق) وأجب عن كل سؤال
   (انظر [قائمة التحقق الأولى](article:train.first-checklist)).
6. تحتاج إلى استراحة؟ اضغط **إيقاف مؤقت**، ثم اضغط **استئناف** لاحقًا.
7. اضغط **مراجعة الإجابات** وصحّح أي شيء مُظلَّل.
8. اضغط **إرسال للاعتماد** (إذا كان على مشرفك مراجعة العمل) أو **وضع علامة مكتملة**.
9. ستظهر لك الرسالة _Submitted. Your supervisor will review it._ (تم الإرسال. سيراجعه مشرفك.) أو
   _Task completed._ (اكتملت المهمة.)
10. تحقّق من **التنبيهات** لاحقًا — إذا أُعيد العمل إليك فسترى _أُعيد العمل للتصحيح_.

![الرئيسية (My Day) مع مهام اليوم](screens/phase5-04-my-day.png)

![تفاصيل المهمة مع زر ابدأ المهمة](screens/phase5-05-task-detail.png)

الدليل الكامل: [العمل على مهمة](article:staff.tasks).
