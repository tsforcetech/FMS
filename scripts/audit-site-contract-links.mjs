#!/usr/bin/env node
/**
 * Read-only legacy Site/Contract relationship audit.
 *
 * Requires explicitly selected project and company, plus trusted ADC.
 * Does not create, update or delete Firestore documents.
 * Usage:
 *   node scripts/audit-site-contract-links.mjs --project PROJECT_ID --company COMPANY_ID
 *
 * NEVER use this script as a live migration. Proposed associations always
 * require human review of service vs occupancy and effective dates.
 */
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

function arg(name) {
  const index = process.argv.indexOf('--' + name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const project = arg('project');
const company = arg('company');
if (
  !project ||
  !company ||
  !/^[a-zA-Z0-9_-]{1,128}$/.test(company) ||
  !/^[a-z][a-z0-9-]{4,100}$/.test(project)
) {
  console.error(
    'Provide --project PROJECT_ID --company COMPANY_ID. Refusing implicit project selection.',
  );
  process.exit(2);
}
if (project.startsWith('demo-')) {
  console.error(
    'Demo/emulator project IDs are not accepted by this live audit.',
  );
  process.exit(2);
}
admin.initializeApp({ projectId: project });
const db = getFirestore();
const companyRef = db.doc(`companies/${company}`);
const parent = await companyRef.get();
if (!parent.exists)
  throw new Error('Company does not exist in selected project');
const sites = await companyRef.collection('sites').get();
const proposed = [];
const mismatches = [];
const noContract = [];
const orphanedClients = [];
const refs = new Map();
async function load(kind, id) {
  const key = kind + ':' + id;
  if (!refs.has(key)) refs.set(key, companyRef.collection(kind).doc(id).get());
  return refs.get(key);
}
for (const site of sites.docs) {
  const row = site.data();
  const siteId = site.id;
  const legacyClientId = row.clientId || '';
  const legacyContractId = row.contractId || '';
  if (legacyClientId) {
    const client = await load('clients', legacyClientId);
    if (!client.exists)
      orphanedClients.push({
        siteId,
        clientId: legacyClientId,
        reason: 'client_not_found',
      });
  }
  if (!legacyContractId) {
    noContract.push({
      siteId,
      legacyClientId,
      note: 'No allocation can be inferred',
    });
    continue;
  }
  const contract = await load('contracts', legacyContractId);
  if (!contract.exists) {
    mismatches.push({
      siteId,
      contractId: legacyContractId,
      reason: 'contract_not_found',
    });
    continue;
  }
  const v = contract.data();
  if (!v.clientId || v.clientId !== legacyClientId) {
    mismatches.push({
      siteId,
      contractId: legacyContractId,
      clientId: legacyClientId,
      contractClientId: v.clientId || '',
      reason: 'client_mismatch',
    });
    continue;
  }
  if (v.startDate > v.endDate || !v.startDate || !v.endDate) {
    mismatches.push({
      siteId,
      contractId: legacyContractId,
      reason: 'invalid_contract_dates',
    });
    continue;
  }
  proposed.push({
    siteId,
    contractId: legacyContractId,
    clientIdDerivedFromContract: v.clientId,
    startDateProposal: v.startDate,
    endDateProposal: v.endDate,
    allocationType: 'REVIEW_REQUIRED',
    locationId: 'REVIEW_REQUIRED',
    status: 'NOT_CREATED',
    note: 'Legacy site-level contract link is not proof of tenancy, exclusivity or service scope',
  });
}
const report = {
  project,
  company,
  auditType: 'READ_ONLY_NO_WRITES',
  generatedAt: new Date().toISOString(),
  counts: {
    totalSites: sites.size,
    reviewRequiredContractLinks: proposed.length,
    siteWithoutContract: noContract.length,
    inconsistentContractLinks: mismatches.length,
    missingLegacyClients: orphanedClients.length,
  },
  proposed,
  noContract,
  mismatches,
  orphanedClients,
  nextAction:
    'Owner reviews each proposal. Never automatically migrate or remove legacy fields.',
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
