# Security model

Deny by default. Only Phase 0 profiles, company discovery hints, canonical memberships, company headers and direct audit reads are enabled. Even owners cannot modify company ownership, memberships, role grants or audit records from the client. Company profile editing and user invitations are deferred.

| Principal          | Profile                                | Discovery hints       | Company header                | Own membership                                                      | Audit                      | Future modules       |
| ------------------ | -------------------------------------- | --------------------- | ----------------------------- | ------------------------------------------------------------------- | -------------------------- | -------------------- |
| Anonymous          | Deny                                   | Deny                  | Deny                          | Deny                                                                | Deny                       | Deny                 |
| Active staff       | Own get; validated display-name update | Own read only         | Deny                          | Get                                                                 | Deny                       | Deny                 |
| Active owner/admin | Own get; validated display-name update | Own read only         | Authorized active company get | Get (other company members direct get in authorized active company) | Authorized direct get only | Deny                 |
| Inactive member    | Own profile/hints                      | Own read only         | Deny                          | Own get for denial UX                                               | Deny                       | Deny                 |
| Trusted operator   | Admin SDK/IAM boundary                 | Provision transaction | Provision transaction         | Provision transaction                                               | Append                     | No Phase 0 operation |

Membership UID, companyId, active status and role are verified on server. Suspended companies deny company/audit reads. Directory records contain only routing hints. Editing a display name cannot change authorization. User lists, company lists and member lists are denied. Sites, client/customer permissions and granular role definitions remain denied until dedicated tests ship.

Auth can be called outside the application. Firebase Email/Password may permit API-level sign-up even though no registration form exists. Such identities receive no Firestore profile or company membership and cannot become administrators. Do not confuse hidden registration UI with a server-side Auth sign-up ban. Restrict provisioning operationally and monitor unwanted accounts. Email enumeration protection should be enabled in Authentication settings; reset messages are generic.

The trusted provisioning script uses Application Default Credentials outside the repo. Admin SDK bypasses rules; IAM access to the operator machine is therefore security-critical. Never send its credentials to the frontend. The script requires an existing enabled password user, explicit matching project confirmation, safe IDs and valid timezone. It refuses to overwrite an existing company/member/directory and creates company/member/profile/hint/audit in one Firestore transaction. It does not create or email passwords.

Revocation: trusted operator sets member.status=inactive, optionally removes its discovery hint, and records a separate audit event. Every subsequent protected request re-evaluates rules. The selected membership listener removes the open workspace after a server-observed change. Firestore uses memory cache; there is no durable offline tenant cache. Auth uses browser-local persistence; users on shared devices must sign out.

No deployment workflow, privileged frontend secret, Functions endpoint, file upload or server scheduling is included. Firebase public web config is an identifier/configuration bundle, not an admin credential; security comes from Auth, rules and IAM. Keep email enumeration protection, authorized domains and project access reviewed before release.

Tests include all ten requested security cases plus inactive membership, suspended company, profile escalation, discovery-hint tampering, future-collection closure and revocation. See the verification report for actual results. Emulator success does not replace project-specific rules deployment and live smoke verification.
