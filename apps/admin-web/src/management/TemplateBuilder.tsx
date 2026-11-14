import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  GripVertical,
  Plus,
  Save,
  Send,
  Trash2,
  Archive,
  FilePlus2,
  ChevronDown,
  ChevronRight,
  Users,
  Info,
} from 'lucide-react';
import {
  answerTypes,
  answerTypeLabels,
  assignmentModes,
  choiceAnswerTypes,
  contentIssues,
  definitions,
  deferredAnswerTypes,
  emptyContent,
  moveItem,
  newQuestion,
  numericAnswerTypes,
  priorities,
  raciKinds,
  raciLabels,
  raciLetters,
  evidenceKinds,
  type AnswerType,
  type Kind,
  type Operation,
  type Question,
  type RaciEntry,
  type VersionContent,
} from '@facilityos/shared';
import {
  createDraft,
  eligibleEmployees,
  listVersions,
  retireVersion,
  saveDraft,
  type TemplateVersion,
} from './tasksStore';
import { formatInstant, useLabel, type Context } from './context';
import { Picker } from './Picker';
import { ChecklistForm } from './Checklist';
import {
  Banner,
  ConfirmDialog,
  Empty,
  Pill,
  Segmented,
  Skeleton,
  StatusPill,
  friendly,
  humanize,
  useToast,
} from '../ui/kit';

const steps = [
  'Template information',
  'Checklist',
  'Evidence',
  'Responsibilities',
  'Assignment defaults',
  'Review & publish',
] as const;
const raciKind: Record<(typeof raciKinds)[number], Kind> = {
  designation: 'designations',
  department: 'departments',
  team: 'teams',
  employee: 'employees',
};
const assignKind: Partial<Record<(typeof assignmentModes)[number], Kind>> = {
  employee: 'employees',
  department: 'departments',
  team: 'teams',
  shift: 'shifts',
  site: 'sites',
};
const siteTypes = definitions.sites.fields.find(
  (f) => f.key === 'propertyType',
)!.options!;

/* ================================================================ versions panel */
export function TemplateVersions({
  context,
  template,
}: {
  context: Context;
  template: Operation;
}) {
  const [versions, setVersions] = useState<TemplateVersion[]>(),
    [editing, setEditing] = useState<TemplateVersion>(),
    [viewing, setViewing] = useState<TemplateVersion>(),
    [retire, setRetire] = useState<TemplateVersion>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  const db = context.services.db,
    c = context.company.companyId;
  const load = useCallback(async () => {
    try {
      setVersions(await listVersions(db, c, template.id));
      setError('');
    } catch (e) {
      setError(friendly(e));
    }
  }, [db, c, template.id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function newDraft(from?: TemplateVersion) {
    setBusy(true);
    try {
      await createDraft(
        db,
        c,
        context.uid,
        template.id,
        from ? from.content : emptyContent(template.values.name),
      );
      toast(
        from ? `Copied v${from.version} into a new draft.` : 'Draft created.',
      );
      const list = await listVersions(db, c, template.id);
      setVersions(list);
      setEditing(list.find((v) => v.state === 'draft'));
    } catch (e) {
      toast(friendly(e), 'red');
    } finally {
      setBusy(false);
    }
  }
  if (editing)
    return (
      <Builder
        context={context}
        version={editing}
        onClose={() => {
          setEditing(undefined);
          void load();
        }}
      />
    );
  if (viewing)
    return (
      <div className="rise">
        <button
          type="button"
          className="link-btn"
          onClick={() => setViewing(undefined)}
        >
          ← All versions
        </button>
        <h2 style={{ margin: '10px 0 4px' }}>
          {viewing.content.title}{' '}
          <span className="code-chip">v{viewing.version}</span>
        </h2>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Read-only. Published versions never change; copy into a new draft to
          make changes.
        </p>
        <VersionSummary content={viewing.content} context={context} />
        <ChecklistForm content={viewing.content} answers={{}} disabled />
      </div>
    );
  const draft = versions?.find((v) => v.state === 'draft');
  const published = versions?.find((v) => v.state === 'published');
  return (
    <div>
      {error && <Banner tone="red">{error}</Banner>}
      {!versions && !error && <Skeleton rows={2} />}
      {versions && !versions.length && (
        <Empty
          icon={FilePlus2}
          title="No checklist yet"
          action={
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void newDraft()}
            >
              <Plus /> Build the checklist
            </button>
          }
        >
          Create the first draft, add questions and responsibilities, then
          publish it so tasks can use it.
        </Empty>
      )}
      {versions && versions.length > 0 && (
        <>
          <div className="toolbar">
            <span className="muted">
              {published
                ? `Version ${published.version} is live for new tasks.`
                : 'No published version yet — tasks cannot use this template.'}
            </span>
            {!draft && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginLeft: 'auto' }}
                disabled={busy}
                onClick={() => void newDraft(published || versions[0])}
              >
                <Copy /> New draft from v{(published || versions[0]).version}
              </button>
            )}
          </div>
          <div className="queue">
            {versions.map((v) => (
              <div className="queue-row version-row" key={v.id}>
                <span
                  className={`icon-circle tone-${v.state === 'published' ? 'green' : v.state === 'draft' ? 'blue' : 'gray'}`}
                >
                  <span style={{ fontWeight: 700 }}>v{v.version}</span>
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="t">{v.content.title}</div>
                  <div className="s">
                    {v.content.questions.length} questions ·{' '}
                    {v.content.raci.length} responsibilities ·{' '}
                    {v.publishedAt
                      ? 'published ' + formatInstant(v.publishedAt.toDate())
                      : 'updated ' + formatInstant(v.updatedAt.toDate())}
                  </div>
                </div>
                <span className="hide-sm">
                  <StatusPill
                    value={
                      v.state === 'published'
                        ? 'active'
                        : v.state === 'draft'
                          ? 'draft'
                          : 'archived'
                    }
                  />
                </span>
                <div className="row-actions">
                  {v.state === 'draft' ? (
                    <button
                      type="button"
                      className="btn btn-dark btn-sm"
                      onClick={() => setEditing(v)}
                    >
                      Continue editing
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setViewing(v)}
                    >
                      <Eye /> View
                    </button>
                  )}
                  {v.state === 'published' && (
                    <button
                      type="button"
                      className="icon-btn sm"
                      aria-label={`Retire version ${v.version}`}
                      title="Retire"
                      onClick={() => setRetire(v)}
                    >
                      <Archive />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {retire && (
        <ConfirmDialog
          title={`Retire version ${retire.version}?`}
          confirmLabel="Retire version"
          busy={busy}
          onCancel={() => setRetire(undefined)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await retireVersion(db, c, context.uid, retire);
              toast(`Version ${retire.version} retired.`);
              await load();
            } catch (e) {
              toast(friendly(e), 'red');
            } finally {
              setBusy(false);
              setRetire(undefined);
            }
          }}
        >
          New tasks will no longer use it. Existing tasks keep their copy, and
          the version stays available for audit.
        </ConfirmDialog>
      )}
    </div>
  );
}

/* ================================================================ builder */
function Builder({
  context,
  version,
  onClose,
}: {
  context: Context;
  version: TemplateVersion;
  onClose: () => void;
}) {
  const [content, setContent] = useState<VersionContent>(version.content),
    [saved, setSaved] = useState(version),
    [step, setStep] = useState(0),
    [visited, setVisited] = useState<number[]>([0]),
    [busy, setBusy] = useState(false),
    [publish, setPublish] = useState(false),
    [leave, setLeave] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  const dirty = JSON.stringify(content) !== JSON.stringify(saved.content);
  const set = (patch: Partial<VersionContent>) =>
    setContent((c) => ({ ...c, ...patch }));
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  async function save(andPublish = false) {
    setBusy(true);
    setError('');
    try {
      await saveDraft(
        context.services.db,
        context.company.companyId,
        context.uid,
        saved,
        content,
        andPublish,
      );
      const fresh = (
        await listVersions(
          context.services.db,
          context.company.companyId,
          saved.templateId,
        )
      ).find((v) => v.id === saved.id)!;
      setSaved(fresh);
      toast(
        andPublish ? `Version ${saved.version} published.` : 'Draft saved.',
      );
      if (andPublish) onClose();
    } catch (e) {
      setError(friendly(e));
      toast(friendly(e), 'red');
    } finally {
      setBusy(false);
      setPublish(false);
    }
  }
  const go = (n: number) => {
    setStep(n);
    setVisited((v) => [...new Set([...v, n])]);
  };
  const publishIssues = contentIssues(content, true);
  return (
    <div className="builder rise">
      <div className="builder-head">
        <div>
          <span className="code-chip">Draft v{saved.version}</span>
          <h2 style={{ marginTop: 6 }}>
            {content.title || 'Untitled template'}
          </h2>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => (dirty ? setLeave(true) : onClose())}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-dark"
            disabled={busy || !dirty}
            onClick={() => void save()}
          >
            <Save /> {busy ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
          </button>
        </div>
      </div>
      <ol className="stepper" aria-label="Template sections">
        {steps.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              aria-current={step === i ? 'step' : undefined}
              className={visited.includes(i) && step !== i ? 'done' : ''}
              onClick={() => go(i)}
            >
              <span className="dot">
                {visited.includes(i) && step !== i ? (
                  <Check size={13} />
                ) : (
                  i + 1
                )}
              </span>
              <span className="label">{label}</span>
            </button>
          </li>
        ))}
      </ol>
      {error && (
        <Banner tone="red" role="alert">
          {error}
        </Banner>
      )}
      <div className="builder-body" key={step}>
        {step === 0 && (
          <InfoStep context={context} content={content} set={set} />
        )}
        {step === 1 && <ChecklistStep content={content} set={set} />}
        {step === 2 && <EvidenceStep content={content} set={set} />}
        {step === 3 && (
          <RaciStep context={context} content={content} set={set} />
        )}
        {step === 4 && (
          <AssignmentStep context={context} content={content} set={set} />
        )}
        {step === 5 && (
          <div>
            {publishIssues.length ? (
              <Banner
                tone="amber"
                title={`${publishIssues.length} item(s) to fix before publishing`}
              >
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {publishIssues.slice(0, 8).map((i, n) => (
                    <li key={n}>{i.message}</li>
                  ))}
                </ul>
              </Banner>
            ) : (
              <Banner tone="green" title="Ready to publish">
                Publishing freezes this version. Existing tasks keep their own
                copies; new tasks will use this version.
              </Banner>
            )}
            <VersionSummary content={content} context={context} />
            <h3 style={{ margin: '18px 0 10px' }}>Staff checklist preview</h3>
            <PreviewChecklist content={content} />
          </div>
        )}
      </div>
      <div className="builder-foot">
        <button
          type="button"
          className="btn btn-outline"
          disabled={step === 0}
          onClick={() => go(step - 1)}
        >
          Back
        </button>
        <span className="muted small">
          Step {step + 1} of {steps.length}
          {dirty ? ' · unsaved changes' : ''}
        </span>
        {step < steps.length - 1 ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => go(step + 1)}
          >
            Next: {steps[step + 1]}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || publishIssues.length > 0}
            onClick={() => setPublish(true)}
          >
            <Send /> Publish version {saved.version}
          </button>
        )}
      </div>
      {publish && (
        <ConfirmDialog
          title={`Publish version ${saved.version}?`}
          confirmLabel="Publish"
          tone="blue"
          busy={busy}
          onCancel={() => setPublish(false)}
          onConfirm={() => void save(true)}
        >
          This version becomes read-only and available for new tasks. To change
          it later, copy it into a new draft.
        </ConfirmDialog>
      )}
      {leave && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          confirmLabel="Discard changes"
          onCancel={() => setLeave(false)}
          onConfirm={onClose}
        >
          Changes made since the last save will be lost.
        </ConfirmDialog>
      )}
    </div>
  );
}
function PreviewChecklist({ content }: { content: VersionContent }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <ChecklistForm content={content} answers={answers} onChange={setAnswers} />
  );
}

/* ================================================================ steps */
type StepProps = {
  content: VersionContent;
  set: (p: Partial<VersionContent>) => void;
};
function Toggle({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="track" aria-hidden />
      <span>
        <strong>{label}</strong>
        {help && <span className="help">{help}</span>}
      </span>
    </label>
  );
}
function InfoStep({ context, content, set }: StepProps & { context: Context }) {
  return (
    <div className="form-grid">
      <div className="field wide">
        <label htmlFor="tpl-title">
          Checklist title
          <span className="req" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id="tpl-title"
          className="input"
          maxLength={120}
          value={content.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>
      <div className="field wide">
        <label htmlFor="tpl-instructions">Instructions for staff</label>
        <textarea
          id="tpl-instructions"
          className="input"
          rows={4}
          maxLength={4000}
          value={content.instructions}
          onChange={(e) => set({ instructions: e.target.value })}
          placeholder="Safety precautions, tools needed and how to perform the task."
        />
      </div>
      <div className="field">
        <label htmlFor="tpl-priority">Priority</label>
        <select
          id="tpl-priority"
          className="input"
          value={content.priority}
          onChange={(e) =>
            set({ priority: e.target.value as VersionContent['priority'] })
          }
        >
          {priorities.map((p) => (
            <option key={p} value={p}>
              {humanize(p)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="tpl-duration">Estimated duration (minutes)</label>
        <input
          id="tpl-duration"
          className="input"
          inputMode="numeric"
          value={String(content.estimatedMinutes)}
          onChange={(e) =>
            set({
              estimatedMinutes: Math.max(
                1,
                Math.min(1440, Number(e.target.value.replace(/\D/g, '')) || 1),
              ),
            })
          }
        />
      </div>
      <div className="field wide">
        <Toggle
          label="Approval required"
          checked={content.approvalRequired}
          onChange={(v) => set({ approvalRequired: v })}
          help="Submitted work waits for a supervisor's decision. Without approval, submission completes the task."
        />
      </div>
      <div className="field wide">
        <span className="field-label">Applicable site types</span>
        <div className="chips">
          {siteTypes.map((t) => (
            <button
              type="button"
              key={t}
              className="chip-toggle"
              aria-pressed={content.siteTypes.includes(t)}
              onClick={() =>
                set({
                  siteTypes: content.siteTypes.includes(t)
                    ? content.siteTypes.filter((x) => x !== t)
                    : [...content.siteTypes, t],
                })
              }
            >
              {t}
            </button>
          ))}
        </div>
        <span className="help">Leave empty to allow every site type.</span>
      </div>
      <RefList
        context={context}
        kind="facilityTypes"
        label="Applicable facility types"
        ids={content.facilityTypeIds}
        onChange={(ids) => set({ facilityTypeIds: ids })}
      />
      <RefList
        context={context}
        kind="assetCategories"
        label="Applicable asset categories"
        ids={content.assetCategoryIds}
        onChange={(ids) => set({ assetCategoryIds: ids })}
      />
    </div>
  );
}
function RefChip({
  context,
  kind,
  id,
  onRemove,
}: {
  context: Context;
  kind: Kind;
  id: string;
  onRemove: () => void;
}) {
  const label = useLabel(context, kind, id);
  return (
    <span className="pill tone-blue">
      {label.text}
      <button
        type="button"
        className="chip-x"
        aria-label={`Remove ${label.text}`}
        onClick={onRemove}
      >
        ×
      </button>
    </span>
  );
}
function RefList({
  context,
  kind,
  label,
  ids,
  onChange,
}: {
  context: Context;
  kind: Kind;
  label: string;
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <Picker
        context={context}
        kind={kind}
        label={label}
        value=""
        placeholder={`Add ${definitions[kind].singular}`}
        onChange={(v) =>
          v && !ids.includes(v) && onChange([...ids, v].slice(0, 20))
        }
      />
      <div className="chips">
        {ids.map((id) => (
          <RefChip
            key={id}
            context={context}
            kind={kind}
            id={id}
            onRemove={() => onChange(ids.filter((x) => x !== id))}
          />
        ))}
      </div>
    </div>
  );
}
function ChecklistStep({ content, set }: StepProps) {
  const [open, setOpen] = useState<string | null>(
      content.questions[0]?.id ?? null,
    ),
    [dragging, setDragging] = useState<string | null>(null);
  const updateQ = (id: string, patch: Partial<Question>) =>
    set({
      questions: content.questions.map((q) =>
        q.id === id ? { ...q, ...patch } : q,
      ),
    });
  function addQuestion(sectionId: string, type: AnswerType) {
    const q = { ...newQuestion(sectionId, type, content.questions), label: '' };
    set({ questions: [...content.questions, q] });
    setOpen(q.id);
  }
  function move(id: string, delta: -1 | 1) {
    const list = content.questions;
    const i = list.findIndex((q) => q.id === id);
    const siblings = list
      .map((q, n) => ({ q, n }))
      .filter((x) => x.q.sectionId === list[i].sectionId);
    const pos = siblings.findIndex((x) => x.n === i);
    const target = siblings[pos + delta];
    if (!target) return;
    set({ questions: swap(list, i, target.n) });
  }
  function swap(list: Question[], a: number, b: number) {
    const next = [...list];
    [next[a], next[b]] = [next[b], next[a]];
    return next;
  }
  function dropOn(targetId: string) {
    if (!dragging || dragging === targetId) return;
    const list = [...content.questions];
    const from = list.findIndex((q) => q.id === dragging);
    const [item] = list.splice(from, 1);
    const to = list.findIndex((q) => q.id === targetId);
    list.splice(to, 0, {
      ...item,
      sectionId: list[to]?.sectionId ?? item.sectionId,
    });
    set({ questions: list });
    setDragging(null);
  }
  function removeQuestion(id: string) {
    set({
      questions: content.questions
        .filter((q) => q.id !== id)
        .map((q) => (q.showIf?.questionId === id ? { ...q, showIf: null } : q)),
    });
  }
  const sectionIds = content.sections.map((s) => s.id);
  return (
    <div>
      <p className="muted" style={{ marginBottom: 14 }}>
        Group questions into sections. Drag a question by its handle, or use the
        arrows to reorder.
      </p>
      {content.sections.map((s, si) => {
        const qs = content.questions.filter((q) => q.sectionId === s.id);
        return (
          <section key={s.id} className="builder-section">
            <div className="builder-section-head">
              <input
                className="input section-title"
                aria-label={`Section ${si + 1} title`}
                value={s.title}
                maxLength={80}
                onChange={(e) =>
                  set({
                    sections: content.sections.map((x) =>
                      x.id === s.id ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="icon-btn sm"
                aria-label="Move section up"
                disabled={si === 0}
                onClick={() =>
                  set({ sections: moveItem(content.sections, si, -1) })
                }
              >
                <ArrowUp />
              </button>
              <button
                type="button"
                className="icon-btn sm"
                aria-label="Move section down"
                disabled={si === content.sections.length - 1}
                onClick={() =>
                  set({ sections: moveItem(content.sections, si, 1) })
                }
              >
                <ArrowDown />
              </button>
              <button
                type="button"
                className="icon-btn sm"
                aria-label="Remove section"
                disabled={qs.length > 0 || content.sections.length === 1}
                title={
                  qs.length
                    ? 'Move or delete its questions first'
                    : 'Remove section'
                }
                onClick={() =>
                  set({
                    sections: content.sections.filter((x) => x.id !== s.id),
                  })
                }
              >
                <Trash2 />
              </button>
            </div>
            {qs.map((q, qi) => (
              <div
                key={q.id}
                className={
                  'q-card ' +
                  (open === q.id ? 'open' : '') +
                  (dragging === q.id ? ' dragging' : '')
                }
                draggable
                onDragStart={() => setDragging(q.id)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOn(q.id)}
              >
                <div className="q-head">
                  <span className="grip" aria-hidden>
                    <GripVertical size={16} />
                  </span>
                  <button
                    type="button"
                    className="q-toggle"
                    aria-expanded={open === q.id}
                    onClick={() => setOpen(open === q.id ? null : q.id)}
                  >
                    {open === q.id ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    <span className="q-num">{qi + 1}</span>
                    <span className="q-label">
                      {q.label || (
                        <span className="muted">Untitled question</span>
                      )}
                    </span>
                  </button>
                  <Pill tone="blue">{answerTypeLabels[q.type]}</Pill>
                  {q.required && <Pill tone="gray">Required</Pill>}
                  <button
                    type="button"
                    className="icon-btn sm"
                    aria-label={`Move question ${qi + 1} up`}
                    disabled={qi === 0}
                    onClick={() => move(q.id, -1)}
                  >
                    <ArrowUp />
                  </button>
                  <button
                    type="button"
                    className="icon-btn sm"
                    aria-label={`Move question ${qi + 1} down`}
                    disabled={qi === qs.length - 1}
                    onClick={() => move(q.id, 1)}
                  >
                    <ArrowDown />
                  </button>
                </div>
                {open === q.id && (
                  <QuestionEditor
                    q={q}
                    content={content}
                    sectionIds={sectionIds}
                    update={(p) => updateQ(q.id, p)}
                    onDuplicate={() => {
                      const copy = {
                        ...q,
                        ...newQuestion(q.sectionId, q.type, content.questions),
                        label: q.label + ' (copy)',
                        choices: [...q.choices],
                        showIf: null,
                      };
                      const i = content.questions.findIndex(
                        (x) => x.id === q.id,
                      );
                      set({
                        questions: [
                          ...content.questions.slice(0, i + 1),
                          { ...q, ...copy, id: copy.id },
                          ...content.questions.slice(i + 1),
                        ],
                      });
                      setOpen(copy.id);
                    }}
                    onRemove={() => removeQuestion(q.id)}
                  />
                )}
              </div>
            ))}
            <AddQuestion onAdd={(t) => addQuestion(s.id, t)} />
          </section>
        );
      })}
      <button
        type="button"
        className="btn btn-outline"
        disabled={content.sections.length >= 20}
        onClick={() => {
          let n = content.sections.length + 1;
          while (content.sections.some((x) => x.id === 's' + n)) n++;
          set({
            sections: [
              ...content.sections,
              { id: 's' + n, title: 'New section' },
            ],
          });
        }}
      >
        <Plus /> Add section
      </button>
    </div>
  );
}
function AddQuestion({ onAdd }: { onAdd: (t: AnswerType) => void }) {
  const [type, setType] = useState<AnswerType>('pass_fail');
  return (
    <div className="add-question">
      <select
        className="select"
        aria-label="New question type"
        value={type}
        onChange={(e) => setType(e.target.value as AnswerType)}
      >
        {answerTypes.map((t) => (
          <option key={t} value={t}>
            {answerTypeLabels[t]}
            {deferredAnswerTypes.includes(t) ? ' (future)' : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => onAdd(type)}
      >
        <Plus /> Add question
      </button>
    </div>
  );
}
function numberField(
  label: string,
  value: number | null,
  onChange: (v: number | null) => void,
) {
  const id = 'n-' + label.replace(/\W/g, '');
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        inputMode="decimal"
        value={value === null ? '' : String(value)}
        onChange={(e) => {
          const t = e.target.value.trim();
          onChange(
            t === '' || t === '-' || isNaN(Number(t)) ? null : Number(t),
          );
        }}
      />
    </div>
  );
}
function QuestionEditor({
  q,
  content,
  update,
  onDuplicate,
  onRemove,
  sectionIds,
}: {
  q: Question;
  content: VersionContent;
  sectionIds: string[];
  update: (p: Partial<Question>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const others = content.questions.filter(
    (x) =>
      x.id !== q.id &&
      ['yes_no', 'pass_fail', 'single_choice', 'asset_condition'].includes(
        x.type,
      ),
  );
  const parent = content.questions.find((x) => x.id === q.showIf?.questionId);
  const parentValues = parent
    ? parent.type === 'yes_no'
      ? ['yes', 'no']
      : parent.type === 'pass_fail'
        ? ['pass', 'fail']
        : parent.type === 'asset_condition'
          ? ['Excellent', 'Good', 'Fair', 'Poor', 'Critical']
          : parent.choices
    : [];
  return (
    <div className="q-body">
      <div className="form-grid">
        <div className="field wide">
          <label htmlFor={'ql-' + q.id}>
            Question
            <span className="req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id={'ql-' + q.id}
            className="input"
            maxLength={200}
            value={q.label}
            placeholder="e.g. Is the AC cooling properly?"
            onChange={(e) => update({ label: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={'qt-' + q.id}>Answer type</label>
          <select
            id={'qt-' + q.id}
            className="input"
            value={q.type}
            onChange={(e) => {
              const type = e.target.value as AnswerType;
              update({
                type,
                choices: choiceAnswerTypes.includes(type)
                  ? q.choices.length >= 2
                    ? q.choices
                    : ['Option 1', 'Option 2']
                  : [],
                unit: type === 'temperature' ? q.unit || '°C' : q.unit,
              });
            }}
          >
            {answerTypes.map((t) => (
              <option key={t} value={t}>
                {answerTypeLabels[t]}
                {deferredAnswerTypes.includes(t) ? ' (future)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={'qs-' + q.id}>Section</label>
          <select
            id={'qs-' + q.id}
            className="input"
            value={q.sectionId}
            onChange={(e) => update({ sectionId: e.target.value })}
          >
            {sectionIds.map((s) => (
              <option key={s} value={s}>
                {content.sections.find((x) => x.id === s)?.title}
              </option>
            ))}
          </select>
        </div>
        <div className="field wide">
          <label htmlFor={'qh-' + q.id}>Help text</label>
          <input
            id={'qh-' + q.id}
            className="input"
            maxLength={500}
            value={q.help}
            onChange={(e) => update({ help: e.target.value })}
          />
        </div>
        {choiceAnswerTypes.includes(q.type) && (
          <div className="field wide">
            <span className="field-label">Choices</span>
            {q.choices.map((ch, i) => (
              <div key={i} className="choice-row">
                <input
                  className="input"
                  aria-label={`Choice ${i + 1}`}
                  value={ch}
                  maxLength={60}
                  onChange={(e) =>
                    update({
                      choices: q.choices.map((x, n) =>
                        n === i ? e.target.value.replaceAll('|', '') : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="icon-btn sm"
                  aria-label={`Remove choice ${i + 1}`}
                  disabled={q.choices.length <= 2}
                  onClick={() =>
                    update({ choices: q.choices.filter((_, n) => n !== i) })
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={q.choices.length >= 20}
              onClick={() =>
                update({
                  choices: [...q.choices, `Option ${q.choices.length + 1}`],
                })
              }
            >
              <Plus /> Add choice
            </button>
          </div>
        )}
        {numericAnswerTypes.includes(q.type) && (
          <>
            <div className="field">
              <label htmlFor={'qu-' + q.id}>Unit</label>
              <input
                id={'qu-' + q.id}
                className="input"
                maxLength={20}
                value={q.unit}
                placeholder="°C, ppm, pH"
                onChange={(e) => update({ unit: e.target.value })}
              />
            </div>
            <div />
            {numberField('Minimum allowed', q.min, (v) => update({ min: v }))}
            {numberField('Maximum allowed', q.max, (v) => update({ max: v }))}
            {numberField('Expected from', q.expectedMin, (v) =>
              update({ expectedMin: v }),
            )}
            {numberField('Expected to', q.expectedMax, (v) =>
              update({ expectedMax: v }),
            )}
            {numberField('Critical below', q.criticalMin, (v) =>
              update({ criticalMin: v }),
            )}
            {numberField('Critical above', q.criticalMax, (v) =>
              update({ criticalMax: v }),
            )}
            <p className="help wide">
              Values outside the allowed range are rejected. Outside the
              expected range they are accepted and raised as a warning
              exception; outside the critical limits, as a critical exception.
            </p>
          </>
        )}
        <div className="field">
          <span className="field-label">Show only when</span>
          <select
            className="input"
            aria-label="Condition question"
            value={q.showIf?.questionId || ''}
            onChange={(e) =>
              update({
                showIf: e.target.value
                  ? { questionId: e.target.value, equals: '' }
                  : null,
              })
            }
          >
            <option value="">Always show</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label || o.id}
              </option>
            ))}
          </select>
        </div>
        {q.showIf && (
          <div className="field">
            <span className="field-label">…is answered</span>
            <select
              className="input"
              aria-label="Condition answer"
              value={q.showIf.equals}
              onChange={(e) =>
                update({ showIf: { ...q.showIf!, equals: e.target.value } })
              }
            >
              <option value="">Choose answer</option>
              {parentValues.map((v) => (
                <option key={v} value={v}>
                  {humanize(v)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field wide toggles">
          <Toggle
            label="Required"
            checked={q.required}
            onChange={(v) => update({ required: v })}
          />
          <Toggle
            label="Escalate on failure"
            checked={q.escalateOnFail}
            onChange={(v) => update({ escalateOnFail: v })}
            help="Failures become critical exceptions for follow-up."
          />
        </div>
      </div>
      <div className="q-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onDuplicate}
        >
          <Copy /> Duplicate
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm danger-text"
          onClick={onRemove}
        >
          <Trash2 /> Delete question
        </button>
      </div>
    </div>
  );
}
function EvidenceStep({ content, set }: StepProps) {
  return (
    <div>
      <Banner tone="blue" title="Evidence capture">
        Photo upload needs file storage (Phase 4); QR and GPS proof need the
        mobile app (Phase 6). You can mark which questions will need evidence
        now. Until then, submissions record the evidence as{' '}
        <strong>pending</strong>, never as captured.
      </Banner>
      {!content.questions.length && <Empty title="Add questions first" />}
      <div className="table-wrap" style={{ marginTop: 12 }}>
        {content.questions.length > 0 && (
          <table className="data">
            <thead>
              <tr>
                <th>Question</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {content.questions.map((q) => (
                <tr key={q.id}>
                  <td>
                    {q.label || (
                      <span className="muted">Untitled question</span>
                    )}
                  </td>
                  <td>
                    <Segmented
                      label={`Evidence for ${q.label || q.id}`}
                      value={q.evidence}
                      onChange={(v) =>
                        set({
                          questions: content.questions.map((x) =>
                            x.id === q.id ? { ...x, evidence: v } : x,
                          ),
                        })
                      }
                      options={evidenceKinds.map((e) => ({
                        value: e,
                        label: e === 'none' ? 'None' : e.toUpperCase(),
                      }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
function RaciRow({
  context,
  entry,
  update,
  remove,
}: {
  context: Context;
  entry: RaciEntry;
  update: (p: Partial<RaciEntry>) => void;
  remove: () => void;
}) {
  return (
    <div className="raci-row">
      <Segmented
        label="Responsibility"
        value={entry.letter}
        onChange={(v) => update({ letter: v })}
        options={raciLetters.map((l) => ({
          value: l,
          label: `${l} · ${raciLabels[l]}`,
        }))}
      />
      <select
        className="select"
        aria-label="Assign by"
        value={entry.kind}
        onChange={(e) =>
          update({
            kind: e.target.value as RaciEntry['kind'],
            refId: '',
            label: '',
          })
        }
      >
        {raciKinds.map((k) => (
          <option key={k} value={k}>
            {humanize(k)}
          </option>
        ))}
      </select>
      <div className="raci-ref">
        <Picker
          context={context}
          kind={raciKind[entry.kind]}
          label={humanize(entry.kind)}
          value={entry.refId}
          onChange={(v) => update({ refId: v })}
        />
      </div>
      <div className="raci-ref">
        <Picker
          context={context}
          kind="sites"
          label="Site scope"
          placeholder="All sites"
          value={entry.siteId}
          onChange={(v) => update({ siteId: v })}
        />
      </div>
      <button
        type="button"
        className="icon-btn sm"
        aria-label="Remove responsibility"
        onClick={remove}
      >
        <Trash2 />
      </button>
    </div>
  );
}
function RaciStep({ context, content, set }: StepProps & { context: Context }) {
  const updateEntry = (id: string, p: Partial<RaciEntry>) =>
    set({ raci: content.raci.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  return (
    <div>
      <Banner tone="blue" title="RACI describes responsibility, not access">
        Approval rights are always checked against company membership and
        security rules. Every approval-required template needs one Accountable
        owner. The task keeps a snapshot of this matrix when it is created.
      </Banner>
      <div className="raci-matrix">
        {raciLetters.map((l) => (
          <div key={l} className="raci-cell">
            <span className={'raci-letter l' + l}>{l}</span>
            <div>
              <strong>{raciLabels[l]}</strong>
              <div className="small muted">
                {content.raci.filter((r) => r.letter === l).length || 'None'}{' '}
                assigned
              </div>
            </div>
          </div>
        ))}
      </div>
      {content.raci.map((r) => (
        <RaciRow
          key={r.id}
          context={context}
          entry={r}
          update={(p) => updateEntry(r.id, p)}
          remove={() =>
            set({ raci: content.raci.filter((x) => x.id !== r.id) })
          }
        />
      ))}
      <button
        type="button"
        className="btn btn-outline"
        disabled={content.raci.length >= 30}
        onClick={() => {
          let n = content.raci.length + 1;
          while (content.raci.some((x) => x.id === 'r' + n)) n++;
          set({
            raci: [
              ...content.raci,
              {
                id: 'r' + n,
                letter: content.raci.length ? 'C' : 'R',
                kind: 'designation',
                refId: '',
                label: '',
                siteId: '',
              },
            ],
          });
        }}
      >
        <Plus /> Add responsibility
      </button>
      {content.raci.some((r) => !r.refId) && (
        <p className="err" style={{ marginTop: 8 }}>
          Choose who each responsibility applies to.
        </p>
      )}
    </div>
  );
}
function AssignmentStep({
  context,
  content,
  set,
}: StepProps & { context: Context }) {
  const a = content.assignment;
  const [preview, setPreview] = useState<string[]>(),
    [busy, setBusy] = useState(false);
  const kind = assignKind[a.mode];
  return (
    <div>
      <Banner tone="blue" title="Defaults for new tasks">
        These defaults pre-fill the assignment when a task is created. Automatic
        daily or weekly generation arrives with the Phase 4 scheduler; in Phase
        3 tasks are created manually.
      </Banner>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <div className="field wide">
          <span className="field-label">Assign by</span>
          <Segmented
            label="Assign by"
            value={a.mode}
            onChange={(mode) => {
              set({ assignment: { ...a, mode, refId: '' } });
              setPreview(undefined);
            }}
            options={assignmentModes.map((m) => ({
              value: m,
              label: m === 'manual' ? 'Choose per task' : humanize(m),
            }))}
          />
        </div>
        {kind && (
          <div className="field">
            <span className="field-label">{humanize(a.mode)}</span>
            <Picker
              context={context}
              kind={kind}
              label={humanize(a.mode)}
              value={a.refId}
              onChange={(v) => {
                set({ assignment: { ...a, refId: v } });
                setPreview(undefined);
              }}
            />
          </div>
        )}
        {a.mode !== 'site' && a.mode !== 'manual' && (
          <div className="field">
            <span className="field-label">Limit to site</span>
            <Picker
              context={context}
              kind="sites"
              label="Site"
              placeholder="Any site"
              value={a.siteId}
              onChange={(v) => set({ assignment: { ...a, siteId: v } })}
            />
          </div>
        )}
      </div>
      {a.mode !== 'manual' && (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy || !a.refId}
            onClick={async () => {
              setBusy(true);
              try {
                setPreview(
                  await eligibleEmployees(
                    context.services.db,
                    context.company.companyId,
                    a,
                  ),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Users /> Preview eligible employees
          </button>
          {preview && (
            <div className="chips" style={{ marginTop: 10 }}>
              {preview.length ? (
                preview.map((id) => (
                  <EmployeeChip key={id} context={context} id={id} />
                ))
              ) : (
                <span className="muted">
                  No active employees match this rule yet.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function EmployeeChip({ context, id }: { context: Context; id: string }) {
  return (
    <span className="pill tone-green">
      {useLabel(context, 'employees', id).text}
    </span>
  );
}
function RaciLabel({ context, r }: { context: Context; r: RaciEntry }) {
  const label = useLabel(context, raciKind[r.kind], r.refId);
  const site = useLabel(context, 'sites', r.siteId);
  return (
    <span>
      {r.refId ? label.text : <span className="muted">Not chosen</span>}{' '}
      <span className="muted small">
        ({humanize(r.kind)}
        {r.siteId ? ' · ' + site.text : ''})
      </span>
    </span>
  );
}
export function VersionSummary({
  context,
  content,
}: {
  context: Context;
  content: VersionContent;
}) {
  return (
    <div className="summary-grid">
      <dl className="facts">
        <div className="fact">
          <dt>Priority</dt>
          <dd>
            <StatusPill
              value={
                content.priority === 'critical'
                  ? 'Critical'
                  : content.priority === 'high'
                    ? 'Poor'
                    : 'active'
              }
            />{' '}
            {humanize(content.priority)}
          </dd>
        </div>
        <div className="fact">
          <dt>Estimated duration</dt>
          <dd>{content.estimatedMinutes} min</dd>
        </div>
        <div className="fact">
          <dt>Approval</dt>
          <dd>{content.approvalRequired ? 'Required' : 'Not required'}</dd>
        </div>
        <div className="fact">
          <dt>Questions</dt>
          <dd>
            {content.questions.length} in {content.sections.length} section(s)
          </dd>
        </div>
      </dl>
      {content.instructions && (
        <Banner tone="blue" title="Instructions">
          <span style={{ whiteSpace: 'pre-wrap' }}>{content.instructions}</span>
        </Banner>
      )}
      <div className="raci-list">
        {content.raci.map((r) => (
          <div key={r.id} className="raci-item">
            <span className={'raci-letter l' + r.letter}>{r.letter}</span>
            <RaciLabel context={context} r={r} />
          </div>
        ))}
        {!content.raci.length && (
          <p className="muted small">
            <Info size={14} /> No responsibilities defined.
          </p>
        )}
      </div>
    </div>
  );
}
