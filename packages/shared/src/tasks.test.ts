import { describe, it, expect } from 'vitest';
import {
  answerTypes,
  canPerform,
  contentIssues,
  conditionCycle,
  emptyContent,
  evaluateAnswer,
  evaluateSubmission,
  isOverdue,
  moveItem,
  newQuestion,
  occurrenceKey,
  taskReference,
  transitions,
  type Question,
  type VersionContent,
} from './tasks';

const q = (over: Partial<Question>): Question => ({
  ...newQuestion('s1', over.type || 'pass_fail'),
  label: 'Check',
  ...over,
});
function acTemplate(): VersionContent {
  return {
    ...emptyContent('Daily AC inspection'),
    questions: [
      q({
        id: 'q1',
        type: 'pass_fail',
        label: 'AC operating',
        escalateOnFail: true,
      }),
      q({
        id: 'q2',
        type: 'temperature',
        label: 'Supply air temperature',
        unit: '°C',
        min: -10,
        max: 60,
        expectedMin: 12,
        expectedMax: 18,
        criticalMin: 5,
        criticalMax: 26,
      }),
      q({ id: 'q3', type: 'yes_no', label: 'Water leakage found?' }),
      q({
        id: 'q4',
        type: 'long_text',
        label: 'Describe the leak',
        showIf: { questionId: 'q3', equals: 'yes' },
      }),
      q({ id: 'q5', type: 'text', label: 'Remarks', required: false }),
    ],
    raci: [
      {
        id: 'r1',
        letter: 'R',
        kind: 'designation',
        refId: 'tech',
        label: 'HVAC technician',
        siteId: '',
      },
      {
        id: 'r2',
        letter: 'A',
        kind: 'designation',
        refId: 'sup',
        label: 'Maintenance supervisor',
        siteId: '',
      },
    ],
  };
}

describe('checklist answers', () => {
  it('validates every answer type', () => {
    const cases: [Question, string, boolean][] = [
      [q({ type: 'yes_no' }), 'yes', true],
      [q({ type: 'yes_no' }), 'maybe', false],
      [q({ type: 'pass_fail' }), 'pass', true],
      [q({ type: 'single_choice', choices: ['A', 'B'] }), 'B', true],
      [q({ type: 'single_choice', choices: ['A', 'B'] }), 'C', false],
      [q({ type: 'multiple_choice', choices: ['A', 'B', 'C'] }), 'A|C', true],
      [q({ type: 'multiple_choice', choices: ['A', 'B'] }), 'A|Z', false],
      [q({ type: 'number' }), '12', true],
      [q({ type: 'number' }), '12.5', false],
      [q({ type: 'decimal' }), '7.25', true],
      [q({ type: 'decimal' }), 'abc', false],
      [q({ type: 'temperature' }), '-3.5', true],
      [q({ type: 'reading', unit: 'ppm' }), '2.1', true],
      [q({ type: 'text' }), 'ok', true],
      [q({ type: 'text' }), 'x'.repeat(501), false],
      [q({ type: 'long_text' }), 'Long note', true],
      [q({ type: 'date' }), '2026-02-30', false],
      [q({ type: 'date' }), '2026-02-28', true],
      [q({ type: 'time' }), '25:00', false],
      [q({ type: 'time' }), '07:30', true],
      [q({ type: 'asset_condition' }), 'Good', true],
      [q({ type: 'asset_condition' }), 'Broken', false],
      [q({ type: 'photo' }), 'x', false],
    ];
    for (const [question, value, ok] of cases)
      expect(
        !evaluateAnswer(question, value).error,
        `${question.type}=${value}`,
      ).toBe(ok);
    expect(answerTypes.length).toBe(16);
  });
  it('rejects readings outside hard limits and flags exception ranges', () => {
    const t = acTemplate().questions[1];
    expect(evaluateAnswer(t, '75').error).toMatch('at most 60');
    expect(evaluateAnswer(t, '15')).toEqual({});
    expect(evaluateAnswer(t, '20').exception?.severity).toBe('warning');
    expect(evaluateAnswer(t, '30').exception?.severity).toBe('critical');
    expect(evaluateAnswer(t, '30').exception?.reason).toContain('°C');
  });
  it('requires visible mandatory answers, drops hidden follow-ups and reports exceptions', () => {
    const c = acTemplate();
    const missing = evaluateSubmission(c, { q1: 'pass', q3: 'yes' });
    expect(Object.keys(missing.errors).sort()).toEqual(['q2', 'q4']);
    const ok = evaluateSubmission(c, {
      q1: 'fail',
      q2: '22',
      q3: 'no',
      q4: 'stale',
    });
    expect(ok.errors).toEqual({});
    expect(ok.cleaned).toEqual({ q1: 'fail', q2: '22', q3: 'no' });
    expect(ok.exceptions.map((e) => [e.questionId, e.severity])).toEqual([
      ['q1', 'critical'],
      ['q2', 'warning'],
    ]);
  });
  it('tracks deferred evidence without pretending it was captured', () => {
    const c = {
      ...acTemplate(),
      questions: [q({ id: 'q1', type: 'photo', required: false })],
    };
    const r = evaluateSubmission(c, {});
    expect(r.errors).toEqual({});
    expect(r.evidencePending).toEqual(['q1']);
  });
});

describe('template content', () => {
  it('detects conditional loops and missing targets', () => {
    const c = acTemplate();
    c.questions[2] = {
      ...c.questions[2],
      showIf: { questionId: 'q4', equals: 'x' },
    };
    expect(conditionCycle(c.questions)).toEqual(['q3', 'q4', 'q3']);
    expect(contentIssues(c).some((i) => i.message.includes('loop'))).toBe(true);
    const missing = acTemplate();
    missing.questions[4].showIf = { questionId: 'q9', equals: 'x' };
    expect(
      contentIssues(missing).some((i) => i.message.includes('missing')),
    ).toBe(true);
  });
  it('gates publishing on questions, RACI and unavailable evidence', () => {
    expect(contentIssues(acTemplate(), true)).toEqual([]);
    const empty = emptyContent('X');
    const issues = contentIssues(empty, true).map((i) => i.message);
    expect(issues).toContain('Add at least one question');
    expect(issues).toContain('Name an Accountable owner for approval');
    const photo = acTemplate();
    photo.questions.push(q({ id: 'q6', type: 'photo', required: true }));
    expect(
      contentIssues(photo, true).some((i) =>
        i.message.includes('file storage'),
      ),
    ).toBe(true);
    const badRange = acTemplate();
    badRange.questions[1].expectedMin = 30;
    expect(
      contentIssues(badRange).some((i) =>
        i.message.includes('Expected minimum'),
      ),
    ).toBe(true);
    const choices = acTemplate();
    choices.questions.push(
      q({ id: 'q7', type: 'single_choice', choices: ['A'] }),
    );
    expect(
      contentIssues(choices).some((i) => i.message.includes('two choices')),
    ).toBe(true);
  });
  it('reorders questions and generates unique question IDs', () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    const a = newQuestion('s1', 'text', [{ id: 'q1' }, { id: 'q2' }]);
    expect(a.id).toBe('q3');
    expect(newQuestion('s1', 'single_choice').choices.length).toBe(2);
  });
});

describe('task lifecycle', () => {
  it('allows only the defined transitions', () => {
    expect(canPerform('start', 'assigned')).toBe(true);
    expect(canPerform('start', 'pending')).toBe(false);
    expect(canPerform('submit', 'paused')).toBe(false);
    expect(canPerform('approve', 'in_progress')).toBe(false);
    expect(canPerform('cancel', 'completed')).toBe(false);
    expect(canPerform('restart', 'rework_required')).toBe(true);
    expect(transitions.submit.to(true)).toBe('awaiting_approval');
    expect(transitions.submit.to(false)).toBe('completed');
  });
  it('derives overdue without changing workflow status', () => {
    const past = new Date('2026-01-01T00:00:00Z');
    expect(isOverdue('in_progress', past)).toBe(true);
    expect(isOverdue('completed', past)).toBe(false);
    expect(isOverdue('assigned', new Date(Date.now() + 60000))).toBe(false);
  });
  it('creates readable references and deterministic occurrence keys', () => {
    expect(taskReference(new Date('2026-11-14T10:00:00Z'))).toMatch(
      /^TSK-261114-[0-9A-Z]{6}$/,
    );
    expect(occurrenceKey('sch1', 'tpl-v2', '2026-11-15T06:00:00Z')).toBe(
      occurrenceKey('sch1', 'tpl-v2', '2026-11-15T06:00:00Z'),
    );
  });
});
