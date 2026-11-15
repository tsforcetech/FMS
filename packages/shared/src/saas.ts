/**
 * Phase 8 SaaS model: plans, plan versions, subscriptions, entitlements and
 * lifecycle. Pure functions shared by the platform console, the tenant admin
 * and the security tests. Prices are never invented: a plan version carries
 * an optional list price entered by Sharaco, and revenue figures are computed
 * only from invoice records marked paid.
 */
export const limitKeys = [
  'sites',
  'employees',
  'assets',
  'recurringSchedules',
  'staffLinks',
] as const;
export type LimitKey = (typeof limitKeys)[number];
export const limitLabels: Record<LimitKey, string> = {
  sites: 'Sites',
  employees: 'Employees',
  assets: 'Assets',
  recurringSchedules: 'Recurring schedules',
  staffLinks: 'Staff logins',
};
export const featureKeys = [
  'customerPortal',
  'mobileApp',
  'advancedReports',
  'exports',
  'imports',
] as const;
export type FeatureKey = (typeof featureKeys)[number];
export const featureLabels: Record<FeatureKey, string> = {
  customerPortal: 'Customer portal',
  mobileApp: 'Mobile app',
  advancedReports: 'Advanced reports',
  exports: 'Excel/PDF export',
  imports: 'Bulk import',
};
export type PlanTerms = {
  /** -1 = unlimited. */
  limits: Record<LimitKey, number>;
  features: Record<FeatureKey, boolean>;
  trialDays: number;
  supportLevel: 'standard' | 'priority' | 'dedicated';
  billingPeriod: 'monthly' | 'annual';
  /** Optional list price entered by Sharaco (never inferred). */
  price: { amount: number; currency: string } | null;
};
export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string;
  status: 'active' | 'retired';
  currentVersion: number;
};
export type PlanVersion = {
  id: string;
  planId: string;
  version: number;
  terms: PlanTerms;
};
export const planVersionId = (planId: string, version: number) =>
  `${planId}_v${version}`;

/** Example starting points for Sharaco to edit — not commercial offers. */
export const examplePlans: { code: string; name: string; terms: PlanTerms }[] =
  [
    {
      code: 'TRIAL',
      name: 'Trial',
      terms: {
        limits: {
          sites: 2,
          employees: 25,
          assets: 200,
          recurringSchedules: 20,
          staffLinks: 10,
        },
        features: {
          customerPortal: true,
          mobileApp: true,
          advancedReports: true,
          exports: true,
          imports: true,
        },
        trialDays: 30,
        supportLevel: 'standard',
        billingPeriod: 'monthly',
        price: null,
      },
    },
    {
      code: 'STARTER',
      name: 'Starter',
      terms: {
        limits: {
          sites: 3,
          employees: 50,
          assets: 1000,
          recurringSchedules: 50,
          staffLinks: 25,
        },
        features: {
          customerPortal: false,
          mobileApp: true,
          advancedReports: false,
          exports: true,
          imports: true,
        },
        trialDays: 0,
        supportLevel: 'standard',
        billingPeriod: 'monthly',
        price: null,
      },
    },
    {
      code: 'PROFESSIONAL',
      name: 'Professional',
      terms: {
        limits: {
          sites: 15,
          employees: 300,
          assets: 10000,
          recurringSchedules: 300,
          staffLinks: 150,
        },
        features: {
          customerPortal: true,
          mobileApp: true,
          advancedReports: true,
          exports: true,
          imports: true,
        },
        trialDays: 0,
        supportLevel: 'priority',
        billingPeriod: 'monthly',
        price: null,
      },
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise',
      terms: {
        limits: {
          sites: -1,
          employees: -1,
          assets: -1,
          recurringSchedules: -1,
          staffLinks: -1,
        },
        features: {
          customerPortal: true,
          mobileApp: true,
          advancedReports: true,
          exports: true,
          imports: true,
        },
        trialDays: 0,
        supportLevel: 'dedicated',
        billingPeriod: 'annual',
        price: null,
      },
    },
  ];

/* ============================================================ subscriptions */
export const subscriptionStatuses = [
  'trial',
  'active',
  'renewal_due',
  'grace',
  'past_due',
  'suspended',
  'cancelled',
  'expired',
] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];
export type Subscription = {
  companyId: string;
  companyName: string;
  planId: string;
  versionId: string;
  planName: string;
  terms: PlanTerms;
  /** Explicit administrative state; dates decide the rest. */
  state: 'running' | 'suspended' | 'cancelled';
  trialEndsAt: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  graceDays: number;
  revision: number;
};
export const day = 86400000;
/**
 * Effective status from the administrative state and dates:
 * trial → active → renewal_due (14 days before end) → grace (after end, for
 * graceDays) → past_due → expired (30 days after grace).
 */
export function statusOf(
  s: Pick<Subscription, 'state' | 'trialEndsAt' | 'periodEnd' | 'graceDays'>,
  now = new Date(),
): SubscriptionStatus {
  if (s.state === 'cancelled') return 'cancelled';
  if (s.state === 'suspended') return 'suspended';
  if (s.trialEndsAt && !s.periodEnd) {
    if (now < s.trialEndsAt) return 'trial';
    return now.getTime() < s.trialEndsAt.getTime() + 30 * day
      ? 'past_due'
      : 'expired';
  }
  if (!s.periodEnd) return 'active';
  const end = s.periodEnd.getTime(),
    t = now.getTime();
  if (t < end - 14 * day) return 'active';
  if (t < end) return 'renewal_due';
  if (t < end + s.graceDays * day) return 'grace';
  if (t < end + (s.graceDays + 30) * day) return 'past_due';
  return 'expired';
}
/**
 * Access policy. Data is never deleted; suspended, cancelled and expired
 * companies keep read (and export) access but cannot write.
 */
export function accessFor(status: SubscriptionStatus): 'full' | 'read_only' {
  return ['suspended', 'cancelled', 'expired'].includes(status)
    ? 'read_only'
    : 'full';
}
/** Snapshot written onto companies/{id}.plan — what the security rules read. */
export function planSnapshot(s: Subscription, now = new Date()) {
  const status = statusOf(s, now);
  return {
    planId: s.planId,
    versionId: s.versionId,
    planName: s.planName,
    status,
    access: accessFor(status),
    limits: { ...s.terms.limits },
    features: { ...s.terms.features },
  };
}

export type LifecycleAction =
  | 'assign'
  | 'extend_trial'
  | 'renew'
  | 'change_plan'
  | 'suspend'
  | 'reactivate'
  | 'cancel';
export class LifecycleError extends Error {}
/** Applies an administrative action and returns the next subscription. */
export function applyAction(
  s: Subscription,
  action: LifecycleAction,
  input: {
    days?: number;
    version?: PlanVersion & { planName: string };
    now?: Date;
  } = {},
): Subscription {
  const now = input.now || new Date();
  const status = statusOf(s, now);
  const next = { ...s, revision: s.revision + 1 };
  switch (action) {
    case 'extend_trial': {
      if (status !== 'trial' && status !== 'past_due')
        throw new LifecycleError('Only trials can be extended.');
      const d = input.days || 0;
      if (d < 1 || d > 90)
        throw new LifecycleError('Extend a trial by 1 to 90 days.');
      const base = Math.max(
        now.getTime(),
        s.trialEndsAt?.getTime() || now.getTime(),
      );
      return { ...next, trialEndsAt: new Date(base + d * day) };
    }
    case 'renew': {
      if (s.state !== 'running')
        throw new LifecycleError(
          'Reactivate the subscription before renewing.',
        );
      const months = s.terms.billingPeriod === 'annual' ? 12 : 1;
      const from = s.periodEnd && s.periodEnd > now ? s.periodEnd : now;
      const end = new Date(from);
      end.setUTCMonth(end.getUTCMonth() + months);
      return { ...next, trialEndsAt: null, periodStart: from, periodEnd: end };
    }
    case 'change_plan': {
      if (!input.version) throw new LifecycleError('Choose a plan version.');
      return {
        ...next,
        planId: input.version.planId,
        versionId: input.version.id,
        planName: input.version.planName,
        terms: input.version.terms,
      };
    }
    case 'suspend':
      if (s.state === 'cancelled')
        throw new LifecycleError('The subscription is cancelled.');
      return { ...next, state: 'suspended' };
    case 'reactivate':
      if (s.state === 'running')
        throw new LifecycleError('The subscription is already running.');
      return { ...next, state: 'running' };
    case 'cancel':
      return { ...next, state: 'cancelled' };
    default:
      throw new LifecycleError('Unknown action.');
  }
}
export function newSubscription(
  company: { id: string; name: string },
  v: PlanVersion & { planName: string },
  now = new Date(),
): Subscription {
  const trial = v.terms.trialDays > 0;
  const end = new Date(now);
  end.setUTCMonth(
    end.getUTCMonth() + (v.terms.billingPeriod === 'annual' ? 12 : 1),
  );
  return {
    companyId: company.id,
    companyName: company.name,
    planId: v.planId,
    versionId: v.id,
    planName: v.planName,
    terms: v.terms,
    state: 'running',
    trialEndsAt: trial
      ? new Date(now.getTime() + v.terms.trialDays * day)
      : null,
    periodStart: trial ? null : now,
    periodEnd: trial ? null : end,
    graceDays: 7,
    revision: 1,
  };
}

/* ============================================================ entitlements */
export type Usage = Record<LimitKey, number>;
/** Limits the current usage would exceed under other terms (for downgrades). */
export function overLimits(usage: Usage, terms: PlanTerms) {
  return limitKeys.filter(
    (k) => terms.limits[k] >= 0 && usage[k] > terms.limits[k],
  );
}
export function canAdd(
  usage: Usage,
  limits: Partial<Record<LimitKey, number>> | undefined,
  k: LimitKey,
) {
  const limit = limits?.[k] ?? -1;
  const used = usage[k] || 0;
  return {
    ok: limit < 0 || used + 1 <= limit,
    used,
    limit,
    message:
      limit >= 0 && used + 1 > limit
        ? `Your plan allows ${limit} ${limitLabels[k].toLowerCase()}. Archive unused records or ask Sharaco to upgrade your plan. Existing data stays available.`
        : '',
  };
}
export function featureOn(
  features: Partial<Record<FeatureKey, boolean>> | undefined,
  f: FeatureKey,
) {
  return features?.[f] !== false;
}

/* ============================================================ invoices & revenue */
export type Invoice = {
  id: string;
  companyId: string;
  number: string;
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  status: 'draft' | 'issued' | 'paid' | 'void';
  source: 'manual' | 'provider';
  paidAt: Date | null;
};
/**
 * Monthly recurring revenue from paid invoices whose service period covers
 * `at`, normalised to a month. Trials (no invoice) and unpaid invoices never
 * count. Returned per currency — currencies are not converted.
 */
export function recurringRevenue(invoices: Invoice[], at = new Date()) {
  const mrr: Record<string, number> = {};
  for (const i of invoices) {
    if (i.status !== 'paid' || i.periodStart > at || i.periodEnd <= at)
      continue;
    const months = Math.max(
      1,
      Math.round(
        (i.periodEnd.getTime() - i.periodStart.getTime()) / (30.44 * day),
      ),
    );
    mrr[i.currency] =
      Math.round(((mrr[i.currency] || 0) + i.amount / months) * 100) / 100;
  }
  return {
    mrr,
    arr: Object.fromEntries(
      Object.entries(mrr).map(([c, v]) => [c, Math.round(v * 12 * 100) / 100]),
    ),
  };
}
export const platformRoles = ['owner', 'billing', 'support', 'viewer'] as const;
export type PlatformRole = (typeof platformRoles)[number];
export const platformRoleLabels: Record<PlatformRole, string> = {
  owner: 'Platform owner',
  billing: 'Billing administrator',
  support: 'Support',
  viewer: 'Read-only viewer',
};
