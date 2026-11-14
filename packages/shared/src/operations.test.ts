import { describe, it, expect } from 'vitest';
import { defaultValues, inputSchema, referencePaths } from './operations';
describe('operational form validation', () => {
  it('rejects impossible contract dates and reversed ranges', () => {
    const base = {
      ...defaultValues('contracts'),
      code: 'C1',
      name: 'Contract',
      clientId: 'client',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };
    expect(inputSchema('contracts').safeParse(base).success).toBe(true);
    for (const endDate of ['2026-02-31', '2025-12-31', 'bad'])
      expect(
        inputSchema('contracts').safeParse({ ...base, endDate }).success,
      ).toBe(false);
  });
  it('requires a supported time zone and valid working days', () => {
    const base = {
      ...defaultValues('sites'),
      code: 'S1',
      name: 'Site',
    };
    expect(inputSchema('sites').safeParse(base).success).toBe(true);
    expect(
      inputSchema('sites').safeParse({ ...base, timeZone: 'Unknown/Place' })
        .success,
    ).toBe(false);
    expect(
      inputSchema('sites').safeParse({ ...base, workingDays: 'Monday' })
        .success,
    ).toBe(false);
    expect(
      inputSchema('sites').safeParse({ ...base, workingDays: 'Mon,Tue,Wed' })
        .success,
    ).toBe(true);
  });
  it('uses direct ownership references without double-counting ancestors', () => {
    expect(
      referencePaths('facilities', {
        status: 'active',
        siteId: 's',
        locationId: 'l',
        typeId: 't',
      }),
    ).toEqual(['locations/l', 'facilityTypes/t']);
    expect(
      referencePaths('locations', {
        status: 'active',
        siteId: 's',
        parentId: 'p',
      }),
    ).toEqual(['locations/p']);
    expect(
      referencePaths('locations', {
        status: 'active',
        siteId: 's',
        parentId: '',
      }),
    ).toEqual(['sites/s']);
    expect(
      referencePaths('locations', {
        status: 'archived',
        siteId: 's',
        parentId: 'p',
      }),
    ).toEqual([]);
  });
  it('rejects unknown fields and malformed business codes', () => {
    const base = { ...defaultValues('clients'), code: 'CL1', name: 'Client' };
    expect(
      inputSchema('clients').safeParse({ ...base, role: 'owner' }).success,
    ).toBe(false);
    expect(
      inputSchema('clients').safeParse({ ...base, code: 'bad/code' }).success,
    ).toBe(false);
    expect(
      inputSchema('clients').safeParse({ ...base, email: 'bad' }).success,
    ).toBe(false);
  });
});
