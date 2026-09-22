import { describe, it, expect, beforeAll } from 'vitest';

// connecteamService transitively imports server/db.ts, which requires
// DATABASE_URL at module load. None of the functions under test touch the DB.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

let aggregateHoursByWeek: typeof import('../../server/connecteamService').aggregateHoursByWeek;
let mondayOfDate: typeof import('../../server/connecteamService').mondayOfDate;
let sundayOfWeek: typeof import('../../server/connecteamService').sundayOfWeek;

beforeAll(async () => {
  ({ aggregateHoursByWeek, mondayOfDate, sundayOfWeek } = await import('../../server/connecteamService'));
});

const TZ = 'America/New_York';

/** A shift of `hours` length starting at 9am local on the given YYYY-MM-DD. */
function shift(date: string, hours: number) {
  const startMs = new Date(`${date}T09:00:00-04:00`).getTime();
  return {
    start: { timestamp: Math.floor(startMs / 1000), timezone: TZ },
    end: { timestamp: Math.floor(startMs / 1000) + hours * 3600, timezone: TZ },
  };
}

describe('mondayOfDate', () => {
  it('snaps every day of a week back to the same Monday', () => {
    // 2026-08-24 is a Monday, 2026-08-30 the Sunday that closes that week.
    for (const d of ['2026-08-24', '2026-08-25', '2026-08-28', '2026-08-30']) {
      expect(mondayOfDate(d)).toBe('2026-08-24');
    }
  });

  it('leaves a Monday where it is', () => {
    expect(mondayOfDate('2026-08-31')).toBe('2026-08-31');
  });

  it('pulls Sunday back to the Monday that opened its week, not the next one', () => {
    expect(mondayOfDate('2026-09-06')).toBe('2026-08-31');
  });
});

describe('sundayOfWeek', () => {
  it('closes the week six days after its Monday', () => {
    expect(sundayOfWeek('2026-08-24')).toBe('2026-08-30');
    expect(sundayOfWeek('2026-08-31')).toBe('2026-09-06');
  });
});

describe('sync window snapping', () => {
  // The rolling default window is [today - 14d, today], which lands mid-week
  // on most days. Snapping is what keeps a partial week from overwriting a
  // complete one.
  it('covers the reported 8/24-9/6 period end to end from a mid-week window', () => {
    const windowStart = mondayOfDate('2026-09-08'); // a Tuesday, 14 days before 9/22
    const windowEnd = sundayOfWeek(mondayOfDate('2026-09-22'));
    expect(windowStart).toBe('2026-09-07');
    expect(windowEnd).toBe('2026-09-27');

    // Both weeks of the user's export are whole weeks once snapped.
    const exportStart = mondayOfDate('2026-08-24');
    const exportEnd = sundayOfWeek(mondayOfDate('2026-09-06'));
    expect(exportStart).toBe('2026-08-24');
    expect(exportEnd).toBe('2026-09-06');
  });

  it('marks a week as fully covered only when both ends fit inside the window', () => {
    const covered = (week: string, start: string, end: string) => week >= start && sundayOfWeek(week) <= end;

    // A raw mid-week window does not fully cover the week it starts in.
    expect(covered('2026-08-24', '2026-08-26', '2026-09-09')).toBe(false);
    // The same window snapped outward does.
    expect(covered('2026-08-24', mondayOfDate('2026-08-26'), sundayOfWeek(mondayOfDate('2026-09-09')))).toBe(true);
  });
});

describe('aggregateHoursByWeek', () => {
  it('sums a full week of shifts under that week Monday', () => {
    const result = aggregateHoursByWeek([
      {
        userId: 42,
        shifts: [
          shift('2026-08-24', 7), // Mon
          shift('2026-08-25', 7), // Tue
          shift('2026-08-27', 7), // Thu
          shift('2026-08-28', 7), // Fri
          shift('2026-08-30', 7), // Sun
        ],
      },
    ]);
    expect(result.get('42')?.get('2026-08-24')).toBeCloseTo(35, 5);
  });

  it('keeps two weeks of shifts in separate buckets', () => {
    const result = aggregateHoursByWeek([
      {
        userId: 42,
        shifts: [shift('2026-08-30', 6), shift('2026-08-31', 8)],
      },
    ]);
    const weeks = result.get('42')!;
    // Sunday 8/30 closes the 8/24 week; Monday 8/31 opens the next one.
    expect(weeks.get('2026-08-24')).toBeCloseTo(6, 5);
    expect(weeks.get('2026-08-31')).toBeCloseTo(8, 5);
  });

  it('accumulates across multiple activity entries for the same user', () => {
    const result = aggregateHoursByWeek([
      { userId: 42, shifts: [shift('2026-08-24', 7)] },
      { userId: 42, shifts: [shift('2026-08-25', 7)] },
    ]);
    expect(result.get('42')?.get('2026-08-24')).toBeCloseTo(14, 5);
  });

  it('deducts an unpaid break from the week its shift belongs to', () => {
    // A Sunday evening shift in New York is already Monday in UTC. Bucketing
    // the break by UTC would take the deduction out of the following week.
    const sundayNight = Math.floor(new Date('2026-08-30T21:00:00-04:00').getTime() / 1000);
    const result = aggregateHoursByWeek([
      {
        userId: 42,
        shifts: [
          {
            start: { timestamp: sundayNight, timezone: TZ },
            end: { timestamp: sundayNight + 4 * 3600, timezone: TZ },
          },
        ],
        manualbreaks: [
          {
            start: { timestamp: sundayNight + 3600 },
            end: { timestamp: sundayNight + 3600 + 1800 },
            isPaid: false,
          },
        ],
      },
    ]);
    const weeks = result.get('42')!;
    expect(weeks.get('2026-08-24')).toBeCloseTo(3.5, 5);
    expect(weeks.get('2026-08-31')).toBeUndefined();
  });

  it('ignores open and invalid shifts', () => {
    const start = Math.floor(new Date('2026-08-24T09:00:00-04:00').getTime() / 1000);
    const result = aggregateHoursByWeek([
      {
        userId: 42,
        shifts: [
          { start: { timestamp: start, timezone: TZ }, end: undefined },
          { start: { timestamp: start, timezone: TZ }, end: { timestamp: start, timezone: TZ } },
          shift('2026-08-24', 5),
        ],
      },
    ]);
    expect(result.get('42')?.get('2026-08-24')).toBeCloseTo(5, 5);
  });
});
