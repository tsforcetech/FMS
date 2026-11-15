---
id: train.report-ac
title: 'بدء سريع: الإبلاغ عن مشكلة في التكييف'
module: Training & Quick Starts
category: maintenance
audience: public
apps: [staff, mobile]
roles: [technician, staff, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: أبلِغ عن مكيّف معطّل (أو أي عطل) من تطبيق Staff واطلب أمر عمل للإصلاح.
routes: [/report]
screenshots: [phase5-08-report-issue.png, phase5-09-issue-confirmation.png]
diagrams: [wf-33, wf-32]
related:
  [
    staff.report-issue,
    cases.reported-issues,
    maintenance.work-orders,
    train.work-order,
  ]
sources:
  - apps/staff-web/src/screens/Issues.tsx
  - apps/staff-web/src/i18n.tsx
  - packages/shared/src/cases.ts
keywords:
  [
    AC not cooling,
    air conditioning,
    leak,
    fault,
    report problem,
    Also request a repair (work order),
    Send report,
    المكيف لا يبرد,
    التكييف,
    تسرب,
    عطل,
    الإبلاغ عن مشكلة,
    إرسال البلاغ,
  ]
translationOf: train.report-ac
translatedFrom: '2026-11-15'
translationStatus: draft
---

1. اضغط **إبلاغ** (أو **الإبلاغ عن مشكلة** من داخل مهمة).
2. يُفتح نموذج **الإبلاغ عن مشكلة**.
3. تحت **Problem type** (نوع المشكلة) اضغط **HVAC** (التدفئة والتهوية والتكييف). تشمل الخيارات الأخرى
   _Electrical_ (كهرباء) و*Plumbing* (سباكة) و*Cleaning* (تنظيف) و*Security* (أمن) و*Other* (أخرى).
4. اختر **Site** (الموقع العام) و**Location** (المكان)، و**Asset** (الأصل — وحدة التكييف) إذا كنت تعرفه.
5. حدّد **How serious?** (ما مدى الخطورة؟) — _Needs attention_ (يحتاج إلى متابعة) أو _Urgent / unsafe_
   (عاجل / غير آمن) (وجود ماء بالقرب من الأجهزة الكهربائية أمر عاجل).
6. صِف المشكلة في **ما هي المشكلة؟** — مثلًا: "مكيّف الغرفة 204 يُخرج هواءً دافئًا ويقطر ماءً".
7. ضع علامة على **Also request a repair (work order)** (اطلب الإصلاح أيضًا — أمر عمل) ليحصل فريق الصيانة
   على مهمة فورًا.
8. اضغط **إرسال البلاغ**.
9. دوّن **Reference number** (الرقم المرجعي) الظاهر في شاشة _Problem reported_ (تم الإبلاغ عن المشكلة).
   تابِعه في **My reported problems** (المشكلات التي أبلغتُ عنها).

![نموذج الإبلاغ عن مشكلة](screens/phase5-08-report-issue.png)

![التأكيد مع الرقم المرجعي](screens/phase5-09-issue-confirmation.png)

الدليل الكامل: [الإبلاغ عن مشكلة](article:staff.report-issue).
