---
id: train.first-checklist
title: 'بدء سريع: املأ قائمة التحقق الأولى'
module: Training & Quick Starts
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [technician, staff, supervisor]
version: '0.8'
reviewed: '2026-11-15'
owner: Training
description: أجب عن أسئلة قائمة التحقق خطوة بخطوة، ثم راجع الإجابات وأرسلها.
routes: ['/task/:id']
screenshots: [phase5-06-checklist-step.png, phase5-07-review.png]
diagrams: [wf-27, wf-28]
related: [staff.checklist, train.first-task, staff.rework, mobile.photos]
sources:
  - apps/staff-web/src/screens/TaskView.tsx
  - apps/staff-web/src/i18n.tsx
keywords: [checklist, questions, answers, review answers, save progress, evidence, قائمة التحقق, الأسئلة, الإجابات, مراجعة الإجابات, حفظ التقدم, الأدلة]
translationOf: train.first-checklist
translatedFrom: '2026-11-15'
translationStatus: draft
---

1. افتح المهمة واضغط **ابدأ المهمة**، ثم اضغط **Open checklist** (فتح قائمة التحقق).
2. اقرأ السؤال وأي نص مساعدة مرافق له. يجب الإجابة عن الأسئلة المعلَّمة بـ **Required** (مطلوب).
3. اختر إجابتك أو اكتبها ثم اضغط **التالي**. استخدم **رجوع** للعودة.
4. بعض الأسئلة لا تظهر إلا بعد إجابة معيّنة — وهذا أمر طبيعي.
5. اضغط **حفظ التقدم** إذا اضطررت إلى التوقف؛ ستُحفظ إجاباتك (*Progress saved.* — تم حفظ التقدم.).
6. تُلتقط أدلة الصور أو رمز QR أو GPS في تطبيق الهاتف المحمول؛ أما في Staff على الويب فتُسجَّل على أنها
   قيد الانتظار (pending).
7. اضغط **مراجعة الإجابات**. تظهر قائمة **Failed checks** (الفحوصات غير الناجحة)؛ أضف
   **Remarks (optional)** (ملاحظات — اختيارية) إذا كان ذلك مفيدًا.
8. صحّح كل ما يظهر معه *Complete the highlighted answers first.* (أكمل الإجابات المظلَّلة أولًا.)
9. اضغط **إرسال للاعتماد** أو **وضع علامة مكتملة**.

![خطوة في قائمة التحقق](screens/phase5-06-checklist-step.png)

![مراجعة الإجابات قبل الإرسال](screens/phase5-07-review.png)

الدليل الكامل: [ملء قائمة التحقق](article:staff.checklist).
