import { describe, it, expect } from 'vitest';
import {
  computeDailyHours,
  localDayBoundsUtc,
  addDaysToDateString,
  todayInTimeZone,
  type ClockSession,
  type ClockBreak,
} from '../../server/timeClockDailyHours';

const TZ = 'America/New_York';

function session(
  id: string,
  employeeId: string,
  employeeName: string,
  clockIn: string,
  clockOut: string | null
): ClockSession {
  return { id, employeeId, employeeName, clockIn, clockOut };
}

describe('localDayBoundsUtc', () => {
  it('spans exactly 24 hours on an ordinary day', () => {
    const { start, end } = localDayBoundsUtc('2026-06-15', TZ);
    expect(end.getTime() - start.getTime()).toBe(24 * 3_600_000);
  });

  it('starts at the correct UTC instant for EDT (UTC-4)', () => {
    // 2026-06-15 00:00 EDT == 2026-06-15 04:00 UTC
    const { start } = localDayBoundsUtc('2026-06-15', TZ);
    expect(start.toISOString()).toBe('2026-06-15T04:00:00.000Z');
  });

  it('is shorter than 24h on the spring-forward day and longer on the fall-back day', () => {
    // Find the actual 2026 US DST transition dates rather than hardcoding them.
    const marchSundays: string[] = [];
    for (let day = 1; day <= 31; day++) {
      const d = new Date(Date.UTC(2026, 2, day));
      if (d.getUTCDay() === 0) marchSundays.push(d.toISOString().split('T')[0]);
    }
    const novSundays: string[] = [];
    for (let day = 1; day <= 30; day++) {
      const d = new Date(Date.UTC(2026, 10, day));
      if (d.getUTCDay() === 0) novSundays.push(d.toISOString().split('T')[0]);
    }
    const springForward = marchSundays[1]; // second Sunday in March
    const fallBack = novSundays[0]; // first Sunday in November

    const spring = localDayBoundsUtc(springForward, TZ);
    const fall = localDayBoundsUtc(fallBack, TZ);
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 3_600_000);
    expect(fall.end.getTime() - fall.start.getTime()).toBe(25 * 3_600_000);
  });
});

describe('addDaysToDateString / todayInTimeZone', () => {
  it('adds and subtracts calendar days across a month boundary', () => {
    expect(addDaysToDateString('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDaysToDateString('2026-07-01', -1)).toBe('2026-06-30');
  });

  it('resolves "today" using the given timezone, not server-local/UTC', () => {
    // 11:30pm EDT on June 14 is already June 15 UTC — the two must disagree here.
    const lateEveningEdt = new Date('2026-06-15T03:30:00Z');
    expect(todayInTimeZone(TZ, lateEveningEdt)).toBe('2026-06-14');
    expect(todayInTimeZone('UTC', lateEveningEdt)).toBe('2026-06-15');
  });
});

describe('computeDailyHours', () => {
  it('computes a plain same-day session with no breaks', () => {
    const sessions = [session('s1', 'e1', 'Ava', '2026-06-15T13:00:00Z', '2026-06-15T21:00:00Z')]; // 9am-5pm EDT
    const result = computeDailyHours(sessions, [], ['2026-06-15'], TZ);
    expect(result).toEqual([{ date: '2026-06-15', employeeId: 'e1', employeeName: 'Ava', hours: 8 }]);
  });

  it('nets out an unpaid break but not a paid one', () => {
    const sessions = [session('s1', 'e1', 'Ava', '2026-06-15T13:00:00Z', '2026-06-15T21:00:00Z')]; // 8h gross
    const unpaidBreak: ClockBreak = {
      timeClockEntryId: 's1',
      breakStart: '2026-06-15T17:00:00Z',
      breakEnd: '2026-06-15T17:30:00Z',
      isPaid: false,
    };
    const paidBreak: ClockBreak = {
      timeClockEntryId: 's1',
      breakStart: '2026-06-15T18:00:00Z',
      breakEnd: '2026-06-15T18:15:00Z',
      isPaid: true,
    };
    const result = computeDailyHours(sessions, [unpaidBreak, paidBreak], ['2026-06-15'], TZ);
    expect(result[0].hours).toBe(7.5); // 8h - 0.5h unpaid; paid break not subtracted
  });

  it('ignores an open (still-on) break', () => {
    const sessions = [session('s1', 'e1', 'Ava', '2026-06-15T13:00:00Z', '2026-06-15T21:00:00Z')];
    const openBreak: ClockBreak = {
      timeClockEntryId: 's1',
      breakStart: '2026-06-15T17:00:00Z',
      breakEnd: null,
      isPaid: false,
    };
    const result = computeDailyHours(sessions, [openBreak], ['2026-06-15'], TZ);
    expect(result[0].hours).toBe(8);
  });

  it('splits an overnight session across both local days it touches', () => {
    // 10pm-2am EDT: 10pm-midnight on day 1 (2h), midnight-2am on day 2 (2h)
    const sessions = [session('s1', 'e1', 'Ava', '2026-06-15T02:00:00Z', '2026-06-15T06:00:00Z')];
    const result = computeDailyHours(sessions, [], ['2026-06-14', '2026-06-15'], TZ);
    const byDate = Object.fromEntries(result.map((r) => [r.date, r.hours]));
    expect(byDate['2026-06-14']).toBe(2);
    expect(byDate['2026-06-15']).toBe(2);
  });

  it('contributes nothing for a day not in the requested range', () => {
    const sessions = [session('s1', 'e1', 'Ava', '2026-06-15T13:00:00Z', '2026-06-15T21:00:00Z')];
    const result = computeDailyHours(sessions, [], ['2026-06-16'], TZ);
    expect(result).toEqual([]);
  });

  it('skips a session that is still clocked in', () => {
    const sessions = [session('s1', 'e1', 'Ava', '2026-06-15T13:00:00Z', null)];
    const result = computeDailyHours(sessions, [], ['2026-06-15'], TZ);
    expect(result).toEqual([]);
  });

  it('sums multiple sessions for the same employee on the same day', () => {
    const sessions = [
      session('s1', 'e1', 'Ava', '2026-06-15T13:00:00Z', '2026-06-15T17:00:00Z'), // 4h
      session('s2', 'e1', 'Ava', '2026-06-15T18:00:00Z', '2026-06-15T20:00:00Z'), // 2h
    ];
    const result = computeDailyHours(sessions, [], ['2026-06-15'], TZ);
    expect(result).toEqual([{ date: '2026-06-15', employeeId: 'e1', employeeName: 'Ava', hours: 6 }]);
  });

  it('keeps separate employees apart and sorts by date then name', () => {
    const sessions = [
      session('s1', 'e2', 'Zara', '2026-06-15T13:00:00Z', '2026-06-15T17:00:00Z'),
      session('s2', 'e1', 'Ava', '2026-06-15T13:00:00Z', '2026-06-15T17:00:00Z'),
    ];
    const result = computeDailyHours(sessions, [], ['2026-06-15'], TZ);
    expect(result.map((r) => r.employeeName)).toEqual(['Ava', 'Zara']);
  });
});
