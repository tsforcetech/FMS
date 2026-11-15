/**
 * Phase 8 import engine (pure). Parses CSV/XLSX into rows, maps columns to
 * record fields, validates with the same schemas as the forms, resolves
 * references by exact code and classifies every row before anything is
 * written. Existing records are matched only by their exact code (unique per
 * kind through codeClaims) — never by a fuzzy name.
 */
import {
  definitions,
  fieldsFor,
  inputSchema,
  type FieldSpec,
  type Kind,
  type Values,
} from './operations';
import { defaultValues } from './operations';

export const importLimits = { maxBytes: 5 * 1024 * 1024, maxRows: 5000 };
export const importableKinds = [
  'clients',
  'sites',
  'locations',
  'facilityTypes',
  'facilities',
  'departments',
  'designations',
  'employees',
  'teams',
  'assetCategories',
  'assets',
  'suppliers',
  'materialCategories',
  'materials',
  'stores',
  'taskCategories',
] as const satisfies readonly Kind[];
export type ImportKind = (typeof importableKinds)[number];
export type ImportModule = ImportKind | 'openingStock';

export type RowStatus =
  'new' | 'match' | 'update' | 'duplicate' | 'invalid' | 'skipped';
export type ImportRow = {
  row: number; // 1-based source row (header is row 1)
  status: RowStatus;
  errors: string[];
  values: Values;
  /** Existing record id for match/update rows. */
  id?: string;
  /** Fields that differ from the existing record. */
  changes?: string[];
};
export type ImportColumn = {
  key: string;
  label: string;
  required: boolean;
  /** Reference fields are given as the referenced record's code. */
  reference?: Kind;
  options?: string[];
  hint?: string;
};

/* ------------------------------------------------------------- parsing */
export class ImportFileError extends Error {}
/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (q) throw new ImportFileError('The CSV file has an unclosed quote.');
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
/** Checks size and type before parsing (extension and file signature). */
export function checkFile(name: string, bytes: Uint8Array) {
  if (bytes.byteLength > importLimits.maxBytes)
    throw new ImportFileError(
      'The file is larger than 5 MB. Split it into smaller files.',
    );
  if (!bytes.byteLength) throw new ImportFileError('The file is empty.');
  const lower = name.toLowerCase();
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b; // PK — xlsx is a zip
  if (lower.endsWith('.xlsx')) {
    if (!zip)
      throw new ImportFileError('This is not a valid Excel (.xlsx) file.');
    return 'xlsx' as const;
  }
  if (lower.endsWith('.csv')) {
    if (zip || bytes.subarray(0, 4096).includes(0))
      throw new ImportFileError('This is not a text CSV file.');
    return 'csv' as const;
  }
  throw new ImportFileError(
    'Upload an Excel (.xlsx) or CSV (.csv) file. Old .xls files are not supported.',
  );
}
/**
 * Reads the first worksheet as text. Formula cells are refused: imports take
 * values only, so a spreadsheet can never smuggle instructions into the data.
 */
export async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    );
  } catch {
    throw new ImportFileError(
      'The Excel file could not be read. Save it again as .xlsx and retry.',
    );
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new ImportFileError('The Excel file has no worksheets.');
  const rows: string[][] = [];
  let formula = 0;
  ws.eachRow({ includeEmpty: false }, (r, n) => {
    const out: string[] = [];
    r.eachCell({ includeEmpty: true }, (c, col) => {
      const v = c.value as unknown;
      let s = '';
      if (
        v &&
        typeof v === 'object' &&
        ('formula' in (v as object) || 'sharedFormula' in (v as object))
      ) {
        formula++;
        s = '\u0000FORMULA';
      } else if (v instanceof Date) s = v.toISOString().slice(0, 10);
      else if (v && typeof v === 'object' && 'richText' in (v as object))
        s = (v as { richText: { text: string }[] }).richText
          .map((x) => x.text)
          .join('');
      else if (v && typeof v === 'object' && 'text' in (v as object))
        s = String((v as { text: string }).text);
      else if (v !== null && v !== undefined) s = String(v);
      out[col - 1] = s;
    });
    rows[n - 1] = Array.from(out, (x) => x ?? '');
  });
  void formula;
  return rows.filter((r) => r && r.some((c) => c.trim() !== ''));
}

/* ------------------------------------------------------------- columns */
export function importColumns(module: ImportModule): ImportColumn[] {
  if (module === 'openingStock')
    return [
      {
        key: 'storeCode',
        label: 'Store code',
        required: true,
        reference: 'stores',
      },
      {
        key: 'materialCode',
        label: 'Material code',
        required: true,
        reference: 'materials',
      },
      {
        key: 'quantity',
        label: 'Quantity',
        required: true,
        hint: 'Opening balance, zero or more',
      },
      {
        key: 'movementDate',
        label: 'Date',
        required: true,
        hint: 'YYYY-MM-DD',
      },
      { key: 'reference', label: 'Reference', required: false },
    ];
  return fieldsFor(module)
    .filter((f) => !(module === 'assets' && f.key === 'lastTransferId'))
    .map((f: FieldSpec) => ({
      key: f.key,
      label: f.reference ? `${f.label} (code)` : f.label,
      required: !!f.required,
      reference: f.reference,
      options: f.options,
      hint:
        f.type === 'date'
          ? 'YYYY-MM-DD'
          : f.type === 'time'
            ? 'HH:MM'
            : f.options
              ? f.options.join(' / ')
              : undefined,
    }));
}
export function moduleTitle(module: ImportModule) {
  return module === 'openingStock'
    ? 'Opening stock'
    : definitions[module].title;
}
/** Template: header row plus one example row of hints. */
export function templateRows(module: ImportModule): string[][] {
  const cols = importColumns(module);
  return [
    cols.map((c) => c.label),
    cols.map((c) => (c.required ? 'Required. ' : '') + (c.hint || '')),
  ];
}
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(code\)/g, '')
    .replace(/[^a-z0-9]/g, '');
/** Maps file headers to field keys by label or key (exact after normalising). */
export function autoMap(module: ImportModule, headers: string[]) {
  const cols = importColumns(module);
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    const c = cols.find((c) => norm(c.label) === n || norm(c.key) === n);
    if (c && map[c.key] === undefined) map[c.key] = i;
  });
  return map;
}

/* ------------------------------------------------------------- validation */
export type ImportContext = {
  /** Existing records of the module's kind by code. */
  existing: Map<string, { id: string; values: Values }>;
  /** code → id for every referenced kind. */
  refs: Partial<Record<Kind, Map<string, string>>>;
};
export function referencedKinds(module: ImportModule): Kind[] {
  return [
    ...new Set(
      importColumns(module).flatMap((c) => (c.reference ? [c.reference] : [])),
    ),
  ];
}
/**
 * Validates and classifies all rows. Rows are never merged by name: a row
 * matches an existing record only through its exact (upper-case) code.
 */
export function classifyRows(
  module: ImportModule,
  rows: string[][],
  map: Record<string, number>,
  ctx: ImportContext,
): ImportRow[] {
  const cols = importColumns(module);
  const missing = cols.filter((c) => c.required && map[c.key] === undefined);
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const rowNo = i + 2;
    const errors: string[] = [];
    if (missing.length)
      errors.push(`Missing column: ${missing.map((c) => c.label).join(', ')}`);
    const raw: Values = {};
    for (const c of cols) {
      const at = map[c.key];
      const v = at === undefined ? '' : String(r[at] ?? '').trim();
      if (v === '\u0000FORMULA')
        errors.push(
          `${c.label}: formulas are not accepted — paste values only`,
        );
      raw[c.key] = v === '\u0000FORMULA' ? '' : v;
    }
    if (r.every((c) => String(c ?? '').trim() === ''))
      return { row: rowNo, status: 'skipped', errors: [], values: raw };
    if (module === 'openingStock') return stockRow(rowNo, raw, ctx, errors);
    const kind = module;
    const values: Values = { ...defaultValues(kind) };
    for (const c of cols) {
      let v = raw[c.key];
      if (c.key === 'code') v = v.toUpperCase();
      if (c.reference && v) {
        const id = ctx.refs[c.reference]?.get(v.toUpperCase());
        if (!id)
          errors.push(
            `${c.label}: no ${definitions[c.reference].singular} with code “${v}”`,
          );
        v = id || '';
      }
      if (c.options && v) {
        const o = c.options.find((x) => x.toLowerCase() === v.toLowerCase());
        if (o) v = o;
      }
      if (v !== '' || c.required) values[c.key] = v;
    }
    const parsed = inputSchema(kind).safeParse(values);
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const label =
          cols.find((c) => c.key === issue.path[0])?.label ||
          String(issue.path[0]);
        errors.push(`${label}: ${issue.message}`);
      }
    const code = values.code;
    if (code && seen.has(code))
      return {
        row: rowNo,
        status: 'duplicate',
        errors: [`Code ${code} appears earlier in this file`],
        values,
      };
    if (code) seen.add(code);
    if (errors.length) return { row: rowNo, status: 'invalid', errors, values };
    const ex = ctx.existing.get(code);
    if (!ex) return { row: rowNo, status: 'new', errors: [], values };
    const changes = Object.keys(values).filter(
      (k) => k !== 'code' && (ex.values[k] ?? '') !== values[k],
    );
    return changes.length
      ? { row: rowNo, status: 'update', errors: [], values, id: ex.id, changes }
      : { row: rowNo, status: 'match', errors: [], values, id: ex.id };
  });
}
function stockRow(
  row: number,
  raw: Values,
  ctx: ImportContext,
  errors: string[],
): ImportRow {
  const values: Values = { ...raw };
  const store = ctx.refs.stores?.get(raw.storeCode.toUpperCase());
  const material = ctx.refs.materials?.get(raw.materialCode.toUpperCase());
  if (!raw.storeCode) errors.push('Store code: Required');
  else if (!store)
    errors.push(`Store code: no store with code “${raw.storeCode}”`);
  if (!raw.materialCode) errors.push('Material code: Required');
  else if (!material)
    errors.push(`Material code: no material with code “${raw.materialCode}”`);
  if (!/^(0|[1-9][0-9]{0,8})(\.[0-9]{1,3})?$/.test(raw.quantity))
    errors.push('Quantity: enter a number of zero or more (up to 3 decimals)');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.movementDate) ||
    isNaN(Date.parse(raw.movementDate))
  )
    errors.push('Date: use YYYY-MM-DD');
  values.storeId = store || '';
  values.materialId = material || '';
  const key = `${values.storeId}|${values.materialId}`;
  if (errors.length) return { row, status: 'invalid', errors, values };
  // Opening balance exists already → the ledger refuses a second opening entry.
  if (ctx.existing.has(key))
    return {
      row,
      status: 'match',
      errors: ['Opening balance already recorded for this store and material'],
      values,
      id: ctx.existing.get(key)!.id,
    };
  return { row, status: 'new', errors: [], values };
}
export function summarize(rows: ImportRow[]) {
  const c: Record<RowStatus, number> = {
    new: 0,
    match: 0,
    update: 0,
    duplicate: 0,
    invalid: 0,
    skipped: 0,
  };
  for (const r of rows) c[r.status]++;
  return c;
}
/** Stable SHA-256 of the file bytes, used to detect a repeat import. */
export async function fileHash(bytes: Uint8Array) {
  const d = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(d)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
/** Rows for the downloadable error report. */
export function errorReport(rows: ImportRow[]) {
  return rows
    .filter(
      (r) =>
        r.errors.length || r.status === 'invalid' || r.status === 'duplicate',
    )
    .map((r) => ({
      row: r.row,
      status: r.status,
      code: r.values.code || r.values.materialCode || '',
      errors: r.errors.join('; '),
    }));
}
