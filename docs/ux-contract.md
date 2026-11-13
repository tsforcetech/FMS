# FacilityOS usability contract

The reference website is visual guidance. The agreed FacilityOS data structure and permissions determine actual forms, fields and workflows.

## Forms

Use plain-language labels, visible required-field indicators, sensible defaults and inline validation. Group related fields in short sections; keep advanced/optional settings collapsed. Do not put database IDs, security-rule jargon, deployment details or implementation choices in normal user flows. Use searchable selectors for related records, never require staff to type opaque IDs. Preserve input after validation errors; prevent duplicate submissions and give clear success/failure feedback. Confirm destructive changes and explain consequences.

## Planned master forms (not implemented in Phase 0)

| Form              | Primary fields                                 | Relationships / optional sections                                    |
| ----------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Company           | Company name, status, timezone                 | Company settings; trusted owner provisioning                         |
| Client            | Client name, contact details                   | Tenant-owned client, never a SaaS tenant                             |
| Contract          | Client, contract reference, start/end, status  | Sites and service scope                                              |
| Site              | Site name, client, property type, timezone     | Contract, address, working hours, site manager                       |
| Location          | Name, site, type, parent location              | Building/floor/zone/room/outdoor/custom; prevent cycles              |
| Facility          | Name, type, site/location, condition           | Inspection/cleaning/safety configuration                             |
| Asset / furniture | Name, category, asset tag, location, condition | Serial number, supplier, warranty; history as separate records       |
| Material          | Name, category, unit, reorder level            | Stock locations, suppliers; balances from controlled movements       |
| Employee          | Name, contact, department, role, active status | Sites, shifts, teams and supervisor; protected permission assignment |
| Task template     | Title, instructions, checklist, priority       | Duration, evidence requirements, approval and RACI                   |

## Navigation and staff experience

Keep Operations and Management sections. Identify future modules with a phase label and a clear not-active page. Only login, password reset, company selector, profile information, logout and foundation dashboard work in Phase 0.

Use at least 44px touch targets for key actions, strong focus indication, semantic headings, properly associated labels and meaningful error text. Support narrow screens without horizontal page scrolling; tables may scroll within their own container. Show one clear next action on future staff pages. Maintain understandable empty, loading, denied and offline/error states. Never display fabricated metrics.

Future staff workflow: My Day → next task → short checklist → evidence if required → review → submit. Distinguish saved locally, queued for sync and accepted by server. Never label unsynced work completed by the server. Malayalam and Arabic/RTL need deliberate localization in the staff/mobile phases; not currently implemented.
