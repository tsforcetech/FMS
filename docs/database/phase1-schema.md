# Phase 1 operational schema

All records live beneath an authorized `companies/{companyId}`. No collection-group queries, public reads, staff operational access, hard deletes or browser-created tenants are enabled.

Common persisted fields: `companyId`, `schemaVersion: 1`, `createdAt`/`updatedAt` (Firestore Timestamp), `createdBy`/`updatedBy` (UID), integer `revision`, integer `refCount`, `witnessKind`/`witnessId`, `code`, `name`, `notes`, `status`. Codes are 1–40 uppercase letters/digits/underscore/hyphen, starting with a letter or digit; names are 1–120 characters; descriptions/notes/address up to 2,000; other strings up to 200 unless stricter validation applies. Reference IDs are 1–128 safe ID characters. Optional relationships persist as an empty string, not an omitted field. `status` is active/archived except where listed below.

| Collection    | Domain fields                                                                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| clients       | clientType (Individual/Company), contactPerson, phone, email, address, country, vatNumber                                                                                                                                         |
| contracts     | clientId, startDate/endDate (validated calendar date `YYYY-MM-DD`, not an instant), serviceDescription; status draft/active/expired/archived                                                                                      |
| sites         | clientId, optional contractId, propertyType, address, country, city, timeZone (supported IANA zone), workingDays (comma-separated selected Mon–Sun), opensAt/closesAt (local `HH:mm` or empty), contactPerson, phone, description |
| locations     | immutable siteId, optional parentId, locationType, floorNumber, description                                                                                                                                                       |
| facilityTypes | description                                                                                                                                                                                                                       |
| facilities    | immutable siteId, locationId, typeId, condition (Excellent/Good/Fair/Poor/Critical), description; status active/under_maintenance/out_of_service/archived                                                                         |

The location kind can be Building, Floor, Zone, Room, Corridor, Parking, Outdoor area, Common area or Custom. No mandatory type sequence is imposed.

`codeClaims/{kind}_{code}` contains companyId, kind, recordId, code. It is created with the record, immutable and retained after archive. Codes are unique per collection per company, not globally.

`facilities/{facilityId}/history/{revision}` contains companyId, revision, condition, status, actorUid and occurredAt. Rules require a matching business-record revision change and prevent history update/delete. This is client-attributed change history, not an independent trusted audit.

## References and archive

Only active direct references are counted, preventing double-counting ancestors:

- A contract references its client; a site references its client and optional contract.
- A root location references its site. A child location references its parent instead; the active ancestor chain protects the site transitively.
- A facility references its location and type; its site must equal the location's site.

Counter-only changes must have the exact ±1 change proved by the linked record's before/after state and a matching witness. Counter updates cannot modify business fields. Atomic business writes check the corresponding counters after the transaction. A record with active incoming references cannot archive. Archiving a leaf releases its outgoing references; IDs and history remain. Reactivation revalidates active references. Referenced contracts cannot change client.

One relationship may be reassigned per update. New records establish required links in a single transaction. Tree edits validate up to four ancestors; unbounded subtree moves are not offered. See the report for the inherited deeper-descendant limitation after moving an existing subtree. Locations and facilities cannot change site IDs. Trusted provisioning/migrations must respect these invariants too because Admin SDK bypasses rules.

## Queries and indexes

Lists use name order, optional case-sensitive prefix range, status and relation filters, 20 records per page with a document cursor. Selectors use the same paginated queries. The tree reads a page of direct children for a particular site/parent, not the entire hierarchy. Detail/dashboard counts use aggregation queries. The checked-in index file covers status/name, relation/name, status/relation/name and site/parent/name combinations. Emulators do not validate production index availability; indexes must be deployed and ready before cloud use.

Safe company profile extensions are optional contactEmail/contactPhone/address/country, plus editable name/timeZone and update metadata. Existing IDs, membership roles, system status, creation metadata and billing fields cannot be changed by this UI.

Phase 2 assets retain site/location/facility references. Quantity inventory and stock movements remain separate from individually tracked assets. Existing future-phase contracts are in `packages/shared/src/future.ts`; Phase 1 domain models and schemas are in `operations.ts`.
