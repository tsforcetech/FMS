import { describe, expect, it } from 'vitest';
import {
  accuracyLevel,
  attendanceId,
  evidenceId,
  lateMinutes,
  parseQr,
} from './field';

describe('field helpers', () => {
  it('parses existing asset labels and FacilityOS codes, rejecting anything else', () => {
    expect(
      parseQr('https://tsforcetech.github.io/FMS/#/assets?open=Ab12_x'),
    ).toEqual({ kind: 'assets', id: 'Ab12_x' });
    expect(parseQr('http://127.0.0.1:5193/assets?open=XYZ')).toEqual({
      kind: 'assets',
      id: 'XYZ',
    });
    expect(parseQr('facilityos:location:LOC9')).toEqual({
      kind: 'locations',
      id: 'LOC9',
    });
    expect(parseQr('facilityos:facility:F1')).toEqual({
      kind: 'facilities',
      id: 'F1',
    });
    for (const bad of [
      '',
      'hello',
      'https://evil.test/?open=../../x',
      'facilityos:user:abc',
      'https://x/#/assets?open=a%2Fb',
      'x'.repeat(700),
    ])
      expect(parseQr(bad)).toBeNull();
  });
  it('builds stable ids and lateness', () => {
    expect(attendanceId('e1', '2026-11-15')).toBe('e1_2026-11-15');
    expect(evidenceId('t', 2, 'q1')).toBe('t_2_q1');
    expect(lateMinutes('07:00', '07:20')).toBe(20);
    expect(lateMinutes('07:00', '06:50')).toBe(0);
    expect(lateMinutes('07:00', '07:10', 15)).toBe(0);
    expect(lateMinutes('', '09:00')).toBe(0);
    expect([accuracyLevel(10), accuracyLevel(60), accuracyLevel(400)]).toEqual([
      'good',
      'fair',
      'poor',
    ]);
  });
});
