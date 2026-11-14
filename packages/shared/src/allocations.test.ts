import { it, expect } from 'vitest';
import {
  allocationSlot,
  conflicts,
  reserveSlot,
  type OccupancySlot,
} from './allocations';
import { inputSchema, defaultValues } from './operations';
const first: OccupancySlot = {
  allocationId: 'one',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  allocationType: 'exclusive_occupancy',
};
it('treats date endpoints as inclusive and shared/exclusive as conflicting', () => {
  expect(
    conflicts(first, {
      ...first,
      allocationId: 'two',
      startDate: '2026-01-31',
    }),
  ).toBe(true);
  expect(
    conflicts(first, {
      ...first,
      allocationId: 'two',
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    }),
  ).toBe(false);
  expect(
    conflicts(
      { ...first, allocationType: 'shared_occupancy' },
      { ...first, allocationId: 'two', allocationType: 'shared_occupancy' },
    ),
  ).toBe(false);
});
it('only permits shortening a reserved interval, preserving other reservations', () => {
  expect(() =>
    reserveSlot([first], { ...first, endDate: '2026-02-01' }),
  ).toThrow();
  expect(reserveSlot([first], { ...first, endDate: '2026-01-15' })).toEqual([
    { ...first, endDate: '2026-01-15' },
  ]);
  expect(
    allocationSlot('one', {
      ...first,
      status: 'terminated',
      effectiveEndDate: '2026-01-15',
    }).endDate,
  ).toBe('2026-01-15');
});
it('requires a space and one-year interval only for occupancy', () => {
  const v = {
    ...defaultValues('contractAllocations'),
    code: 'A',
    name: 'Allocation',
    contractId: 'c',
    siteId: 's',
    startDate: '2026-01-01',
    endDate: '2027-12-31',
  };
  expect(inputSchema('contractAllocations').safeParse(v).success).toBe(true);
  expect(
    inputSchema('contractAllocations').safeParse({
      ...v,
      allocationType: 'exclusive_occupancy',
    }).success,
  ).toBe(false);
  expect(
    inputSchema('contractAllocations').safeParse({
      ...v,
      locationId: 'l',
      allocationType: 'exclusive_occupancy',
      endDate: '2026-12-31',
    }).success,
  ).toBe(true);
});
it('rejects new client/contract fields on physical site forms', () => {
  const v = { ...defaultValues('sites'), code: 'S', name: 'Independent site' };
  expect(inputSchema('sites').safeParse(v).success).toBe(true);
  expect(inputSchema('sites').safeParse({ ...v, clientId: 'c' }).success).toBe(
    false,
  );
});
