---
id: mobile.install
title: Install the mobile app
module: Mobile Application
category: getting-started
audience: public
apps: [mobile]
roles: [staff, technician, supervisor, admin]
version: '0.6'
reviewed: '2026-11-15'
owner: Mobile
description: Install the Android test build of the FacilityOS mobile app, and what is needed for iOS.
routes: []
prerequisites:
  - An Android phone, or a Mac with Xcode for iOS
  - A staff login linked by your administrator
screenshots: [phase6-01-my-day.png]
related: [mobile.sign-in, mobile.offline, faq.staff, setup.staff-access]
sources:
  - apps/mobile/src/App.tsx
  - apps/mobile/src/platform.ts
  - docs/phase6-report.md
keywords:
  [
    'install',
    'APK',
    'Android',
    'iOS',
    'iPhone',
    'Install unknown apps',
    'TestFlight',
    'Play Store',
    'App Store',
  ]
---

The FacilityOS mobile app gives field staff the same work as the staff web, plus QR scanning,
photos, GPS, attendance and offline work.

> **Warning:** Today only an **Android debug (test) build** exists. It is built automatically on
> every change, but it has **not yet been tested on a physical phone** — it was tested in Chromium
> (the browser engine inside Android's WebView) with a phone-sized screen. The app is **not** in the
> Google Play Store or Apple App Store yet.

## Before you start

- Ask your administrator for the APK file (the `facilityos-android-debug-apk` build).
- Your administrator must link your login under **Administration → Staff access** first.

## Steps (Android)

1. Copy the APK file to the phone or download it on the phone.
2. Allow **Install unknown apps** for the browser or Files app that opens it (Android asks the
   first time).
3. Open the APK and select **Install**.
4. Open **FacilityOS** and sign in (see [Sign in on mobile](article:mobile.sign-in)).
5. Allow the camera and location when the app asks — they are only used when you scan, take a
   photo, capture GPS or check in.

## iOS

The iOS project exists, but it has not been built. Building it needs a Mac with Xcode, and
installing it on iPhones (TestFlight or App Store) needs an Apple Developer account and signing.
Until then, iPhone users use the staff web in the browser.

## Expected result

After signing in you see **Home** with today's work.

![Home in the mobile app (Chromium runtime test, not a physical phone)](screens/phase6-01-my-day.png)

## Common errors

| Message                                       | Why                              | What to do                                          |
| --------------------------------------------- | -------------------------------- | --------------------------------------------------- |
| Android blocks the install                    | **Install unknown apps** is off. | Allow it for the app that opens the APK, or ask IT. |
| _Your login is not linked to an employee yet_ | The login is not linked.         | See [Login not linked](article:ts.not-linked).      |

## Troubleshooting

- Not available yet: push notifications, photo upload to the cloud, store releases. See
  [Staff FAQ](article:faq.staff).
