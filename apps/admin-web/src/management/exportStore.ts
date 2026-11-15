import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import {
  buildCsv,
  buildPdf,
  buildXlsx,
  exportFileName,
  prepareTable,
  visibleColumns,
  type Branding,
  type ExportAudience,
  type ExportColumn,
  type ExportMeta,
} from '@facilityos/shared';
import fontUrl from '../../../../packages/shared/assets/DejaVuSans.ttf?url';
import fontBoldUrl from '../../../../packages/shared/assets/DejaVuSans-Bold.ttf?url';

/**
 * Phase 8 export runner shared by every list and report. It reads pages until
 * all matching records are collected (no silent truncation), applies the
 * audience's column policy, writes an audit entry (metadata only — never the
 * exported data) and hands the file to the browser.
 */
export type Row = Record<string, unknown>;
export type Dataset = {
  /** Stable report id for the audit log, e.g. "records.sites". */
  report: string;
  title: string;
  columns: ExportColumn[];
  filters: { label: string; value: string }[];
  period?: string;
  /** Rows currently shown on screen (or a loader that resolves their labels). */
  pageRows: Row[] | (() => Promise<Row[]>);
  /** Row count of the on-screen rows when pageRows is a loader. */
  pageCount?: number;
  /** Reads all matching records in bounded pages; reports progress. */
  fetchAll?: (
    progress: (n: number) => void,
    signal: AbortSignal,
  ) => Promise<Row[]>;
  /** Estimated total (server count) when cheap to obtain. */
  count?: () => Promise<number>;
  audience?: ExportAudience;
};
export type ExportFormat = 'xlsx' | 'pdf' | 'csv';
export const exportCaps: Record<ExportFormat, number> = {
  xlsx: 100000,
  csv: 100000,
  pdf: 10000,
};
export class ExportTooLarge extends Error {}

export async function getBranding(
  db: Firestore,
  c: string,
): Promise<Branding & { header?: string; footer?: string }> {
  try {
    const s = await getDoc(doc(db, 'companies', c, 'settings', 'branding'));
    const d = s.data() || {};
    return {
      logoDataUrl: d.logoDataUrl || undefined,
      primaryColor: d.primaryColor || undefined,
      header: d.reportHeader || undefined,
      footer: d.reportFooter || undefined,
    };
  } catch {
    // Customers cannot read settings; their exports use the plain layout.
    return {};
  }
}
const toBase64 = async (url: string) => {
  const b = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000)
    s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const loadFont = async () => ({
  regular: await toBase64(fontUrl),
  bold: await toBase64(fontBoldUrl),
});

export function download(
  bytes: Uint8Array | string,
  name: string,
  type: string,
) {
  const blob = new Blob([bytes as BlobPart], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export async function runExport(opts: {
  db: Firestore;
  companyId: string;
  companyName: string;
  timeZone: string;
  uid: string;
  userLabel?: string;
  dataset: Dataset;
  format: ExportFormat;
  scope: 'page' | 'all';
  selected: string[];
  includeOptional: boolean;
  canSeeSensitive: boolean;
  progress: (n: number) => void;
  signal: AbortSignal;
}) {
  const ds = opts.dataset;
  const rows =
    opts.scope === 'all' && ds.fetchAll
      ? await ds.fetchAll(opts.progress, opts.signal)
      : typeof ds.pageRows === 'function'
        ? await ds.pageRows()
        : ds.pageRows;
  if (opts.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (rows.length > exportCaps[opts.format])
    throw new ExportTooLarge(
      opts.format === 'pdf'
        ? `${rows.length.toLocaleString()} rows are too many for a readable PDF (limit ${exportCaps.pdf.toLocaleString()}). Use Excel, or narrow the filters.`
        : `${rows.length.toLocaleString()} rows exceed the in-browser limit of ${exportCaps[opts.format].toLocaleString()}. Narrow the filters and export in parts.`,
    );
  const audience = ds.audience || 'admin';
  const columns = visibleColumns(ds.columns, {
    audience,
    canSeeSensitive: opts.canSeeSensitive,
    selected: opts.selected,
    includeOptional: opts.includeOptional,
  });
  const table = prepareTable(rows, columns);
  const branding =
    audience === 'customer' ? {} : await getBranding(opts.db, opts.companyId);
  const meta: ExportMeta = {
    title: ds.title,
    companyName: opts.companyName,
    period: ds.period,
    filters: ds.filters,
    generatedAt: new Date(),
    timeZone: opts.timeZone,
    generatedBy: opts.userLabel,
    header: branding.header,
    footer: branding.footer,
  };
  // Audit first: who exported what, how many rows and with which filters.
  await addDoc(collection(opts.db, 'companies', opts.companyId, 'exportLogs'), {
    companyId: opts.companyId,
    report: ds.report.slice(0, 100),
    format: opts.format,
    scope: opts.scope,
    rows: rows.length,
    filters: ds.filters
      .map((f) => `${f.label}: ${f.value}`)
      .join('; ')
      .slice(0, 500),
    by: opts.uid,
    at: serverTimestamp(),
  });
  const name = exportFileName(ds.title, opts.format);
  if (opts.format === 'csv')
    download(buildCsv(table, opts.timeZone), name, 'text/csv;charset=utf-8');
  else if (opts.format === 'xlsx')
    download(
      await buildXlsx(meta, table, branding),
      name,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  else
    download(
      await buildPdf(meta, table, branding, loadFont),
      name,
      'application/pdf',
    );
  return { rows: rows.length, columns: columns.length };
}

/** Pages a cursor-based loader until done, with a hard safety ceiling. */
export async function pageAll<C>(
  load: (
    cursor: C | undefined,
  ) => Promise<{ rows: Row[]; cursor?: C; hasMore: boolean }>,
  progress: (n: number) => void,
  signal: AbortSignal,
  ceiling = exportCaps.xlsx + 1,
) {
  const out: Row[] = [];
  let cursor: C | undefined;
  for (;;) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const r = await load(cursor);
    out.push(...r.rows);
    progress(out.length);
    if (!r.hasMore || out.length >= ceiling) return out;
    cursor = r.cursor;
  }
}
