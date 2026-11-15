# Backup & recovery (Phase 7)

**Status today: there is no automatic backup.** The live project `facilityos-43386` runs on the free Firebase **Spark** plan. On Spark:

| Protection                                      | Available on Spark | Configured              |
| ----------------------------------------------- | ------------------ | ----------------------- |
| Firestore managed backups (scheduled)           | No (Blaze only)    | No                      |
| Point-in-time recovery (PITR, 7 days)           | No (Blaze only)    | No                      |
| `gcloud firestore export` to Cloud Storage      | No (Blaze only)    | No                      |
| Manual JSON export (`scripts/backup-export.ts`) | Yes                | Operator-run, on demand |
| Rules, indexes and app code in Git              | Yes                | Yes                     |

Upgrading to Blaze to enable managed backups/PITR is a paid-services change and needs separate approval. Nothing in this repository enables it.

## Manual export (operator)

Read-only; writes nothing to Firestore. Uses the operator's own Google login via Application Default Credentials — no service-account key is stored in the repository.

```bash
gcloud auth application-default login
```

```bash
npx tsx scripts/backup-export.ts --project facilityos-43386 --confirm-project facilityos-43386 --company gbh --out ~/fos-backups
```

Output: `<company>-<timestamp>.json` (all company collections; timestamps as `{"$ts": ISO}`, geo points as `{"$geo": [lat, lng]}`) and a `.manifest.json` with per-collection counts and the SHA-256 of the data file. Files are created with owner-only permissions. They contain personal data (employees, attendance, GPS, customer requests): store them encrypted, never in Git or chat, and delete them according to the retention policy.

Recommended cadence while on Spark: before every release/rules deploy, and weekly. Verified on the emulator (Phase 7).

Firebase Auth accounts are **not** in the export. They can be listed by an operator (`firebase auth:export`) if needed; passwords are never exported in plain text.

## Recovery

1. **Stop writes**: announce maintenance; optionally deploy a temporary deny-all rules file for the affected company (reviewed change).
2. **Identify scope**: which collections/records and the time of the damage. The audit history (Administration → Audit history) and the event streams (`taskEvents`, `caseEvents`, `stockMovements`, `assetTransfers`) show who changed what.
3. **Choose the export** taken before the damage; check its manifest hash.
4. **Restore selectively** with a reviewed operator script using the Admin SDK: restore only the affected documents, converting `$ts`/`$geo` back. Never overwrite a whole company blindly — later legitimate changes would be lost. Stock balances must be recomputed from `stockMovements` rather than restored on their own.
5. **Verify**: counts against the manifest, the stock reconciliation report, and spot checks in the admin app.
6. **Record** the incident and the restore in the release log.

A restore tool is deliberately not automated in Phase 7: restoring live data is high-risk and must be reviewed for each incident.

## Rules, indexes and code

Rules and indexes are versioned (`firebase/firestore.rules`, `firebase/firestore.indexes.json`) and can be redeployed from any commit:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project facilityos-43386
```

The admin, staff and customer web apps are rebuilt from `main` by the Pages workflow.

## Retention

Administration → Data retention records the company's retention periods (GPS, attendance, photos, notifications, audit — audit at least one year). On Spark there is no server job, so **nothing is purged automatically**; purging needs an approved server process (planned with the Phase 8 export tools).
