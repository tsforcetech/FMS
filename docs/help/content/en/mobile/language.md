---
id: mobile.language
title: Change the app language
module: Mobile Application
category: getting-started
audience: public
apps: [mobile, staff]
roles: [staff, technician, supervisor]
version: '0.6'
reviewed: '2026-11-15'
owner: Mobile
description: Switch the staff and mobile app between English, Malayalam, Hindi and Arabic.
routes: [/profile]
screenshots: [phase6-09-arabic.png, phase5-14-arabic-rtl.png]
related: [staff.notifications, faq.staff]
sources:
  - apps/staff-web/src/i18n.tsx
  - apps/staff-web/src/screens/Profile.tsx
keywords: ["language", "English", "Malayalam", "Hindi", "Arabic", "RTL", "translation", "preview"]
---

The staff web and mobile app are available in **English**, **Malayalam**, **Hindi** and **Arabic**.
English is complete. The other languages cover the main actions and are marked *preview* with a
percentage; any text not yet translated is shown in English.

## Steps

1. Open **Profile**.
2. Under **Language** select your language.

![The mobile app in Arabic (Chromium runtime test)](screens/phase6-09-arabic.png)

## Expected result

The app changes at once. Arabic is shown right-to-left. The choice is remembered on this device
and browser.

![The staff web in Arabic, right-to-left](screens/phase5-14-arabic-rtl.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| Some words still in English | That text is not translated yet (preview language). | This is expected; it falls back to English. |

## Troubleshooting

- Names of tasks, sites and checklist questions are written by your company and are not translated.
- The **Profile** page in the mobile app also has links to **Attendance**, **Sync status**, **My
  work orders**, **Calendar**, **History**, **Notifications** and, for supervisors, **Approvals**.
