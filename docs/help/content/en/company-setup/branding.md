---
id: setup.branding
title: Set your logo and report preferences
module: Company Setup
category: administration
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Onboarding
description: Upload a company logo and set the report colour, currency, locale, date format and report header and footer used in exports.
routes: [/onboarding]
helpIds: [setup.branding]
permissions:
  - Company owner or admin
screenshots: [admin-onboarding.png, phase8-04-export-dialog.png]
diagrams: [wf-02]
related: [setup.wizard, setup.company-settings, exports.overview]
sources:
  - apps/admin-web/src/management/Onboarding.tsx
  - apps/admin-web/src/management/onboardingStore.ts
keywords:
  [
    logo,
    branding,
    colour,
    color,
    currency,
    locale,
    date format,
    report header,
    report footer,
    Branding saved,
  ]
---

The **Logo & preferences** step of **Administration → Company setup** stores the branding used on
exported reports: your logo, a report colour, the currency, locale, date format and a header and
footer line.

## Before you start

- Have the logo as a **PNG or JPEG** file of 5 MB or less. FacilityOS shrinks it in your browser
  to at most 240 × 80 pixels, so a wide, simple logo works best.
- Know your accounting currency's three-letter code (for example AED).

## Steps

1. Open **Administration → Company setup** and select **Logo & preferences**.
2. Under **Logo** select **Upload PNG/JPEG** and choose the file. A preview appears. Select
   **Remove** to clear it.
3. Optionally enter a **Display name on reports** (leave empty to use the company name).
4. Choose the **Report colour** (a hex colour such as `#1D4ED8`).
5. Enter the **Currency** (three letters, e.g. AED), the **Locale** (e.g. en-GB) and the
   **Date format** (e.g. dd MMM yyyy).
6. Optionally enter a **Report header line** and a **Report footer line**.
7. Select **Save branding**.

![The Logo & preferences step](screens/admin-onboarding.png)

## Expected result

- The message _Branding saved_ appears and the step shows as done.
- New Excel and PDF exports use your branding.

![The export dialog that uses the branding](screens/phase8-04-export-dialog.png)

## Common errors

| Message                                                  | Why                                                   | What to do                                   |
| -------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| _Choose a PNG or JPEG image._                            | The file is another format (for example SVG or WebP). | Save the logo as PNG or JPEG.                |
| _The image is larger than 5 MB._                         | The file is too large to process.                     | Use a smaller file.                          |
| _The image could not be read._                           | The file is damaged or not really an image.           | Export the logo again from your design tool. |
| _The logo is too large. Use an image under about 40 KB._ | Even after shrinking, the stored logo is too big.     | Use a simpler logo with fewer colours.       |
| _Use a PNG or JPEG logo._                                | The stored logo is not PNG or JPEG.                   | Upload the logo again.                       |
| _Choose a colour like #1D4ED8._                          | The colour is not a six-digit hex value.              | Enter `#` followed by six hex digits.        |
| _Use a three-letter currency code, e.g. AED._            | The currency is not three capital letters.            | Enter a code such as AED, USD or EUR.        |

## Troubleshooting

- **The logo looks blurred:** it is shown at most 240 × 80 pixels. Use a logo designed for that
  size rather than a large photo.
- **Amounts show the wrong currency:** purchase costs are recorded in the company's accounting
  currency; set **Currency** to that code.
