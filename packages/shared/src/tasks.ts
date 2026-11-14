import { z } from 'zod';

/**
 * Phase 3 task domain: checklist questions, template version content, answer
 * evaluation, the task state machine and helpers shared by the browser,
 * tests and (later) trusted Phase 4 schedulers.
 */

/* ------------------------------------------------------------ answer types */
export const answerTypes = [
  'yes_no',
  'pass_fail',
  'single_choice',
  'multiple_choice',
  'number',
  'decimal',
  'temperature',
  'reading',
  'text',
  'long_text',
  'date',
  'time',
  'asset_condition',
  'photo',
  'qr',
  'gps',
] as const;
export type AnswerType = (typeof answerTypes)[number];
export const answerTypeLabels: Record<AnswerType, string> = {
  yes_no: 'Yes / No',
  pass_fail: 'Pass / Fail',
  single_choice: 'Single choice',
  multiple_choice: 'Multiple choice',
  number: 'Whole number',
  decimal: 'Decimal number',
  temperature: 'Temperature',
  reading: 'Reading with unit',
  text: 'Short text',
  long_text: 'Long text',
  date: 'Date',
  time: 'Time',
  asset_condition: 'Asset condition',
  photo: 'Photo evidence',
  qr: 'QR verification',
  gps: 'GPS location',
};
/** Types that need Cloud Storage or the mobile app; not answerable in Phase 3. */
export const deferredAnswerTypes: AnswerType[] = ['photo', 'qr', 'gps'];
export const numericAnswerTypes: AnswerType[] = [
  'number',
  'decimal',
  'temperature',
  'reading',
];
export const choiceAnswerTypes: AnswerType[] = [
  'single_choice',
  'multiple_choice',
];
export const conditionValues = [
  'Excellent',
  'Good',
  'Fair',
  'Poor',
  'Critical',
];
export const evidenceKinds = ['none', 'photo', 'qr', 'gps'] as const;
export const priorities = ['low', 'medium', 'high', 'critical'] as const;
export type Priority = (typeof priorities)[number];

/* ------------------------------------------------------------ schemas */
const shortId = z.string().regex(/^[a-z][a-z0-9]{1,15}$/, 'Invalid identifier');
const docId = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const optionalDocId = z.string().regex(/^[a-zA-Z0-9_-]{0,128}$/);
const num = z.number().finite().nullable();
export const questionSchema = z
  .object({
    id: shortId,
    sectionId: shortId,
    label: z.string().trim().min(1, 'Enter the question').max(200),
    help: z.string().max(500),
    type: z.enum(answerTypes),
    required: z.boolean(),
    choices: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(60)
          .refine((c) => !c.includes('|'), 'Choices cannot contain |'),
      )
      .max(20),
    defaultValue: z.string().max(200),
    unit: z.string().max(20),
    min: num,
    max: num,
    expectedMin: num,
    expectedMax: num,
    criticalMin: num,
    criticalMax: num,
    showIf: z
      .object({ questionId: shortId, equals: z.string().max(60) })
      .nullable(),
    evidence: z.enum(evidenceKinds),
    escalateOnFail: z.boolean(),
  })
  .strict();
export type Question = z.infer<typeof questionSchema>;
export const sectionSchema = z
  .object({ id: shortId, title: z.string().trim().min(1).max(80) })
  .strict();
export type Section = z.infer<typeof sectionSchema>;
export const raciLetters = ['R', 'A', 'C', 'I'] as const;
export const raciLabels: Record<(typeof raciLetters)[number], string> = {
  R: 'Responsible',
  A: 'Accountable',
  C: 'Consulted',
  I: 'Informed',
};
export const raciKinds = [
  'designation',
  'department',
  'team',
  'employee',
] as const;
export const raciEntrySchema = z
  .object({
    id: shortId,
    letter: z.enum(raciLetters),
    kind: z.enum(raciKinds),
    refId: docId,
    label: z.string().max(160),
    siteId: optionalDocId,
  })
  .strict();
export type RaciEntry = z.infer<typeof raciEntrySchema>;
export const assignmentModes = [
  'manual',
  'employee',
  'department',
  'team',
  'shift',
  'site',
] as const;
export const assignmentSchema = z
  .object({
    mode: z.enum(assignmentModes),
    refId: optionalDocId,
    siteId: optionalDocId,
  })
  .strict();
export const versionContentSchema = z
  .object({
    title: z.string().trim().min(1, 'Enter a title').max(120),
    instructions: z.string().max(4000),
    priority: z.enum(priorities),
    estimatedMinutes: z.number().int().min(1).max(1440),
    approvalRequired: z.boolean(),
    siteTypes: z.array(z.string().max(60)).max(20),
    facilityTypeIds: z.array(docId).max(20),
    assetCategoryIds: z.array(docId).max(20),
    sections: z.array(sectionSchema).min(1).max(20),
    questions: z.array(questionSchema).max(100),
    raci: z.array(raciEntrySchema).max(30),
    assignment: assignmentSchema,
  })
  .strict();
export type VersionContent = z.infer<typeof versionContentSchema>;
export const versionStates = ['draft', 'published', 'retired'] as const;
export type VersionState = (typeof versionStates)[number];

/* ------------------------------------------------------------ builders */
export function newQuestion(
  sectionId: string,
  type: AnswerType = 'pass_fail',
  existing: { id: string }[] = [],
): Question {
  let n = existing.length + 1,
    id = 'q' + n;
  while (existing.some((q) => q.id === id)) id = 'q' + ++n;
  return {
    id,
    sectionId,
    label: '',
    help: '',
    type,
    required: true,
    choices: choiceAnswerTypes.includes(type) ? ['Option 1', 'Option 2'] : [],
    defaultValue: '',
    unit: type === 'temperature' ? '°C' : '',
    min: null,
    max: null,
    expectedMin: null,
    expectedMax: null,
    criticalMin: null,
    criticalMax: null,
    showIf: null,
    evidence: 'none',
    escalateOnFail: false,
  };
}
export function emptyContent(title = ''): VersionContent {
  return {
    title,
    instructions: '',
    priority: 'medium',
    estimatedMinutes: 30,
    approvalRequired: true,
    siteTypes: [],
    facilityTypeIds: [],
    assetCategoryIds: [],
    sections: [{ id: 's1', title: 'Checklist' }],
    questions: [],
    raci: [],
    assignment: { mode: 'manual', refId: '', siteId: '' },
  };
}
export function moveItem<T>(list: T[], index: number, delta: -1 | 1) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/* ------------------------------------------------------------ validation */
/** Finds conditional-question cycles (q1 shows when q2…, q2 shows when q1…). */
export function conditionCycle(questions: Question[]): string[] | null {
  const parent = new Map(questions.map((q) => [q.id, q.showIf?.questionId]));
  for (const q of questions) {
    const seen: string[] = [];
    let cur: string | undefined = q.id;
    while (cur) {
      if (seen.includes(cur)) return [...seen.slice(seen.indexOf(cur)), cur];
      seen.push(cur);
      cur = parent.get(cur);
    }
  }
  return null;
}
export type ContentIssue = { path: string; message: string };
/** Structural validation for drafts; `forPublish` adds the publish gate. */
export function contentIssues(
  content: VersionContent,
  forPublish = false,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const parsed = versionContentSchema.safeParse(content);
  if (!parsed.success)
    for (const i of parsed.error.issues)
      issues.push({ path: i.path.join('.'), message: i.message });
  const ids = new Set<string>();
  const sectionIds = new Set(content.sections.map((s) => s.id));
  content.questions.forEach((q, i) => {
    const at = `questions.${i}`;
    if (ids.has(q.id))
      issues.push({ path: at, message: 'Duplicate question ID' });
    ids.add(q.id);
    if (!sectionIds.has(q.sectionId))
      issues.push({ path: at, message: 'Question is not in a section' });
    if (choiceAnswerTypes.includes(q.type) && q.choices.length < 2)
      issues.push({ path: at, message: 'Add at least two choices' });
    if (
      choiceAnswerTypes.includes(q.type) &&
      new Set(q.choices).size !== q.choices.length
    )
      issues.push({ path: at, message: 'Choices must be unique' });
    for (const [lo, hi, name] of [
      [q.min, q.max, 'Allowed'],
      [q.expectedMin, q.expectedMax, 'Expected'],
      [q.criticalMin, q.criticalMax, 'Critical'],
    ] as const)
      if (lo !== null && hi !== null && lo > hi)
        issues.push({
          path: at,
          message: `${name} minimum is above its maximum`,
        });
    if (q.showIf) {
      const target = content.questions.find(
        (x) => x.id === q.showIf!.questionId,
      );
      if (!target)
        issues.push({
          path: at,
          message: 'Condition refers to a missing question',
        });
      else if (target.id === q.id)
        issues.push({
          path: at,
          message: 'A question cannot depend on itself',
        });
    }
    if (forPublish && deferredAnswerTypes.includes(q.type) && q.required)
      issues.push({
        path: at,
        message: `${answerTypeLabels[q.type]} cannot be required until ${q.type === 'photo' ? 'file storage' : 'the mobile app'} is available`,
      });
  });
  const cycle = conditionCycle(content.questions);
  if (cycle)
    issues.push({
      path: 'questions',
      message: `Conditional questions form a loop: ${cycle.join(' → ')}`,
    });
  if (forPublish) {
    if (!content.questions.length)
      issues.push({ path: 'questions', message: 'Add at least one question' });
    if (content.approvalRequired && !content.raci.some((r) => r.letter === 'A'))
      issues.push({
        path: 'raci',
        message: 'Name an Accountable owner for approval',
      });
    if (!content.raci.some((r) => r.letter === 'R'))
      issues.push({
        path: 'raci',
        message: 'Name at least one Responsible party',
      });
  }
  return issues;
}

/* ------------------------------------------------------------ answers */
export type ExceptionSeverity = 'warning' | 'critical';
export type AnswerException = {
  questionId: string;
  severity: ExceptionSeverity;
  reason: string;
};
/** Questions visible for a set of answers (conditional follow-ups). */
export function visibleQuestions(
  content: Pick<VersionContent, 'questions' | 'sections'>,
  answers: Record<string, string>,
) {
  const byId = new Map(content.questions.map((q) => [q.id, q]));
  const visible = (q: Question, depth = 0): boolean => {
    if (!q.showIf) return true;
    const parent = byId.get(q.showIf.questionId);
    if (!parent || depth > 20) return false;
    return (
      visible(parent, depth + 1) &&
      (answers[parent.id] ?? '') === q.showIf.equals
    );
  };
  const sectionOrder = new Map(content.sections.map((s, i) => [s.id, i]));
  return content.questions
    .map((q, i) => ({ q, i }))
    .sort(
      (a, b) =>
        (sectionOrder.get(a.q.sectionId) ?? 0) -
          (sectionOrder.get(b.q.sectionId) ?? 0) || a.i - b.i,
    )
    .map((x) => x.q)
    .filter((q) => visible(q));
}
const integer = /^-?(0|[1-9][0-9]{0,9})$/;
const decimal = /^-?(0|[1-9][0-9]{0,9})(\.[0-9]{1,4})?$/;
/** Validates one answer; returns an input error or a detected exception. */
export function evaluateAnswer(
  q: Question,
  raw: string,
): { error?: string; exception?: AnswerException } {
  const v = raw.trim();
  if (!v)
    return q.required && !deferredAnswerTypes.includes(q.type)
      ? { error: 'Required' }
      : {};
  const ex = (severity: ExceptionSeverity, reason: string) => ({
    exception: { questionId: q.id, severity, reason },
  });
  switch (q.type) {
    case 'yes_no':
      if (!['yes', 'no'].includes(v)) return { error: 'Choose Yes or No' };
      return v === 'no' && q.escalateOnFail ? ex('warning', 'Answered No') : {};
    case 'pass_fail':
      if (!['pass', 'fail'].includes(v))
        return { error: 'Choose Pass or Fail' };
      return v === 'fail'
        ? ex(q.escalateOnFail ? 'critical' : 'warning', 'Check failed')
        : {};
    case 'single_choice':
      return q.choices.includes(v)
        ? {}
        : { error: 'Choose one of the options' };
    case 'multiple_choice':
      return v.split('|').every((c) => q.choices.includes(c))
        ? {}
        : { error: 'Choose from the listed options' };
    case 'asset_condition':
      if (!conditionValues.includes(v)) return { error: 'Choose a condition' };
      return v === 'Critical'
        ? ex('critical', 'Condition Critical')
        : v === 'Poor'
          ? ex(q.escalateOnFail ? 'critical' : 'warning', 'Condition Poor')
          : {};
    case 'text':
      return v.length > 500 ? { error: 'Use 500 characters or fewer' } : {};
    case 'long_text':
      return v.length > 4000 ? { error: 'Use 4,000 characters or fewer' } : {};
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(v) &&
        new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v
        ? {}
        : { error: 'Enter a valid date' };
    case 'time':
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
        ? {}
        : { error: 'Enter a valid time' };
    case 'photo':
    case 'qr':
    case 'gps':
      return { error: 'This evidence type is not available yet' };
  }
  // numeric types
  if (!(q.type === 'number' ? integer : decimal).test(v))
    return {
      error:
        q.type === 'number'
          ? 'Enter a whole number'
          : 'Enter a number (up to 4 decimals)',
    };
  const n = Number(v);
  if (q.min !== null && n < q.min)
    return { error: `Must be at least ${q.min}` };
  if (q.max !== null && n > q.max) return { error: `Must be at most ${q.max}` };
  const unit = q.unit ? ' ' + q.unit : '';
  if (
    (q.criticalMin !== null && n < q.criticalMin) ||
    (q.criticalMax !== null && n > q.criticalMax)
  )
    return ex('critical', `Reading ${v}${unit} is outside the critical limits`);
  if (
    (q.expectedMin !== null && n < q.expectedMin) ||
    (q.expectedMax !== null && n > q.expectedMax)
  )
    return ex(
      q.escalateOnFail ? 'critical' : 'warning',
      `Reading ${v}${unit} is outside the expected range`,
    );
  return {};
}
/** Validates a whole checklist submission. */
export function evaluateSubmission(
  content: Pick<VersionContent, 'questions' | 'sections'>,
  answers: Record<string, string>,
) {
  const errors: Record<string, string> = {};
  const exceptions: AnswerException[] = [];
  const evidencePending: string[] = [];
  const visible = visibleQuestions(content, answers);
  for (const q of visible) {
    if (deferredAnswerTypes.includes(q.type) || q.evidence !== 'none')
      evidencePending.push(q.id);
    const r = evaluateAnswer(q, answers[q.id] ?? '');
    if (r.error && !deferredAnswerTypes.includes(q.type))
      errors[q.id] = r.error;
    if (r.exception) exceptions.push(r.exception);
  }
  const answered = visible.filter((q) => (answers[q.id] ?? '').trim()).length;
  return {
    errors,
    exceptions,
    evidencePending,
    answered,
    total: visible.filter((q) => !deferredAnswerTypes.includes(q.type)).length,
    /** Only visible answers are kept; hidden follow-ups are dropped. */
    cleaned: Object.fromEntries(
      visible
        .filter((q) => answers[q.id]?.trim())
        .map((q) => [q.id, answers[q.id].trim()]),
    ),
  };
}

/* ------------------------------------------------------------ lifecycle */
export const taskStatuses = [
  'pending',
  'assigned',
  'in_progress',
  'paused',
  'awaiting_approval',
  'rework_required',
  'rejected',
  'completed',
  'cancelled',
] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export const openStatuses: TaskStatus[] = [
  'pending',
  'assigned',
  'in_progress',
  'paused',
  'awaiting_approval',
  'rework_required',
];
export const terminalStatuses: TaskStatus[] = [
  'completed',
  'rejected',
  'cancelled',
];
export const taskActions = [
  'create',
  'assign',
  'start',
  'pause',
  'resume',
  'submit',
  'approve',
  'request_rework',
  'reject',
  'restart',
  'cancel',
  'reschedule',
] as const;
export type TaskAction = (typeof taskActions)[number];
export const actionLabels: Record<TaskAction, string> = {
  create: 'Created',
  assign: 'Assigned',
  start: 'Started',
  pause: 'Paused',
  resume: 'Resumed',
  submit: 'Submitted',
  approve: 'Approved',
  request_rework: 'Rework requested',
  reject: 'Rejected',
  restart: 'Rework started',
  cancel: 'Cancelled',
  reschedule: 'Rescheduled',
};
/** Allowed transitions. Submit resolves to awaiting_approval or completed. */
export const transitions: Record<
  Exclude<TaskAction, 'create' | 'reschedule'>,
  { from: TaskStatus[]; to: (approvalRequired: boolean) => TaskStatus }
> = {
  assign: { from: ['pending', 'assigned', 'paused'], to: () => 'assigned' },
  start: { from: ['assigned'], to: () => 'in_progress' },
  pause: { from: ['in_progress'], to: () => 'paused' },
  resume: { from: ['paused'], to: () => 'in_progress' },
  submit: {
    from: ['in_progress'],
    to: (approval) => (approval ? 'awaiting_approval' : 'completed'),
  },
  approve: { from: ['awaiting_approval'], to: () => 'completed' },
  request_rework: { from: ['awaiting_approval'], to: () => 'rework_required' },
  reject: { from: ['awaiting_approval'], to: () => 'rejected' },
  restart: { from: ['rework_required'], to: () => 'in_progress' },
  cancel: {
    from: ['pending', 'assigned', 'in_progress', 'paused', 'rework_required'],
    to: () => 'cancelled',
  },
};
/** Statuses in which a single occurrence may be moved to another time. */
export const reschedulable: TaskStatus[] = [
  'pending',
  'assigned',
  'paused',
  'rework_required',
];
export function canPerform(
  action: Exclude<TaskAction, 'create' | 'reschedule'>,
  status: TaskStatus,
) {
  return transitions[action].from.includes(status);
}
export function isOverdue(
  status: TaskStatus,
  dueAt: Date | null,
  now = new Date(),
) {
  return (
    !!dueAt &&
    !terminalStatuses.includes(status) &&
    dueAt.getTime() < now.getTime()
  );
}
export function taskReference(date = new Date()) {
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return (
    'TSK-' +
    date.toISOString().slice(2, 10).replaceAll('-', '') +
    '-' +
    r[0].toString(36).toUpperCase().padStart(6, '0').slice(0, 6)
  );
}
/**
 * Deterministic occurrence key for Phase 4 schedules: the same schedule,
 * version and planned instant always produce the same task ID, so replays
 * cannot duplicate tasks. Manual tasks use an empty key.
 */
export function occurrenceKey(
  scheduleId: string,
  versionId: string,
  plannedAtIso: string,
) {
  return `${scheduleId}_${versionId}_${plannedAtIso.replace(/[^0-9]/g, '').slice(0, 12)}`;
}
export const exceptionTypes = [
  'Out of range reading',
  'Failed check',
  'Damage',
  'Leak',
  'Safety hazard',
  'Missing item',
  'Equipment fault',
  'Other',
] as const;
