---
id: gs.navigation
title: Finding your way around the admin app
module: Getting Started
category: getting-started
audience: public
apps: [admin]
roles: [owner, admin]
version: '0.8'
reviewed: '2026-11-15'
owner: Product
description: The admin app layout — the menu groups, the top bar, record lists, record pages and the common actions on every list.
routes: [/]
permissions:
  - Company owner or admin
screenshots: [phase4-dashboard-desktop.png, phase4-list-desktop.png, phase4-form-mobile.png]
related: [gs.overview, gs.roles, sites.create, setup.notifications]
sources:
  - apps/admin-web/src/nav.ts
  - apps/admin-web/src/App.tsx
  - apps/admin-web/src/management/Records.tsx
keywords: [menu, sidebar, navigation, search, export, filter, archive, record page, tabs, breadcrumb]
---

The admin app has a menu on the left, a top bar with the current page, notifications and your
company, and the page content in the middle. Every master-data page (sites, employees, assets and
so on) works the same way, so once you know one list you know them all.

## Before you start

Sign in as an owner or admin (see [Signing in](article:gs.sign-in)).

## Steps

1. **Use the menu groups.** The left menu is grouped in this order:
   **Dashboard**, **Property**, **Clients & contracts**, **People & teams**, **Assets**,
   **Materials & inventory**, **Task management**, **Maintenance**, **Issues & escalations**,
   **Notifications**, **Reports & analytics** and **Administration**. On a phone, open the menu
   with the menu button in the top bar.
2. **Read the top bar.** It shows the group and page you are on (for example
   *Property › Sites*), a search button that returns to the **Overview**, the notification bell,
   the **Current company** selector and your profile menu with **Sign out**.
3. **Work with a list.** A record list offers:
   - **Add <record>** (for example **Add site**) to open the form.
   - A search box that filters by name, and an **All statuses** filter.
   - A refresh button and an **Export** menu for Excel/PDF (see
     [Exports](article:exports.overview)).
   - Selecting a row opens the record page.
4. **Work with a record page.** The header shows the name, the **Code**, the status and, when
   other active records refer to it, a pill such as *3 active links*. Buttons on the right are
   **Edit**, **Archive** and record-specific actions (for example **Add child location**,
   **QR label** or **Transfer**). Tabs below show related records and history.
5. **Save forms.** A form shows **New <record>** or **Edit <record>**. Required fields are marked.
   After saving you see a confirmation such as *Site created.* If you close a form with unsaved
   changes FacilityOS asks *Discard unsaved changes?*

![A record list with search, status filter and export](screens/phase4-list-desktop.png)

## Expected result

You can reach every page from the menu, open records from lists and recognise the same actions
on every list and record page.

![The overview dashboard](screens/phase4-dashboard-desktop.png)

## Common errors

| Message | Why | What to do |
| --- | --- | --- |
| *This record changed. Close the form and reload before editing.* | Someone else saved the same record after you opened it. | Close the form, refresh, and make your change again. |
| *Module pending activation* | That part of the system is not active for your company yet. | No action needed; the page activates when the module is released. |
| *Read-only subscription.* banner | Your subscription is read-only. Data can be viewed and exported but not changed. | See **Administration → Plan & usage** and [Read-only mode](article:saas.read-only). |

## Troubleshooting

- **A list looks empty:** clear the search box and set the status filter back to
  **All statuses**. Archived records stay in the list with the status *Archived*; choose
  *Active* to hide them.
- **The form is cut off on a phone:** forms scroll; the save button is at the bottom of the
  drawer.

![A record form on a phone](screens/phase4-form-mobile.png)
