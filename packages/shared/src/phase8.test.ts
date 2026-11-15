import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import {
  safeText,
  prepareTable,
  visibleColumns,
  buildCsv,
  needsUnicodeFont,
  type ExportColumn,
  type ExportMeta,
} from './exporting';
import { buildXlsx, buildPdf } from './exportFiles';
import {
  parseCsv,
  checkFile,
  readXlsx,
  autoMap,
  classifyRows,
  summarize,
  importColumns,
  templateRows,
  ImportFileError,
} from './importing';
import {
  statusOf,
  accessFor,
  applyAction,
  newSubscription,
  planSnapshot,
  canAdd,
  overLimits,
  recurringRevenue,
  examplePlans,
  day,
  type Invoice,
} from './saas';
import {
  setupProgress,
  starterPacks,
  onboardingSteps,
  stepDone,
} from './onboarding';

const cols: ExportColumn[] = [
  { key: 'code', label: 'Code', type: 'text' },
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'due', label: 'Due', type: 'datetime' },
  { key: 'amount', label: 'Amount', type: 'money', total: true },
  { key: 'phone', label: 'Phone', type: 'text', sensitive: true },
  { key: 'internal', label: 'Internal note', type: 'text', internal: true },
];
const meta: ExportMeta = {
  title: 'Maintenance costs',
  companyName: 'GBH',
  period: '1 Nov 2026 – 15 Nov 2026',
  filters: [{ label: 'Site', value: 'Muteena' }],
  generatedAt: new Date('2026-11-15T08:00:00Z'),
  timeZone: 'Asia/Dubai',
};
const rows = [
  {
    code: 'A1',
    name: '=HYPERLINK("http://evil","x")',
    due: new Date('2026-11-02T06:00:00Z'),
    amount: 100.5,
    phone: '050',
    internal: 'secret',
  },
  {
    code: 'A2',
    name: '+cmd|calc',
    due: '2026-11-03',
    amount: '200.25',
    phone: '051',
    internal: 'x',
  },
  {
    code: 'A3',
    name: 'Normal',
    due: null,
    amount: null,
    phone: '',
    internal: '',
  },
];

describe('export engine', () => {
  it('neutralises formula injection', () => {
    for (const s of ['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])
      expect(safeText(s).startsWith("'")).toBe(true);
    expect(safeText('Normal')).toBe('Normal');
  });
  it('drops sensitive and internal columns by audience', () => {
    expect(
      visibleColumns(cols, { audience: 'admin' }).map((c) => c.key),
    ).toEqual(['code', 'name', 'due', 'amount', 'internal']);
    expect(
      visibleColumns(cols, { audience: 'admin', canSeeSensitive: true }).map(
        (c) => c.key,
      ),
    ).toContain('phone');
    expect(
      visibleColumns(cols, { audience: 'customer', canSeeSensitive: true }).map(
        (c) => c.key,
      ),
    ).toEqual(['code', 'name', 'due', 'amount']);
    expect(
      visibleColumns(cols, {
        audience: 'admin',
        selected: ['code', 'amount'],
      }).map((c) => c.key),
    ).toEqual(['code', 'amount']);
  });
  it('types cells and computes totals from the rows only', () => {
    const t = prepareTable(rows, visibleColumns(cols, { audience: 'admin' }));
    expect(t.rows[0][1]).toBe('\'=HYPERLINK("http://evil","x")');
    expect(t.rows[1][3]).toBe(200.25);
    expect(t.rows[1][2]).toBeInstanceOf(Date);
    expect(t.rows[2][3]).toBeNull();
    expect(t.totals![3]).toBe(300.75);
    expect(buildCsv(t, 'Asia/Dubai')).toContain("'+cmd|calc");
  });
  it('writes a real xlsx with typed cells, frozen header, filter and totals', async () => {
    const t = prepareTable(rows, visibleColumns(cols, { audience: 'admin' }));
    const bytes = await buildXlsx(meta, t, { primaryColor: '#0F766E' });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).getCell(1).value).toBe('Code');
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
    expect(ws.getRow(2).getCell(2).value).toBe(
      '\'=HYPERLINK("http://evil","x")',
    );
    expect(typeof ws.getRow(2).getCell(2).value).toBe('string'); // never a formula object
    expect(ws.getRow(3).getCell(4).value).toBe(200.25);
    expect(ws.getRow(2).getCell(3).value).toBeInstanceOf(Date);
    // 06:00Z is 10:00 in Dubai — Excel shows company local time.
    expect((ws.getRow(2).getCell(3).value as Date).getUTCHours()).toBe(10);
    expect(ws.getRow(5).getCell(4).value).toBe(300.75);
    expect(wb.worksheets[1].name).toBe('Report details');
  });
  it('writes a multi-page PDF with every row', async () => {
    const many = Array.from({ length: 4000 }, (_, i) => ({
      code: `R${i}`,
      name: `Row ${i}`,
      due: new Date(),
      amount: 1,
      phone: '',
      internal: '',
    }));
    const t = prepareTable(many, visibleColumns(cols, { audience: 'admin' }));
    const bytes = await buildPdf(meta, t);
    const text = Buffer.from(bytes).toString('latin1');
    expect(text.startsWith('%PDF')).toBe(true);
    const pages = (text.match(/\/Type \/Page[^s]/g) || []).length;
    expect(pages).toBeGreaterThan(50);
    expect(text).toContain('R3999');
  }, 60000);
  it('embeds a Unicode font only when the text needs one', async () => {
    const t = prepareTable(
      [{ code: 'A', name: 'Ελληνικά Кириллица', due: null, amount: 1 }],
      cols.slice(0, 4),
    );
    expect(needsUnicodeFont(t, meta)).toBe(true);
    const font = () =>
      Promise.resolve({
        regular: readFileSync(
          new URL('../assets/DejaVuSans.ttf', import.meta.url),
        ).toString('base64'),
      });
    const bytes = await buildPdf(meta, t, {}, font);
    expect(Buffer.from(bytes).toString('latin1')).toContain('Unicode');
  });
});

describe('import engine', () => {
  const ctx = () => ({
    existing: new Map([
      [
        'DEP-OLD',
        {
          id: 'd1',
          values: {
            code: 'DEP-OLD',
            name: 'Old',
            notes: '',
            status: 'active',
            parentId: '',
            siteId: '',
            managerId: '',
            description: '',
          },
        },
      ],
    ]),
    refs: {
      sites: new Map([['SITE-1', 's1']]),
      departments: new Map([['DEP-OLD', 'd1']]),
      employees: new Map(),
    },
  });
  it('parses CSV with quotes, commas, CRLF and BOM', () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","he said ""hi"""\r\n\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
    ]);
    expect(() => parseCsv('a,"b')).toThrow(ImportFileError);
  });
  it('rejects invalid files', () => {
    expect(() => checkFile('a.xls', new Uint8Array([1]))).toThrow(/xlsx/);
    expect(() =>
      checkFile('a.xlsx', new TextEncoder().encode('code,name')),
    ).toThrow(/not a valid Excel/);
    expect(() =>
      checkFile('a.csv', new Uint8Array([0x50, 0x4b, 3, 4])),
    ).toThrow(/not a text CSV/);
    expect(() => checkFile('a.csv', new Uint8Array(6 * 1024 * 1024))).toThrow(
      /5 MB/,
    );
    expect(checkFile('a.CSV', new TextEncoder().encode('a'))).toBe('csv');
  });
  it('classifies new, match, update, duplicate and invalid rows by exact code', () => {
    const data = [
      ['Code', 'Name', 'Site (code)', 'Status'],
      ['dep-new', 'Housekeeping', 'SITE-1', 'active'],
      ['DEP-OLD', 'Old', '', 'active'],
      ['DEP-OLD2', 'X', 'NO-SUCH', 'active'],
      ['dep-new', 'Again', '', 'active'],
      ['', '', '', ''],
      ['DEP-UPD', '', '', 'active'],
    ];
    const map = autoMap('departments', data[0]);
    expect(map).toMatchObject({ code: 0, name: 1, siteId: 2, status: 3 });
    const out = classifyRows('departments', data.slice(1), map, ctx());
    expect(out.map((r) => r.status)).toEqual([
      'new',
      'match',
      'invalid',
      'duplicate',
      'skipped',
      'invalid',
    ]);
    expect(out[0].values).toMatchObject({ code: 'DEP-NEW', siteId: 's1' });
    expect(out[2].errors.join()).toMatch(/no site with code/);
    expect(out[5].errors.join()).toMatch(/Name/);
    expect(out[0].row).toBe(2);
    const c2 = ctx();
    const upd = classifyRows(
      'departments',
      [['DEP-OLD', 'Renamed', '', 'active']],
      map,
      c2,
    );
    expect(upd[0]).toMatchObject({
      status: 'update',
      id: 'd1',
      changes: ['name'],
    });
    expect(summarize(out)).toMatchObject({
      new: 1,
      match: 1,
      invalid: 2,
      duplicate: 1,
      skipped: 1,
    });
  });
  it('never matches existing records by name', () => {
    const out = classifyRows(
      'departments',
      [['DEP-OTHER', 'Old', '', 'active']],
      { code: 0, name: 1, siteId: 2, status: 3 },
      ctx(),
    );
    expect(out[0].status).toBe('new');
  });
  it('reads xlsx values and refuses formulas', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.addRow(['Code', 'Name', 'Status']);
    ws.addRow(['D1', 'Plain', 'active']);
    ws.addRow(['D2', { formula: 'CONCAT("a","b")', result: 'ab' }, 'active']);
    ws.addRow(['D3', new Date('2026-01-05'), 'active']);
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
    const data = await readXlsx(bytes);
    expect(data[1]).toEqual(['D1', 'Plain', 'active']);
    expect(data[3][1]).toBe('2026-01-05');
    const out = classifyRows(
      'departments',
      data.slice(1),
      autoMap('departments', data[0]),
      ctx(),
    );
    expect(out[1].status).toBe('invalid');
    expect(out[1].errors.join()).toMatch(/formulas are not accepted/);
  });
  it('validates opening stock rows against the ledger', () => {
    const c = {
      existing: new Map([['st1|m2', { id: 'mv', values: {} }]]),
      refs: {
        stores: new Map([['ST', 'st1']]),
        materials: new Map([
          ['M1', 'm1'],
          ['M2', 'm2'],
        ]),
      },
    };
    const map = autoMap('openingStock', [
      'Store code',
      'Material code',
      'Quantity',
      'Date',
    ]);
    const out = classifyRows(
      'openingStock',
      [
        ['ST', 'M1', '10.5', '2026-11-01'],
        ['ST', 'M1', '-1', '2026-11-01'],
        ['ST', 'M2', '3', '2026-11-01'],
        ['XX', 'M1', '1', 'bad'],
      ],
      map,
      c,
    );
    expect(out.map((r) => r.status)).toEqual([
      'new',
      'invalid',
      'match',
      'invalid',
    ]);
  });
  it('builds usable templates for every module', () => {
    for (const m of [
      'clients',
      'sites',
      'locations',
      'employees',
      'assets',
      'materials',
      'openingStock',
    ] as const) {
      const t = templateRows(m);
      expect(t[0].length).toBe(importColumns(m).length);
      expect(autoMap(m, t[0])).toMatchObject({ [importColumns(m)[0].key]: 0 });
    }
  });
});

describe('SaaS plans and lifecycle', () => {
  const now = new Date('2026-11-15T00:00:00Z');
  const v = {
    id: 'pro_v1',
    planId: 'pro',
    version: 1,
    planName: 'Professional',
    terms: examplePlans[2].terms,
  };
  const trialV = {
    ...v,
    id: 'trial_v1',
    planId: 'trial',
    planName: 'Trial',
    terms: examplePlans[0].terms,
  };
  it('walks trial → past_due → expired and active → renewal_due → grace → past_due → expired', () => {
    const t = newSubscription({ id: 'c', name: 'C' }, trialV, now);
    expect(statusOf(t, now)).toBe('trial');
    expect(statusOf(t, new Date(now.getTime() + 31 * day))).toBe('past_due');
    expect(statusOf(t, new Date(now.getTime() + 61 * day))).toBe('expired');
    const s = newSubscription({ id: 'c', name: 'C' }, v, now);
    const end = s.periodEnd!.getTime();
    expect(statusOf(s, now)).toBe('active');
    expect(statusOf(s, new Date(end - 3 * day))).toBe('renewal_due');
    expect(statusOf(s, new Date(end + 2 * day))).toBe('grace');
    expect(statusOf(s, new Date(end + 10 * day))).toBe('past_due');
    expect(statusOf(s, new Date(end + 40 * day))).toBe('expired');
  });
  it('suspension and expiry are read-only, never destructive', () => {
    const s = newSubscription({ id: 'c', name: 'C' }, v, now);
    const sus = applyAction(s, 'suspend', { now });
    expect(planSnapshot(sus, now)).toMatchObject({
      status: 'suspended',
      access: 'read_only',
      limits: v.terms.limits,
    });
    expect(accessFor('expired')).toBe('read_only');
    expect(accessFor('grace')).toBe('full');
    const back = applyAction(sus, 'reactivate', { now });
    expect(planSnapshot(back, now).access).toBe('full');
    expect(() => applyAction(back, 'reactivate', { now })).toThrow();
  });
  it('renews, extends trials and changes plan with version snapshots', () => {
    const t = newSubscription({ id: 'c', name: 'C' }, trialV, now);
    const ext = applyAction(t, 'extend_trial', { days: 14, now });
    expect(ext.trialEndsAt!.getTime()).toBe(
      t.trialEndsAt!.getTime() + 14 * day,
    );
    expect(() => applyAction(t, 'extend_trial', { days: 365, now })).toThrow();
    const r = applyAction(ext, 'renew', { now });
    expect(r.trialEndsAt).toBeNull();
    expect(statusOf(r, now)).toBe('active');
    const up = applyAction(r, 'change_plan', { version: v, now });
    expect(up).toMatchObject({ versionId: 'pro_v1', revision: 4 });
    expect(
      overLimits(
        {
          sites: 5,
          employees: 1,
          assets: 1,
          recurringSchedules: 1,
          staffLinks: 1,
        },
        examplePlans[1].terms,
      ),
    ).toEqual(['sites']);
  });
  it('limits and features resolve centrally', () => {
    expect(
      canAdd(
        {
          sites: 2,
          employees: 0,
          assets: 0,
          recurringSchedules: 0,
          staffLinks: 0,
        },
        { sites: 2 },
        'sites',
      ),
    ).toMatchObject({ ok: false });
    expect(
      canAdd(
        {
          sites: 2,
          employees: 0,
          assets: 0,
          recurringSchedules: 0,
          staffLinks: 0,
        },
        { sites: -1 },
        'sites',
      ).ok,
    ).toBe(true);
    expect(
      canAdd(
        {
          sites: 0,
          employees: 0,
          assets: 0,
          recurringSchedules: 0,
          staffLinks: 0,
        },
        undefined,
        'sites',
      ).ok,
    ).toBe(true);
  });
  it('revenue counts only paid invoices covering the date, per currency', () => {
    const inv = (o: Partial<Invoice>): Invoice => ({
      id: 'i',
      companyId: 'c',
      number: 'N',
      amount: 1200,
      currency: 'AED',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2027-01-01'),
      status: 'paid',
      source: 'manual',
      paidAt: now,
      ...o,
    });
    const r = recurringRevenue(
      [
        inv({}),
        inv({ status: 'issued' }),
        inv({
          amount: 300,
          periodStart: new Date('2026-11-01'),
          periodEnd: new Date('2026-12-01'),
          currency: 'USD',
        }),
        inv({ periodEnd: new Date('2026-06-01') }),
      ],
      now,
    );
    expect(r.mrr).toEqual({ AED: 100, USD: 300 });
    expect(r.arr.AED).toBe(1200);
  });
});

describe('onboarding', () => {
  it('reports progress and outstanding steps', () => {
    const p = setupProgress({ companyComplete: true, sites: 1, locations: 0 });
    expect(p.percent).toBeGreaterThan(0);
    expect(p.outstanding.map((s) => s.id)).toContain('locations');
    expect(stepDone('locations', {}, { locations: true })).toBe(true);
    expect(onboardingSteps.every((s) => /^setup\./.test(s.helpId))).toBe(true);
  });
  it('starter packs reference their own categories and departments', () => {
    for (const p of starterPacks) {
      const cats = new Set(p.categories.map((c) => c.code));
      const deps = new Set(p.departments.map((d) => d.code));
      expect(
        p.templates.every(
          (t) => cats.has(t.category) && t.questions.length > 0,
        ),
      ).toBe(true);
      expect(p.designations.every((d) => deps.has(d.department))).toBe(true);
      expect(new Set(p.templates.map((t) => t.code)).size).toBe(
        p.templates.length,
      );
    }
    expect(
      starterPacks
        .find((p) => p.id === 'business_center')!
        .templates.map((t) => t.name),
    ).toEqual(
      expect.arrayContaining([
        'Common area cleaning',
        'AC inspection',
        'Fire safety check',
        'Washroom inspection',
        'Generator check',
        'Water pump inspection',
        'Security patrol',
        'Waste management',
        'Reception inspection',
      ]),
    );
  });
});
