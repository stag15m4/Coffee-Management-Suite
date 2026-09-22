import { describe, it, expect } from 'vitest';
import { parseHoursAndMinutes } from '../../client/src/components/tip-payout/utils';

describe('parseHoursAndMinutes', () => {
  // The defect this replaces: `parseInt(hoursInput)` silently truncated a
  // decimal typed into the Hours field, e.g. "35.25" -> 35, losing 15
  // minutes with no error shown to the user.
  it('honors a decimal typed directly into the hours field', () => {
    expect(parseHoursAndMinutes('35.25', '0')).toBeCloseTo(35.25, 5);
    expect(parseHoursAndMinutes('35.25', '')).toBeCloseTo(35.25, 5);
  });

  it('honors a sub-one-hour decimal', () => {
    expect(parseHoursAndMinutes('0.25', '0')).toBeCloseTo(0.25, 5);
    expect(parseHoursAndMinutes('.25', '')).toBeCloseTo(0.25, 5);
  });

  it('parses whole-number hours plus minutes as before', () => {
    expect(parseHoursAndMinutes('35', '15')).toBeCloseTo(35.25, 5);
    expect(parseHoursAndMinutes('8', '0')).toBeCloseTo(8, 5);
  });

  it('treats a blank hours field as zero when minutes is present', () => {
    expect(parseHoursAndMinutes('', '30')).toBeCloseTo(0.5, 5);
  });

  it('rejects when both fields are blank', () => {
    expect(parseHoursAndMinutes('', '')).toBeNull();
  });

  it('rejects non-numeric text', () => {
    expect(parseHoursAndMinutes('abc', '0')).toBeNull();
    expect(parseHoursAndMinutes('5', 'xyz')).toBeNull();
    expect(parseHoursAndMinutes('5h', '0')).toBeNull();
  });

  it('rejects a zero total', () => {
    expect(parseHoursAndMinutes('0', '0')).toBeNull();
  });

  it('rejects negative hours', () => {
    // The Hours <input> has min="0" but the browser does not block typing
    // "-5" directly, and addHours() is called from onClick/onKeyDown rather
    // than native form submission, so this must be enforced in code too.
    expect(parseHoursAndMinutes('-5', '0')).toBeNull();
  });

  it('rejects negative minutes', () => {
    expect(parseHoursAndMinutes('1', '-10')).toBeNull();
    // Before this fix, Math.min(-10, 59) === -10 let a negative total
    // (1 - 10/60 = 0.833 here, but 0 + -10/60 would go negative and slip
    // past the old `totalHours === 0` check) reach the database.
    expect(parseHoursAndMinutes('0', '-10')).toBeNull();
  });

  it('rejects minutes of 60 or more — partial hours belong in the hours field', () => {
    expect(parseHoursAndMinutes('1', '60')).toBeNull();
    expect(parseHoursAndMinutes('1', '90')).toBeNull();
  });

  it('accepts the maximum valid minutes value', () => {
    expect(parseHoursAndMinutes('1', '59')).toBeCloseTo(1 + 59 / 60, 5);
  });
});
