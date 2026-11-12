# Source audit — 12 November 2026

## Repository

GitHub connector confirmed `tsforcetech/FMS` is public, default branch metadata `main`, size 0. Contents returned “This repository is empty”; branch search returned no branches and `git ls-remote` returned no refs. There is no existing code, configuration, AGENTS.md or Git history to preserve.

An attempt to bootstrap a README on the default branch was rejected by automatic approval review because implementation should remain on `feature/phase0-foundation`. No default-branch commit was created by that attempt. Local work was initialized directly on the requested feature branch. The user subsequently explicitly approved the README-only initial commit on main. It was created as `2d11e2435a9f160a3e550b5f9a9b0eed0a5f8f20`, and the development branch was created from it. No application changes were merged into main. Delivery status is recorded in the final verification report.

## Reference inspection

Inspected `https://fms.flowb.io/` in a browser and retrieved its public HTML source. It is a standalone HTML/CSS/JavaScript prototype. The portal-switch dialog explicitly says no real account is required, changes persist in the browser, and data is not shared across devices. Settings explicitly lists authentication, cloud uploads, scheduling, push and multi-user sync as disconnected.

| Area                      | Observed behavior                                                                   | Phase 0 decision                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Staff home                | My workspace, next task, My tasks, Issues, History, Profile; sample staff/locations | Defer staff app; no sample records copied                                                         |
| Admin dashboard           | Teal summary banner, cards, task queue, sample charts                               | Reuse visual components, replace metrics with connected company details and truthful empty states |
| Navigation                | Operations/Management grouping, fixed white sidebar, compact top bar                | Use planned module names and clear future-phase labels                                            |
| Sites & assets            | Site cards; hierarchy described as a future backend feature                         | Implement planned flexible company/client/site/location model in later phases                     |
| Staff & roles             | Employee table with roles, departments and site                                     | Future employee form will use planned tenant membership design                                    |
| Templates                 | Routine cards and checklist counts                                                  | Domain contracts only                                                                             |
| Schedule                  | Seven-day calendar, recurrence summaries, site timezone                             | No local timer or background scheduling claims                                                    |
| RACI                      | Sample R/A/C/I matrix, separate approval-permission explanation                     | Preserve distinction in architecture                                                              |
| Approvals                 | Pending submission cards and review controls                                        | Deferred; no review actions executed                                                              |
| Work orders / maintenance | Table with origin complaint references and statuses                                 | Preserve traceable origins in future schema                                                       |
| Escalations               | Department-to-department table                                                      | Deferred                                                                                          |
| Complaints                | Helpdesk queue, status cards and management actions                                 | Deferred                                                                                          |
| Reports                   | Demo ratios and CSV buttons; sample/production limitations stated                   | No fake reports in foundation                                                                     |
| Settings                  | Touch mode and language preview; explicit local-only backend status                 | Preferences deferred                                                                              |
| Login                     | No production login screen present                                                  | New simple branded email/password form                                                            |
| Forms/dialogs             | Rounded inputs, labels, close controls and portal selector observed in source/UI    | New forms follow planned fields and accessible components                                         |

No operational record was created, deleted, approved or submitted during inspection. Switching the prototype portal only changed the browser-local experience. Responsive CSS was inspected in source; interactive mobile verification of the old prototype was not performed.

## Design compatibility

Reference tokens: background `#f6f8fb`, ink `#172b3d`, brand `#157e72`, dark teal `#0d695f`, pale teal `#e5f5f0`, border `#e7edf1`; 16px cards, 254px sidebar, rounded controls, Inter/system font stack. `reference.css` retains the public prototype's style primitives; React components, authorization and routing are newly implemented. No prototype JavaScript or embedded demo data was copied into the application.

User clarification: the reference is visual guidance only. **Our agreed structure controls every field, form and workflow.** Future CRUD forms are deliberately not implemented in Phase 0. Ease of use and staff accessibility take priority over exact screen duplication.
