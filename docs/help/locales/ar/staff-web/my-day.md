---
id: staff.my-day
title: يومك على الشاشة الرئيسية (My Day)
module: Staff Web
category: daily-tasks
audience: public
apps: [staff, mobile]
roles: [staff, technician, supervisor]
version: '0.5'
reviewed: '2026-11-15'
owner: Staff Experience
description: اطّلع على مهام اليوم والأعداد ومناوبتك والمهمة التالية التي ستبدأها.
routes: [/]
prerequisites:
  - أنت مسجّل الدخول إلى تطبيق الموظفين أو تطبيق الهاتف المحمول
screenshots: [phase5-04-my-day.png, staff-my-day.png, phase6-01-my-day.png]
diagrams: [wf-36]
related: [staff.tasks, staff.checklist, staff.calendar, ts.no-tasks, ts.task-overdue, mobile.tasks]
sources:
  - apps/staff-web/src/screens/MyDay.tsx
  - apps/staff-web/src/i18n.tsx
  - apps/mobile/src/screens/Main.tsx
keywords: ["home", "today", "Today's work", "Start next task", "Continue task", "No tasks for today", "overdue", "shift", "leave", "الرئيسية", "اليوم", "عمل اليوم", "ابدأ المهمة التالية", "متابعة المهمة", "لا توجد مهام اليوم", "متأخرة", "مناوبة", "إجازة"]
translationOf: staff.my-day
translatedFrom: '2026-11-15'
translationStatus: draft
---

تعرض **الرئيسية** عملك لليوم في مكان واحد: عدد المهام لديك، والمهمة التي يجب أن تقوم بها بعد ذلك،
ومناوبتك. وهي أول شاشة تظهر بعد تسجيل الدخول، على موقع الموظفين وفي تطبيق الهاتف المحمول.

## قبل أن تبدأ

- سجّل الدخول (انظر [تسجيل الدخول إلى تطبيق الموظفين](article:staff.sign-in)).
- لا تظهر المهام إلا بعد أن يُسندها إليك مشرفك أو بعد أن ينشئها المُجدوِل.

## الخطوات

1. افتح **الرئيسية**.
2. اقرأ سطر **Shift today** (مناوبة اليوم). يعرض مناوبتك، أو *No shift assigned today* (لا توجد مناوبة
   مُسندة اليوم)، أو *You are on approved leave today* (أنت في إجازة معتمدة اليوم)، أو *Holiday* (عطلة).
3. انظر إلى المربعات تحت **عمل اليوم**: **مُسندة** و**قيد الانتظار** و**قيد التنفيذ** و**مكتملة**
   و**متأخرة** و**إعادة العمل**. اختر مربعًا لفتح القائمة المطابقة له.
4. اختر **ابدأ المهمة التالية** لفتح المهمة التالية المطلوبة. إذا كنت قد بدأت مهمة من قبل، فسيظهر على الزر
   **متابعة المهمة**.
5. تظهر المهام التي أرسلتها بحالة **Waiting for approval** (بانتظار الاعتماد) حتى يراجعها مشرفك.

![الرئيسية (My Day) مع أعداد اليوم والمهمة التالية](screens/phase5-04-my-day.png)

{{diagram wf-36}}

## النتيجة المتوقعة

- عندما لا يوجد ما تفعله ترى **لا توجد مهام اليوم** — *When your supervisor assigns work, it appears
  here.* (عندما يُسند إليك مشرفك عملًا، سيظهر هنا.)
- عندما يكتمل كل شيء ترى **All of today’s work is done. Well done!** (اكتمل كل عمل اليوم. أحسنت!)

![الرئيسية (My Day) على موقع الموظفين](screens/staff-my-day.png)

> **Tip:** في تطبيق الهاتف المحمول تعرض الرئيسية أيضًا حالة تسجيل حضورك. انظر
> [الحضور](article:mobile.attendance).

![الرئيسية (My Day) في تطبيق الهاتف المحمول (اختبار تشغيل على Chromium، وليس هاتفًا حقيقيًا)](screens/phase6-01-my-day.png)

## الأخطاء الشائعة

| الرسالة | السبب | ماذا تفعل |
| --- | --- | --- |
| *لا توجد مهام اليوم* | لم يُسند إليك أي عمل اليوم، أو لم يتم إنشاء المهام بعد. | تحقّق من **مهامي ← القادمة**؛ واسأل مشرفك. انظر [لا تظهر أي مهام](article:ts.no-tasks). |
| توجد مهمة في **متأخرة** | انتهى موعد استحقاقها ولم تكتمل. | افتحها وأنهِها؛ انظر [مهمة متأخرة](article:ts.task-overdue). |
| *You are offline…* (أنت غير متصل…) | لا يوجد اتصال بالإنترنت. | أعد الاتصال. في تطبيق الهاتف المحمول يبقى عملك محفوظًا على الجهاز. |

## استكشاف الأخطاء وإصلاحها

- **الأعداد تبدو قديمة:** اسحب الشاشة للأسفل للتحديث أو أعد فتح **الرئيسية**.
- **مهمة في موقع آخر:** لا ترى إلا المهام الخاصة بالمواقع المرتبطة بحسابك؛ انظر
  [موقع خاطئ](article:ts.wrong-site).
