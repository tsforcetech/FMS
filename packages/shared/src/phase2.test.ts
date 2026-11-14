import { describe, it, expect } from 'vitest';
import {
  defaultValues,
  inputSchema,
  referencePaths,
  fieldsFor,
  kinds,
  definitions,
} from './operations';
describe('Phase 2 masters', () => {
  it('provides valid defaults and section/column metadata for every kind', () => {
    for (const k of kinds) {
      expect(fieldsFor(k).every((f) => f.section)).toBe(true);
      for (const c of definitions[k].columns)
        expect(fieldsFor(k).some((f) => f.key === c)).toBe(true);
    }
  });
  it('never asks a site for a client or contract', () => {
    expect(
      fieldsFor('sites').some((f) =>
        ['clientId', 'contractId'].includes(f.key),
      ),
    ).toBe(false);
    for (const k of ['assets', 'stores', 'shifts', 'employees'] as const)
      expect(
        fieldsFor(k).some(
          (f) => f.reference === 'clients' || f.reference === 'contracts',
        ),
      ).toBe(false);
  });
  it('validates employees with independent login association', () => {
    const v = {
      ...defaultValues('employees'),
      code: 'E001',
      name: 'Asha Rao',
      joiningDate: '2026-01-05',
      departmentId: 'd1',
      designationId: 'g1',
    };
    expect(inputSchema('employees').safeParse(v).success).toBe(true);
    expect(
      inputSchema('employees').safeParse({ ...v, linkedUid: 'abc/def' })
        .success,
    ).toBe(false);
    expect(
      inputSchema('employees').safeParse({ ...v, role: 'owner' }).success,
    ).toBe(false);
    expect(
      inputSchema('employees').safeParse({ ...v, departmentId: '' }).success,
    ).toBe(false);
  });
  it('counts only ownership references and releases ended assignments', () => {
    expect(
      referencePaths('employees', {
        status: 'active',
        departmentId: 'd',
        designationId: 'g',
        supervisorId: 'e2',
        primarySiteId: 's',
      }),
    ).toEqual(['departments/d', 'designations/g']);
    expect(
      referencePaths('assets', {
        status: 'in_service',
        categoryId: 'c',
        siteId: 's',
        locationId: 'l',
        supplierId: 'p',
        custodianId: '',
        departmentId: 'd',
        facilityId: 'f',
      }),
    ).toEqual(['assetCategories/c', 'locations/l']);
    expect(
      referencePaths('teamMembers', {
        status: 'ended',
        teamId: 't',
        employeeId: 'e',
      }),
    ).toEqual([]);
    expect(
      referencePaths('teamMembers', {
        status: 'active',
        teamId: 't',
        employeeId: 'e',
      }),
    ).toEqual(['teams/t', 'employees/e']);
  });
  it('enforces asset tracking, batch, cost and warranty rules', () => {
    const v = {
      ...defaultValues('assets'),
      code: 'AC-1',
      name: 'Chiller',
      categoryId: 'c',
      siteId: 's',
      locationId: 'l',
    };
    const s = inputSchema('assets');
    expect(s.safeParse(v).success).toBe(true);
    expect(s.safeParse({ ...v, quantity: '3' }).success).toBe(false);
    expect(
      s.safeParse({ ...v, trackingMode: 'batch', quantity: '40' }).success,
    ).toBe(true);
    expect(
      s.safeParse({
        ...v,
        trackingMode: 'batch',
        quantity: '40',
        serialNumber: 'X',
      }).success,
    ).toBe(false);
    expect(s.safeParse({ ...v, purchaseCost: '12.345' }).success).toBe(false);
    expect(
      s.safeParse({
        ...v,
        purchaseDate: '2026-02-01',
        warrantyEndDate: '2026-01-01',
      }).success,
    ).toBe(false);
  });
  it('supports overnight shifts and ended assignments need an end date', () => {
    const shift = {
      ...defaultValues('shifts'),
      code: 'NIGHT',
      name: 'Night',
      siteId: 's',
      startTime: '22:00',
      endTime: '06:00',
      workingDays: 'Mon,Tue',
    };
    expect(inputSchema('shifts').safeParse(shift).success).toBe(true);
    expect(
      inputSchema('shifts').safeParse({ ...shift, endTime: '22:00' }).success,
    ).toBe(false);
    expect(
      inputSchema('shifts').safeParse({ ...shift, breakMinutes: '700' })
        .success,
    ).toBe(false);
    const member = {
      ...defaultValues('teamMembers'),
      code: 'TM1',
      name: 'x',
      teamId: 't',
      employeeId: 'e',
      startDate: '2026-01-01',
    };
    expect(inputSchema('teamMembers').safeParse(member).success).toBe(true);
    expect(
      inputSchema('teamMembers').safeParse({ ...member, status: 'ended' })
        .success,
    ).toBe(false);
    expect(
      inputSchema('teamMembers').safeParse({
        ...member,
        status: 'ended',
        endDate: '2026-03-01',
      }).success,
    ).toBe(true);
  });
});
