import { z } from 'zod';

/**
 * Units of measure and their fixed decimal precision. Quantities are persisted
 * as integers in the smallest unit (quantity × 10^decimals), so arithmetic is
 * exact and Firestore rules can verify balances with integer comparison.
 */
export const units: Record<string, { label: string; decimals: number }> = {
  each: { label: 'Each', decimals: 0 },
  box: { label: 'Box', decimals: 0 },
  pack: { label: 'Pack', decimals: 0 },
  carton: { label: 'Carton', decimals: 0 },
  pair: { label: 'Pair', decimals: 0 },
  set: { label: 'Set', decimals: 0 },
  roll: { label: 'Roll', decimals: 0 },
  bottle: { label: 'Bottle', decimals: 0 },
  kg: { label: 'Kilogram (kg)', decimals: 3 },
  g: { label: 'Gram (g)', decimals: 0 },
  litre: { label: 'Litre (L)', decimals: 3 },
  ml: { label: 'Millilitre (mL)', decimals: 0 },
  metre: { label: 'Metre (m)', decimals: 2 },
  sqm: { label: 'Square metre (m²)', decimals: 2 },
};
export const unitOptions = Object.keys(units);
export function unitDecimals(unit: string) {
  const u = units[unit];
  if (!u) throw new Error('Unknown unit of measure');
  return u.decimals;
}
/** Largest persisted minor-unit quantity (well inside IEEE-754 exact integers). */
export const MAX_MINOR_QUANTITY = 1_000_000_000_000;

/** Parses a typed decimal quantity into exact minor units, or returns an error message. */
export function parseQuantity(
  text: string,
  decimals: number,
): { ok: true; minor: number } | { ok: false; error: string } {
  const t = text.trim();
  const match = /^(0|[1-9][0-9]{0,11})(?:\.([0-9]+))?$/.exec(t);
  if (!match) return { ok: false, error: 'Enter a positive number' };
  const fraction = match[2] || '';
  if (fraction.length > decimals)
    return {
      ok: false,
      error:
        decimals === 0
          ? 'This unit only allows whole numbers'
          : `Use at most ${decimals} decimal places for this unit`,
    };
  const minor = Number(match[1] + fraction.padEnd(decimals, '0'));
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR_QUANTITY)
    return { ok: false, error: 'Quantity is too large' };
  return { ok: true, minor };
}
export function formatQuantity(minor: number, decimals: number) {
  const negative = minor < 0;
  const digits = String(Math.abs(minor)).padStart(decimals + 1, '0');
  const whole = decimals ? digits.slice(0, -decimals) : digits;
  const fraction = decimals ? digits.slice(-decimals) : '';
  return (
    (negative ? '-' : '') +
    Number(whole).toLocaleString('en-US') +
    (fraction ? '.' + fraction : '')
  );
}

export const movementTypes = [
  'opening',
  'receipt',
  'issue',
  'transfer',
  'adjustment_in',
  'adjustment_out',
  'reversal',
] as const;
export type MovementType = (typeof movementTypes)[number];
export const movementLabels: Record<MovementType, string> = {
  opening: 'Opening stock',
  receipt: 'Receipt',
  issue: 'Issue',
  transfer: 'Transfer',
  adjustment_in: 'Adjustment (increase)',
  adjustment_out: 'Adjustment (decrease)',
  reversal: 'Reversal',
};
/** Which store sides each movement type uses. */
export const movementSides: Record<
  Exclude<MovementType, 'reversal'>,
  { from: boolean; to: boolean }
> = {
  opening: { from: false, to: true },
  receipt: { from: false, to: true },
  issue: { from: true, to: false },
  transfer: { from: true, to: true },
  adjustment_in: { from: false, to: true },
  adjustment_out: { from: true, to: false },
};
export type MovementInput = {
  movementType: MovementType;
  materialId: string;
  fromStoreId: string;
  toStoreId: string;
  /** Exact minor-unit quantity (> 0). */
  quantity: number;
  movementDate: string;
  reason: string;
  reference: string;
  notes: string;
  issuedToEmployeeId: string;
  issuedToLocationId: string;
  reversesId: string;
};
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const optionalId = z.string().regex(/^[a-zA-Z0-9_-]{0,128}$/);
export const movementSchema = z
  .object({
    movementType: z.enum(movementTypes),
    materialId: id,
    fromStoreId: optionalId,
    toStoreId: optionalId,
    quantity: z.number().int().positive().max(MAX_MINOR_QUANTITY),
    movementDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (x) =>
          !isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x,
        'Enter a valid date',
      ),
    reason: z.string().max(500),
    reference: z.string().max(120),
    notes: z.string().max(2000),
    issuedToEmployeeId: optionalId,
    issuedToLocationId: optionalId,
    reversesId: optionalId,
  })
  .strict()
  .superRefine((m, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (m.movementType === 'reversal') {
      if (!m.reversesId) issue('reversesId', 'Choose the movement to reverse');
      if (!m.fromStoreId && !m.toStoreId)
        issue('fromStoreId', 'Reversal needs a store');
      return;
    }
    if (m.reversesId)
      issue('reversesId', 'Only reversals reference a movement');
    const sides = movementSides[m.movementType];
    if (sides.from && !m.fromStoreId)
      issue('fromStoreId', 'Choose a source store');
    if (!sides.from && m.fromStoreId)
      issue('fromStoreId', 'This transaction has no source store');
    if (sides.to && !m.toStoreId)
      issue('toStoreId', 'Choose a destination store');
    if (!sides.to && m.toStoreId)
      issue('toStoreId', 'This transaction has no destination store');
    if (m.fromStoreId && m.fromStoreId === m.toStoreId)
      issue('toStoreId', 'Choose a different destination store');
    if (
      ['adjustment_in', 'adjustment_out'].includes(m.movementType) &&
      !m.reason.trim()
    )
      issue('reason', 'Explain why the stock is being adjusted');
  });
/** Balance document ID for a store/material pair. */
export function balanceId(storeId: string, materialId: string) {
  return storeId + '_' + materialId;
}
/** Deterministic reversal ID: each movement can be reversed at most once. */
export function reversalId(movementId: string) {
  return 'REV-' + movementId;
}
export function movementEffects(m: {
  fromStoreId: string;
  toStoreId: string;
  quantity: number;
}) {
  return [
    ...(m.fromStoreId ? [{ storeId: m.fromStoreId, delta: -m.quantity }] : []),
    ...(m.toStoreId ? [{ storeId: m.toStoreId, delta: m.quantity }] : []),
  ];
}
export class InsufficientStockError extends Error {}
/** Applies a movement to current balances, rejecting any negative result. */
export function applyMovement(
  balances: Record<string, number>,
  m: { fromStoreId: string; toStoreId: string; quantity: number },
) {
  const next = { ...balances };
  for (const e of movementEffects(m)) {
    const value = (next[e.storeId] ?? 0) + e.delta;
    if (value < 0)
      throw new InsufficientStockError(
        'Not enough stock in the source store for this quantity.',
      );
    if (value > MAX_MINOR_QUANTITY)
      throw new Error('The resulting balance is too large.');
    next[e.storeId] = value;
  }
  return next;
}
/** Builds the reversal of a posted movement: same quantity, swapped stores. */
export function reversalOf(
  original: MovementInput & { id: string },
  movementDate: string,
  reason: string,
): MovementInput {
  if (original.movementType === 'reversal')
    throw new Error('A reversal cannot itself be reversed.');
  return {
    movementType: 'reversal',
    materialId: original.materialId,
    fromStoreId: original.toStoreId,
    toStoreId: original.fromStoreId,
    quantity: original.quantity,
    movementDate,
    reason,
    reference: original.reference,
    notes: '',
    issuedToEmployeeId: '',
    issuedToLocationId: '',
    reversesId: original.id,
  };
}
export function belowReorder(
  balanceMinor: number,
  reorderLevel: string,
  decimals: number,
) {
  if (!reorderLevel) return false;
  const level = parseQuantity(reorderLevel, decimals);
  return level.ok && balanceMinor <= level.minor;
}

/**
 * Application permissions. Only owner/admin can use the admin portal today;
 * the remaining rows are the prepared company/site/department-scoped model.
 * Roles are granted only by trusted provisioning, never from the browser.
 */
export const permissionAreas = [
  'Company settings',
  'Sites, locations & facilities',
  'Clients & contracts',
  'People & teams',
  'Assets & transfers',
  'Inventory masters',
  'Stock transactions',
  'User access & roles',
] as const;
export const rolePermissions: Record<
  string,
  { scope: string; enforced: boolean; access: Record<string, string> }
> = {
  owner: {
    scope: 'Company',
    enforced: true,
    access: Object.fromEntries(
      permissionAreas.map((a) => [
        a,
        a === 'User access & roles' ? 'View (trusted changes)' : 'Manage',
      ]),
    ),
  },
  admin: {
    scope: 'Company',
    enforced: true,
    access: Object.fromEntries(
      permissionAreas.map((a) => [
        a,
        a === 'User access & roles' ? 'View (trusted changes)' : 'Manage',
      ]),
    ),
  },
  site_manager: {
    scope: 'Assigned sites',
    enforced: false,
    access: {
      'Sites, locations & facilities': 'Manage assigned',
      'People & teams': 'View assigned',
      'Assets & transfers': 'Manage assigned',
      'Stock transactions': 'Post assigned',
    },
  },
  department_manager: {
    scope: 'Department',
    enforced: false,
    access: {
      'People & teams': 'Manage department',
      'Assets & transfers': 'View department',
    },
  },
  supervisor: {
    scope: 'Team / site',
    enforced: false,
    access: { 'People & teams': 'View team', 'Stock transactions': 'Request' },
  },
  technician: { scope: 'Own work', enforced: false, access: {} },
  staff: { scope: 'Own work', enforced: false, access: {} },
  viewer: {
    scope: 'Company',
    enforced: false,
    access: Object.fromEntries(permissionAreas.map((a) => [a, 'View'])),
  },
  customer: { scope: 'Customer portal', enforced: false, access: {} },
};
