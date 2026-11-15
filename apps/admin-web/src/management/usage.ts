import {
  doc,
  getDoc,
  serverTimestamp,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from 'firebase/firestore';
import {
  canAdd,
  limitKeys,
  type LimitKey,
  type Usage,
} from '@facilityos/shared';
import { UserError } from './store';

/**
 * Phase 8 plan quotas. Creating a quota-limited record bumps
 * companies/{c}/usage/counters in the same transaction; the security rules
 * refuse the create otherwise (once the company has a plan) and check the
 * new count against the plan limit, so two simultaneous creates cannot both
 * take the last slot. Archiving does not decrement here: the trusted usage
 * reconciliation (scripts/usage-reconcile.ts) recounts active records.
 */
export const isQuotaKind = (k: string): k is LimitKey =>
  (limitKeys as readonly string[]).includes(k);
const usageRef = (db: Firestore, c: string) =>
  doc(db, 'companies', c, 'usage', 'counters');
export type QuotaRead = { usage: DocumentSnapshot; company: DocumentSnapshot };
/** Read phase (must run before any transaction write). */
export async function readQuota(
  tx: Transaction,
  db: Firestore,
  c: string,
): Promise<QuotaRead> {
  const [usage, company] = await Promise.all([
    tx.get(usageRef(db, c)),
    tx.get(doc(db, 'companies', c)),
  ]);
  return { usage, company };
}
/** Write phase: checks the plan limit and bumps the counter. */
export function bumpQuota(
  tx: Transaction,
  q: QuotaRead,
  k: LimitKey,
  id: string,
) {
  const plan = q.company.data()?.plan as
    { limits?: Record<string, number> } | undefined;
  if (!q.usage.exists()) {
    if (plan)
      throw new UserError(
        'Usage counters are not set up for this company yet. Ask Sharaco support to reconcile usage.',
      );
    return; // no plan: unlimited, counters optional
  }
  const u = q.usage.data() as Usage & { revision: number };
  const check = canAdd(u, plan?.limits, k);
  if (!check.ok) throw new UserError(check.message);
  tx.update(q.usage.ref, {
    [k]: (u[k] || 0) + 1,
    last: `${k}/${id}`,
    revision: (u.revision || 0) + 1,
    updatedAt: serverTimestamp(),
  });
}
export async function getUsage(db: Firestore, c: string) {
  const s = await getDoc(usageRef(db, c));
  return s.exists()
    ? (s.data() as Usage & { revision: number; updatedAt?: unknown })
    : null;
}
