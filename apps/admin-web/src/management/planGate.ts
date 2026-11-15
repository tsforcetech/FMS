import { featureOn, featureLabels, type FeatureKey } from '@facilityos/shared';
import type { Context } from './context';

/**
 * Plan gates for the tenant apps. Writes that a plan limits are also enforced
 * by the security rules (quota counters, customer-portal entitlement); these
 * helpers explain the situation in the UI before the user hits a refusal.
 * Reads and exports of existing data are never blocked by an exceeded limit.
 */
export function readOnly(context: Context) {
  return context.company.status === 'read_only';
}
export function featureBlocked(context: Context, f: FeatureKey) {
  if (featureOn(context.company.plan?.features, f)) return undefined;
  return `${featureLabels[f]} is not included in your plan (${context.company.plan?.planName}). Contact Sharaco to upgrade.`;
}
/** Exports stay available even when the subscription is read-only. */
export const exportBlocked = (context: Context) =>
  featureBlocked(context, 'exports');
export const importBlocked = (context: Context) =>
  readOnly(context)
    ? 'Your subscription is read-only, so data cannot be imported.'
    : featureBlocked(context, 'imports');
