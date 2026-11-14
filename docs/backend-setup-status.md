> Release update, 14 November 2026: Phase 1 was explicitly authorized, merged as `1dd9a95`, and deployed to GitHub Pages. Firebase confirmed rules/index deployment; a subsequent read-only CLI check reported all 23 indexes READY. Statements below about Phase 1 being undeployed are historical. This correction branch has NOT been deployed or migrated.

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

## Application and development status

- The foundation was merged into main and GitHub Pages deployed successfully at https://tsforcetech.github.io/FMS/#/login .
- Real browser owner sign-in, company loading and persistence after refresh were verified. Live logout/reset delivery and responsive visual acceptance remain separate checks; emulator regression coverage is retained.
- Phase 1 is implemented on `feature/phase1-company-sites`. New operational rules/indexes are committed for review, not deployed. The earlier statement that deployed rules match the repository applies to the Phase 0 main revision, not this development branch.
- See [Phase 1 report](phase1-report.md) for current test evidence, limits and pending rollout steps.
- No Firebase Hosting, billing or reference-website/DNS change is included.
