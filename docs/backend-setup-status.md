# Backend setup status

Updated 13 November 2026. This status supersedes the earlier setup blockers in the foundation report.

## Completed

- Administrative sign-in succeeded during setup and was renewed for final backend verification.
- The intended account was verified as enabled with a password provider.
- The authentication configuration confirmed email sign-in is enabled.
- The database was confirmed as Standard edition with its free tier enabled.
- Firebase CLI compiled and deployed the repository security rules and index configuration successfully.
- An atomic, non-overwriting commit created the company, owner membership, user profile, company discovery link and audit record. The backend acknowledged all five writes. Do not rerun initial provisioning.

- Authenticated readback confirmed all five provisioned records exist, including the expected company and active owner role.
- The deployed security rules were retrieved and matched the repository source exactly.
- The Cloud Billing API confirmed billing is disabled.

## Remaining

- Complete real browser login/logout, persistence, password-reset delivery and desktop/mobile visual checks.
- A separate test Hosting deployment still requires target review and approval. No Hosting deployment or production website change has been made.

Backend provisioning and authenticated backend verification succeeded. Final client acceptance remains pending; Phase 1 has not started.
