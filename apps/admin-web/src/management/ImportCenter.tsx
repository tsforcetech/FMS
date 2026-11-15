import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileDown,
  FileUp,
  History,
  PlayCircle,
  RotateCcw,
  Upload,
} from 'lucide-react';
import {
  autoMap,
  buildXlsx,
  checkFile,
  classifyRows,
  errorReport,
  fileHash,
  importColumns,
  importableKinds,
  parseCsv,
  prepareTable,
  readXlsx,
  summarize,
  templateRows,
  type ImportModule,
  type ImportRow,
  type RowStatus,
} from '@facilityos/shared';
import { formatInstant, type Context } from './context';
import { importBlocked } from './planGate';
import { download } from './exportStore';
import {
  executeImport,
  getSession,
  listSessions,
  loadContext,
  moduleLabel,
  saveDryRun,
  sessionId,
  type ImportSession,
} from './importStore';
import {
  Banner,
  Empty,
  Pill,
  Skeleton,
  StatusPill,
  friendly,
  useToast,
  type Tone,
} from '../ui/kit';

const modules: ImportModule[] = [...importableKinds, 'openingStock'];
const statusTone: Record<RowStatus, Tone> = {
  new: 'green',
  match: 'gray',
  update: 'blue',
  duplicate: 'amber',
  invalid: 'red',
  skipped: 'gray',
};
const statusLabel: Record<RowStatus, string> = {
  new: 'New',
  match: 'Match found (no change)',
  update: 'Update candidate',
  duplicate: 'Duplicate in file',
  invalid: 'Invalid',
  skipped: 'Skipped (empty)',
};

/**
 * Data Import Center: select module → template → upload → map columns →
 * validate (dry run) → preview → confirm → execute in bounded batches →
 * results and error report. Nothing is written before confirmation.
 */
export function ImportCenter({ context }: { context: Context }) {
  const db = context.services.db,
    c = context.company.companyId;
  const toast = useToast();
  const blocked = importBlocked(context);
  const [module, setModule] = useState<ImportModule>('departments');
  const [file, setFile] = useState<{
    name: string;
    hash: string;
    rows: string[][];
  } | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<ImportRow[] | null>(null);
  const [session, setSession] = useState<ImportSession | null>(null);
  const [applyUpdates, setApplyUpdates] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<{
    status: string;
    counts: Record<string, number>;
  } | null>(null);
  const [filter, setFilter] = useState<RowStatus | ''>('');
  const [history, setHistory] = useState<ImportSession[]>();
  const [v, setV] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const cols = useMemo(() => importColumns(module), [module]);
  useEffect(() => {
    listSessions(db, c)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [db, c, v]);
  function reset(m = module) {
    setModule(m);
    setFile(null);
    setMap({});
    setPreview(null);
    setSession(null);
    setResult(null);
    setError('');
    setProgress(null);
  }
  async function template(fmt: 'xlsx' | 'csv') {
    const rows = templateRows(module);
    const name = `FacilityOS-${moduleLabel(module).replace(/\W+/g, '-')}-template.${fmt}`;
    if (fmt === 'csv')
      download(
        '﻿' +
          rows
            .map((r) =>
              r
                .map((x) =>
                  /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x,
                )
                .join(','),
            )
            .join('\r\n') +
          '\r\n',
        name,
        'text/csv',
      );
    else {
      const t = prepareTable(
        [Object.fromEntries(cols.map((col, i) => [col.key, rows[1][i]]))],
        cols.map((col) => ({
          key: col.key,
          label: col.label,
          type: 'text' as const,
        })),
      );
      download(
        await buildXlsx(
          {
            title: `${moduleLabel(module)} import`,
            companyName: context.company.name,
            filters: [],
            generatedAt: new Date(),
            timeZone: context.company.timeZone,
          },
          t,
        ),
        name,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    }
  }
  async function onFile(f: File) {
    setError('');
    setPreview(null);
    setResult(null);
    setBusy('Reading file…');
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const kind = checkFile(f.name, bytes);
      const data =
        kind === 'csv'
          ? parseCsv(new TextDecoder('utf-8', { fatal: false }).decode(bytes))
          : await readXlsx(bytes);
      if (data.length < 2)
        throw new Error('The file has a header row but no data rows.');
      if (data.length - 1 > 2000)
        throw new Error(
          `The file has ${data.length - 1} rows. Import at most 2,000 rows per file.`,
        );
      const hash = await fileHash(bytes);
      setFile({ name: f.name, hash, rows: data });
      setMap(autoMap(module, data[0]));
      const prior = await getSession(db, c, sessionId(module, hash));
      if (prior && prior.status === 'completed')
        setError(
          `This exact file was already imported on ${prior.updatedAt ? formatInstant(prior.updatedAt.toDate(), context.company.timeZone) : 'an earlier date'}. Running it again will only report existing records.`,
        );
      else if (prior && ['importing', 'partial'].includes(prior.status))
        setError(
          'An earlier import of this file did not finish. Validate and import again to resume — finished rows are skipped.',
        );
    } catch (e) {
      setFile(null);
      setError(
        e instanceof Error && !(e as { code?: string }).code
          ? e.message
          : friendly(e),
      );
    } finally {
      setBusy('');
    }
  }
  async function validate() {
    if (!file) return;
    setBusy('Checking codes and references…');
    setError('');
    try {
      const data = file.rows.slice(1);
      const ctx = await loadContext(db, c, module, data, map);
      const rows = classifyRows(module, data, map, ctx);
      setPreview(rows);
      setSession(
        await saveDryRun(db, c, context.uid, {
          module,
          fileName: file.name,
          fileHash: file.hash,
          mapping: map,
          rows,
          counts: summarize(rows),
        }),
      );
      setV((x) => x + 1);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy('');
    }
  }
  async function run() {
    if (!preview || !session) return;
    abort.current = new AbortController();
    setProgress([0, 1]);
    setError('');
    try {
      const fresh = (await getSession(db, c, session.id)) || session;
      const r = await executeImport(db, c, context.uid, fresh, preview, {
        applyUpdates,
        progress: (d, t) => setProgress([d, t]),
        signal: abort.current.signal,
      });
      const counts: Record<string, number> = {};
      for (const x of r.results) counts[x.result] = (counts[x.result] || 0) + 1;
      setResult({ status: r.status, counts });
      setSession(await getSession(db, c, session.id));
      toast(
        r.status === 'completed'
          ? 'Import completed'
          : 'Import finished with rows to review',
      );
      setV((x) => x + 1);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setProgress(null);
    }
  }
  async function errorFile() {
    const rows = preview ? errorReport(preview) : [];
    const failed = (session?.rows || [])
      .filter((r) => r.result === 'failed')
      .map((r) => ({
        row: r.row,
        status: 'failed',
        code: '',
        errors: r.error || '',
      }));
    const all = [...rows, ...failed].sort((a, b) => a.row - b.row);
    const t = prepareTable(all, [
      { key: 'row', label: 'Row', type: 'number' },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'code', label: 'Code', type: 'text' },
      { key: 'errors', label: 'Errors', type: 'text' },
    ]);
    download(
      await buildXlsx(
        {
          title: `${moduleLabel(module)} import errors`,
          companyName: context.company.name,
          filters: [{ label: 'File', value: file?.name || '' }],
          generatedAt: new Date(),
          timeZone: context.company.timeZone,
        },
        t,
      ),
      `${moduleLabel(module)}-import-errors.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  }
  const counts = preview ? summarize(preview) : null;
  const toWrite = preview
    ? preview.filter(
        (r) => r.status === 'new' || (r.status === 'update' && applyUpdates),
      ).length
    : 0;
  const shown = (preview || [])
    .filter((r) => !filter || r.status === filter)
    .slice(0, 300);
  return (
    <>
      <Banner tone="blue" title="How importing works">
        Nothing is saved until you confirm. Rows are matched to existing records
        only by their exact code — never by name. Each row is saved with the
        same checks as the forms (references, plan limits, security rules).
        Re-uploading the same file resumes an unfinished import and never
        creates duplicates. Formulas are not accepted: export the sheet as
        values first.
      </Banner>
      {blocked && <Banner tone="amber">{blocked}</Banner>}
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>1. Choose what to import</h2>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="imp-module">Module</label>
            <select
              id="imp-module"
              className="select"
              value={module}
              onChange={(e) => reset(e.target.value as ImportModule)}
            >
              {modules.map((m) => (
                <option key={m} value={m}>
                  {moduleLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="field-label">Template</span>
            <div className="toolbar">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void template('xlsx')}
              >
                <FileDown /> Excel template
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void template('csv')}
              >
                <FileDown /> CSV
              </button>
            </div>
          </div>
        </div>
        <p className="muted small">
          Columns:{' '}
          {cols.map((x) => `${x.label}${x.required ? '*' : ''}`).join(', ')}.
          References use codes (e.g. the site code), so the referenced records
          must exist first.
        </p>
      </section>
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>2. Upload and map columns</h2>
        </div>
        <label className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>
          <Upload />{' '}
          {file
            ? `Replace file (${file.name})`
            : 'Choose .xlsx or .csv (max 5 MB, 2,000 rows)'}
          <input
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            hidden
            disabled={!!blocked}
            aria-label="Import file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onFile(f);
            }}
          />
        </label>
        {busy && (
          <p className="muted small" role="status">
            {busy}
          </p>
        )}
        {error && (
          <Banner tone="amber" role="alert">
            {error}
          </Banner>
        )}
        {file && (
          <>
            <p className="muted small">
              {file.rows.length - 1} data rows found.
            </p>
            <div className="form-grid">
              {cols.map((col) => (
                <div className="field" key={col.key}>
                  <label htmlFor={`map-${col.key}`}>
                    {col.label}
                    {col.required && <span className="req"> *</span>}
                  </label>
                  <select
                    id={`map-${col.key}`}
                    className="select"
                    value={map[col.key] ?? ''}
                    onChange={(e) => {
                      const n = { ...map };
                      if (e.target.value === '') delete n[col.key];
                      else n[col.key] = Number(e.target.value);
                      setMap(n);
                      setPreview(null);
                    }}
                  >
                    <option value="">— not in file —</option>
                    {file.rows[0].map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="toolbar">
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn-primary"
                disabled={!!busy || !!blocked}
                onClick={() => void validate()}
              >
                <CheckCircle2 /> Validate (dry run)
              </button>
            </div>
          </>
        )}
      </section>
      {preview && counts && (
        <section className="card card-pad rise">
          <div className="card-head">
            <h2>3. Review and confirm</h2>
          </div>
          <div className="stat-grid">
            {(Object.keys(statusLabel) as RowStatus[]).map((k) => (
              <button
                type="button"
                key={k}
                className={`stat${filter === k ? ' active' : ''}`}
                onClick={() => setFilter(filter === k ? '' : k)}
              >
                <strong>{counts[k]}</strong>
                <span>{statusLabel[k]}</span>
              </button>
            ))}
          </div>
          {counts.update > 0 && (
            <label className="check">
              <input
                type="checkbox"
                checked={applyUpdates}
                onChange={(e) => setApplyUpdates(e.target.checked)}
              />{' '}
              Also update the {counts.update} existing record(s) whose values
              differ (only the columns in this file change)
            </label>
          )}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Status</th>
                  <th>Code</th>
                  <th>Name / item</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>
                      <Pill tone={statusTone[r.status]}>
                        {statusLabel[r.status]}
                      </Pill>
                    </td>
                    <td className="cell-ref">
                      {r.values.code || r.values.materialCode || ''}
                    </td>
                    <td>
                      {r.values.name ||
                        (r.values.storeCode
                          ? `${r.values.storeCode} · ${r.values.quantity}`
                          : '')}
                    </td>
                    <td className="small">
                      {r.errors.length
                        ? r.errors.join('; ')
                        : r.changes?.length
                          ? `Changes: ${r.changes.join(', ')}`
                          : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(preview.length > 300 || filter) && (
            <p className="muted small">
              Showing {shown.length} of{' '}
              {preview.filter((r) => !filter || r.status === filter).length}{' '}
              rows.
            </p>
          )}
          <div className="toolbar">
            {(counts.invalid > 0 || counts.duplicate > 0) && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void errorFile()}
              >
                <FileDown /> Download error report
              </button>
            )}
            <span style={{ flex: 1 }} />
            {progress ? (
              <>
                <span className="small" role="status">
                  Importing {progress[0]} of {progress[1]}…
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => abort.current?.abort()}
                >
                  Stop
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!toWrite || !!blocked}
                onClick={() => void run()}
              >
                <PlayCircle /> Import {toWrite} row{toWrite === 1 ? '' : 's'}
              </button>
            )}
          </div>
          {counts.invalid > 0 && (
            <p className="muted small">
              Invalid and duplicate rows are not imported. Fix them in the file
              and upload it again.
            </p>
          )}
        </section>
      )}
      {result && (
        <Banner
          tone={result.status === 'completed' ? 'green' : 'amber'}
          title={
            result.status === 'completed'
              ? 'Import completed'
              : 'Import finished — some rows need attention'
          }
        >
          {Object.entries(result.counts)
            .map(([k, n]) => `${n} ${k}`)
            .join(' · ')}
          .{' '}
          {result.status !== 'completed' &&
            'Download the error report, fix the rows and upload the same file to resume.'}
        </Banner>
      )}
      <section className="card card-pad rise">
        <div className="card-head">
          <h2>
            <History size={18} /> Import history
          </h2>
        </div>
        {!history ? (
          <Skeleton rows={2} />
        ) : !history.length ? (
          <Empty icon={FileUp} title="No imports yet" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Module</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Results</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      {h.updatedAt
                        ? formatInstant(
                            h.updatedAt.toDate(),
                            context.company.timeZone,
                          )
                        : '—'}
                    </td>
                    <td>{moduleLabel(h.module)}</td>
                    <td className="cell-ref">{h.fileName}</td>
                    <td>
                      <StatusPill value={h.status} />
                    </td>
                    <td className="small">
                      {Object.entries(h.counts || {})
                        .map(([k, n]) => `${n} ${k}`)
                        .join(' · ')}
                    </td>
                    <td>
                      {h.createdBy === context.uid
                        ? 'You'
                        : 'User ' + h.createdBy.slice(0, 6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">
          <RotateCcw size={12} /> Rolling back: imported records are normal
          records. To undo, archive them (or post a reversal for opening stock).
          A one-click rollback is not offered because imported records may
          already be used by tasks, assets or stock transactions.
        </p>
      </section>
    </>
  );
}
