import { describe, it, expect } from 'vitest';
import {
  parseQuantity,
  formatQuantity,
  applyMovement,
  movementSchema,
  reversalOf,
  belowReorder,
  InsufficientStockError,
  unitDecimals,
  type MovementInput,
} from './inventory';
const base: MovementInput = {
  movementType: 'receipt',
  materialId: 'm1',
  fromStoreId: '',
  toStoreId: 's1',
  quantity: 1000,
  movementDate: '2026-11-14',
  reason: '',
  reference: 'GRN-1',
  notes: '',
  issuedToEmployeeId: '',
  issuedToLocationId: '',
  reversesId: '',
};
describe('exact inventory quantities', () => {
  it('parses decimals into exact minor units without floating point drift', () => {
    expect(parseQuantity('0.1', 3)).toEqual({ ok: true, minor: 100 });
    expect(parseQuantity('2.25', 2)).toEqual({ ok: true, minor: 225 });
    expect(parseQuantity('12', 0)).toEqual({ ok: true, minor: 12 });
    expect(parseQuantity('1.5', 0).ok).toBe(false);
    expect(parseQuantity('1.2345', 3).ok).toBe(false);
    expect(parseQuantity('-1', 0).ok).toBe(false);
    expect(parseQuantity('1e3', 0).ok).toBe(false);
    expect(parseQuantity('9999999999999', 0).ok).toBe(false);
    let total = 0;
    for (let i = 0; i < 10; i++)
      total += (parseQuantity('0.1', 3) as { minor: number }).minor;
    expect(formatQuantity(total, 3)).toBe('1.000');
  });
  it('formats minor units for display', () => {
    expect(formatQuantity(1234567, 3)).toBe('1,234.567');
    expect(formatQuantity(5, 2)).toBe('0.05');
    expect(formatQuantity(42, 0)).toBe('42');
    expect(unitDecimals('kg')).toBe(3);
    expect(() => unitDecimals('bags')).toThrow();
  });
  it('rejects negative balances and conserves stock on transfer', () => {
    const after = applyMovement(
      { a: 500, b: 0 },
      { fromStoreId: 'a', toStoreId: 'b', quantity: 200 },
    );
    expect(after).toEqual({ a: 300, b: 200 });
    expect(after.a + after.b).toBe(500);
    expect(() =>
      applyMovement(
        { a: 100 },
        { fromStoreId: 'a', toStoreId: '', quantity: 101 },
      ),
    ).toThrow(InsufficientStockError);
  });
  it('validates store sides, reasons and reversal links per transaction type', () => {
    expect(movementSchema.safeParse(base).success).toBe(true);
    expect(movementSchema.safeParse({ ...base, toStoreId: '' }).success).toBe(
      false,
    );
    expect(
      movementSchema.safeParse({ ...base, movementType: 'issue' }).success,
    ).toBe(false);
    expect(
      movementSchema.safeParse({
        ...base,
        movementType: 'transfer',
        fromStoreId: 's1',
      }).success,
    ).toBe(false);
    expect(
      movementSchema.safeParse({ ...base, movementType: 'adjustment_in' })
        .success,
    ).toBe(false);
    expect(
      movementSchema.safeParse({
        ...base,
        movementType: 'adjustment_in',
        reason: 'Cycle count',
      }).success,
    ).toBe(true);
    expect(movementSchema.safeParse({ ...base, quantity: 0 }).success).toBe(
      false,
    );
    expect(movementSchema.safeParse({ ...base, quantity: 1.5 }).success).toBe(
      false,
    );
    expect(
      movementSchema.safeParse({ ...base, movementDate: '2026-02-30' }).success,
    ).toBe(false);
  });
  it('builds reversals with swapped stores and forbids reversing reversals', () => {
    const r = reversalOf({ ...base, id: 'mv1' }, '2026-11-15', 'Wrong store');
    expect(r).toMatchObject({
      movementType: 'reversal',
      fromStoreId: 's1',
      toStoreId: '',
      quantity: 1000,
      reversesId: 'mv1',
    });
    expect(movementSchema.safeParse(r).success).toBe(true);
    expect(() => reversalOf({ ...r, id: 'x' }, '2026-11-15', '')).toThrow();
  });
  it('flags balances at or below the reorder level', () => {
    expect(belowReorder(5000, '5', 3)).toBe(true);
    expect(belowReorder(5001, '5', 3)).toBe(false);
    expect(belowReorder(0, '', 0)).toBe(false);
  });
});
