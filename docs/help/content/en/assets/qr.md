---
id: assets.qr
title: Print and use asset QR labels
module: Assets & Inventory
category: maintenance
audience: public
apps: [admin, mobile]
roles: [owner, admin, supervisor, technician, staff]
version: '0.8'
reviewed: '2026-11-15'
owner: Assets
description: Download or print an asset's QR label and understand what happens when staff scan it.
routes: [/assets]
prerequisites:
  - A registered asset that is not archived
permissions:
  - Company owner or admin to print labels; any signed-in user with access to the asset's site to open it
screenshots: [phase4-04-asset-qr.png, phase6-03-scanner.png, phase6-08-scan-result.png]
diagrams: [wf-37]
related: [assets.register, assets.transfer, mobile.qr, ts.qr-invalid, maintenance.work-orders]
sources:
  - apps/admin-web/src/management/Assets.tsx
  - apps/mobile/src/screens/Scan.tsx
  - firebase/firestore.rules
keywords: [QR, QR code, label, print label, barcode, scan, sticker, asset tag]
---

Every asset has a QR label that encodes a link to the asset's page. The code contains **no
credentials**: scanning opens the asset only after an authorised FacilityOS sign-in.

## Before you start

- Register the asset (see [Asset register](article:assets.register)).
- Use durable label stock suitable for the location (outdoor, plant room, kitchen).

## Steps

### Download or print the label

1. Open **Assets → Asset register** and open the asset.
2. Select **QR label**. The drawer shows the code and *Scanning opens this asset after sign-in.
   The code contains no credentials.*
3. Select **Download** to save a PNG named after the asset code (for example `AC-T1-0201.png`), or
   **Print label** to print the code with the asset code, name and company name.
4. Stick the label on the asset where it can be scanned easily.

![The QR label drawer](screens/phase4-04-asset-qr.png)

### Scan a label

1. In the mobile app, open **Scan** and point the camera at the label (*Point the camera at the
   QR label on the asset or location.*). You can also type the code (*Or type the code*).
2. FacilityOS checks your access to the asset's site and shows the asset with
   **My open tasks here** and a way to report a problem.
3. Any other phone camera opens the asset page in the browser, which still requires an authorised
   sign-in.

![Scanning in the mobile app](screens/phase6-03-scanner.png)

{{diagram wf-37}}

## Expected result

The person who scans sees the asset, their open tasks for it and can report an issue — only if
their staff link covers the asset's site.

![Scan result with open tasks](screens/phase6-08-scan-result.png)

> **Note:** The QR drawer in the admin app still says that mobile scanning arrives with the staff
> app. Scanning is available in the mobile app today; that drawer text is out of date.

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *This is not a FacilityOS code.* | The QR code was not created by FacilityOS. | Scan the FacilityOS label, or type the code. |
| *This code does not match any record you can access.* | The asset does not exist, is archived or disposed, or is not visible to you. | Check the asset status with an administrator. |
| *You are not authorized for this asset or location.* | Your staff link does not include the asset's site. | Ask an administrator to add the site in **Staff access**. |

## Troubleshooting

- **The label will not scan:** clean or reprint it, improve the light, or type the code. See
  [Invalid QR](article:ts.qr-invalid).
- **The asset moved:** the label stays the same — the code is permanent. Record the move with
  [Transfer](article:assets.transfer).
