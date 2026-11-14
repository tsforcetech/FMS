import { createHash } from 'node:crypto';
export const fingerprint = (v) =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function planSiteMigration(siteId, site, contract, client, decision) {
  const base = {
    siteId,
    sourceHash: fingerprint(site),
    contractHash: contract ? fingerprint(contract) : null,
    legacy: {
      clientId: site.clientId || '',
      contractId: site.contractId || '',
    },
    action: 'REVIEW_REQUIRED',
    issues: [],
  };
  if (siteId.length > 121)
    return {
      ...base,
      issues: [
        'Site ID too long for deterministic legacy allocation ID; manual mapping required',
      ],
    };
  if (site.schemaVersion === 2) return { ...base, action: 'ALREADY_MIGRATED' };
  if (site.schemaVersion !== 1)
    return { ...base, issues: ['Unsupported site schema'] };
  if (site.clientId && !client)
    return { ...base, issues: ['Legacy client missing'] };
  if (site.contractId && (!contract || contract.clientId !== site.clientId))
    return {
      ...base,
      issues: ['Missing contract or mismatched legacy client'],
    };
  if (!decision) return base;
  if (decision.action === 'detach_only' && !site.contractId)
    return { ...base, action: 'DETACH_ONLY' };
  if (
    decision.action === 'draft_allocation' &&
    site.contractId &&
    ['service_coverage', 'exclusive_occupancy', 'shared_occupancy'].includes(
      decision.allocationType,
    )
  ) {
    if (contract.status !== 'active')
      return {
        ...base,
        issues: ['Contract must be active for a new draft allocation'],
      };
    const { startDate, endDate } = contract;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '') ||
      !Number.isFinite(Date.parse(startDate)) ||
      !Number.isFinite(Date.parse(endDate)) ||
      new Date(startDate).toISOString().slice(0, 10) !== startDate ||
      new Date(endDate).toISOString().slice(0, 10) !== endDate ||
      startDate > endDate
    )
      return { ...base, issues: ['Invalid contract dates'] };
    if (
      decision.allocationType !== 'service_coverage' &&
      (!decision.locationId || startDate.slice(0, 4) !== endDate.slice(0, 4))
    )
      return {
        ...base,
        issues: [
          'Occupancy needs a reviewed space and annual dates; manual migration required',
        ],
      };
    return {
      ...base,
      action: 'DRAFT_ALLOCATION',
      allocationId: 'legacy_' + siteId,
      allocation: {
        contractId: site.contractId,
        clientIdSnapshot: contract.clientId,
        siteId,
        locationId: decision.locationId || '',
        allocationType: decision.allocationType,
        startDate,
        endDate,
        status: 'draft',
        effectiveEndDate: '',
        code: 'MIG_' + fingerprint(siteId).slice(0, 24).toUpperCase(),
        name: ('Legacy allocation · ' + site.name).slice(0, 120),
        notes:
          'Reviewed legacy association; activation requires separate validation.',
      },
    };
  }
  return {
    ...base,
    issues: ['Decision does not match the legacy relationship'],
  };
}
