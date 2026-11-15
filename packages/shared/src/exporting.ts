/**
 * Phase 8 export engine (pure part). Turns rows plus column definitions into
 * typed, sanitised cells for Excel, PDF and CSV. The same column definitions
 * as the Phase 7 reports are used, so exported numbers match the screens.
 *
 * Security:
 *  - Text that a spreadsheet would treat as a formula (= + - @, tab, CR) is
 *    prefixed with an apostrophe (OWASP CSV-injection guidance).
 *  - Columns marked `sensitive` are dropped unless the caller is allowed to
 *    see them; customer-facing exports pass `audience: 'customer'` which also
 *    drops `internal` columns.
 */
import type { ColumnType, ReportColumn } from './reports';

export type ExportColumn = ReportColumn & {
  /** Hidden from customers and other external audiences. */
  internal?: boolean;
  /** Sum this column in the totals row. */
  total?: boolean;
  /** Optional detail column, off unless the user asks for it. */
  optional?: boolean;
  /** ISO currency code for money columns. */
  currency?: string;
  width?: number;
};
export type ExportAudience = 'admin' | 'staff' | 'customer';
export type ExportMeta = {
  title: string;
  companyName: string;
  period?: string;
  filters: { label: string; value: string }[];
  generatedAt: Date;
  timeZone: string;
  generatedBy?: string;
  footer?: string;
  header?: string;
};
export type Cell = string | number | Date | null;
export type PreparedTable = {
  columns: ExportColumn[];
  rows: Cell[][];
  totals: (number | null)[] | null;
};

const FORMULA = /^[=+\-@\t\r]/;
/** Neutralises spreadsheet formula injection in a text value. */
export function safeText(v: string) {
  return FORMULA.test(v) ? `'${v}` : v;
}
function toDate(v: unknown): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (v && typeof (v as { toDate?: () => Date }).toDate === 'function')
    return (v as { toDate: () => Date }).toDate();
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v.length === 10 ? v + 'T00:00:00Z' : v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)))
    return Number(v);
  return null;
}
/** Converts one raw value to the cell type of its column. */
export function cellFor(type: ColumnType, v: unknown): Cell {
  if (v === undefined || v === null || v === '') return null;
  switch (type) {
    case 'number':
    case 'minutes':
    case 'money':
    case 'percent':
      return toNumber(v);
    case 'date':
    case 'datetime':
      return toDate(v);
    default: {
      const s = Array.isArray(v) ? v.join(', ') : String(v);
      return safeText(s.slice(0, 32000));
    }
  }
}
/** Columns the audience may receive, in order, honouring the user's choice. */
export function visibleColumns(
  columns: ExportColumn[],
  opts: {
    audience: ExportAudience;
    canSeeSensitive?: boolean;
    selected?: string[];
    includeOptional?: boolean;
  },
) {
  return columns.filter(
    (c) =>
      (!c.sensitive || (opts.canSeeSensitive && opts.audience === 'admin')) &&
      (!c.internal || opts.audience !== 'customer') &&
      (!c.optional || opts.includeOptional || opts.selected?.includes(c.key)) &&
      (!opts.selected?.length || opts.selected.includes(c.key)),
  );
}
export function prepareTable(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
): PreparedTable {
  const out = rows.map((r) => columns.map((c) => cellFor(c.type, r[c.key])));
  const hasTotals = columns.some((c) => c.total);
  const totals = hasTotals
    ? columns.map((c, i) =>
        c.total
          ? Math.round(
              out.reduce(
                (s, row) => s + (typeof row[i] === 'number' ? row[i] : 0),
                0,
              ) * 100,
            ) / 100
          : null,
      )
    : null;
  return { columns, rows: out, totals };
}
/** Display text for PDF/CSV in the company time zone. */
export function formatCell(c: Cell, type: ColumnType, timeZone: string) {
  if (c === null) return '';
  if (c instanceof Date)
    return c.toLocaleString('en-GB', {
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(type === 'datetime' ? { hour: '2-digit', minute: '2-digit' } : {}),
    });
  if (typeof c === 'number') {
    if (type === 'percent') return `${c}%`;
    if (type === 'money')
      return c.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    return c.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  }
  return c;
}
/** RFC 4180 CSV with formula protection (text cells are already safe). */
export function buildCsv(t: PreparedTable, timeZone: string) {
  const q = (s: string) =>
    /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const lines = [
    t.columns.map((c) => q(safeText(c.label))).join(','),
    ...t.rows.map((r) =>
      r
        .map((cell, i) =>
          q(
            cell instanceof Date
              ? cell.toISOString()
              : String(formatCell(cell, t.columns[i].type, timeZone)),
          ),
        )
        .join(','),
    ),
  ];
  if (t.totals)
    lines.push(
      t.totals
        .map((x, i) =>
          i === 0 && x === null ? 'Total' : x === null ? '' : String(x),
        )
        .join(','),
    );
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
/** True when any text needs a Unicode font beyond the PDF built-in Latin-1 set. */
export function needsUnicodeFont(t: PreparedTable, meta: ExportMeta) {
  const texts = [
    meta.title,
    meta.companyName,
    meta.period || '',
    meta.header || '',
    meta.footer || '',
    ...meta.filters.flatMap((f) => [f.label, f.value]),
    ...t.columns.map((c) => c.label),
    ...t.rows.flat().filter((x): x is string => typeof x === 'string'),
  ];
  return texts.some((s) => [...s].some((ch) => ch.charCodeAt(0) > 0xff));
}
export function exportFileName(title: string, ext: string, at = new Date()) {
  return `${title.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${at.toISOString().slice(0, 10)}.${ext}`;
}
