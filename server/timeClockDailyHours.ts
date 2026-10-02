/**
 * Computes net labor hours per employee per local calendar day from raw
 * time clock sessions — "how many hours do I owe for day X."
 *
 * Clock timestamps are stored in UTC and there is no stored tenant
 * timezone (the rest of the app leaves "today" to the viewer's browser),
 * so the caller supplies an IANA timezone, same as the explicit
 * p_timezone pattern already used for timesheet approval/export
 * (migration 152). Net hours = gross session time minus only UNPAID
 * breaks (is_paid = true breaks still count as worked time), matching
 * calcNetHoursFromEntry — the formula already used for payroll/tip
 * import elsewhere in this app.
 */

export interface ClockSession {
  id: string;
  employeeId: string;
  employeeName: string;
  clockIn: string; // ISO timestamp
  clockOut: string | null;
}

export interface ClockBreak {
  timeClockEntryId: string;
  breakStart: string;
  breakEnd: string | null;
  isPaid: boolean;
}

export interface DailyEmployeeHours {
  date: string;
  employeeId: string;
  employeeName: string;
  hours: number;
}

function timezoneOffsetMinutes(instant: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(instant).map((p) => [p.type, p.value]));
  // Some ICU builds format midnight as hour "24" under hour12:false — normalize.
  const hour = Number(parts.hour) % 24;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUtc - instant.getTime()) / 60000;
}

export function addDaysToDateString(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** Today's local calendar date (YYYY-MM-DD) in the given IANA timezone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(now);
}

function localMidnightUtc(date: string, timeZone: string): Date {
  const guess = new Date(`${date}T00:00:00Z`);
  const offsetMin = timezoneOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offsetMin * 60000);
}

/**
 * [start, end) UTC instants spanning one local calendar day in `timeZone`.
 * Each boundary's offset is resolved independently from its own midnight,
 * which is safe for US timezones since DST transitions happen at 2am
 * local, never at midnight.
 */
export function localDayBoundsUtc(date: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: localMidnightUtc(date, timeZone),
    end: localMidnightUtc(addDaysToDateString(date, 1), timeZone),
  };
}

function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/**
 * Buckets sessions (and their unpaid breaks) into net hours per employee
 * per requested local day. Sessions still clocked in (no clock_out) are
 * skipped — there is nothing billable yet to attribute to a closed day.
 * A session spanning midnight contributes only the portion that actually
 * falls within each requested day (computed from real overlap, not an
 * approximation), so hours never get double-counted or dropped across the
 * boundary.
 */
export function computeDailyHours(
  sessions: ClockSession[],
  breaks: ClockBreak[],
  dates: string[],
  timeZone: string
): DailyEmployeeHours[] {
  const breaksByEntry = new Map<string, ClockBreak[]>();
  for (const b of breaks) {
    if (!b.breakEnd || b.isPaid) continue; // open or paid — never nets out worked time
    const list = breaksByEntry.get(b.timeClockEntryId) ?? [];
    list.push(b);
    breaksByEntry.set(b.timeClockEntryId, list);
  }

  const totals = new Map<string, Map<string, { name: string; hours: number }>>();

  for (const date of dates) {
    const { start, end } = localDayBoundsUtc(date, timeZone);
    const dayStart = start.getTime();
    const dayEnd = end.getTime();

    for (const session of sessions) {
      if (!session.clockOut) continue;
      const sessionStart = new Date(session.clockIn).getTime();
      const sessionEnd = new Date(session.clockOut).getTime();
      if (sessionEnd <= sessionStart) continue;

      const workedMs = overlapMs(sessionStart, sessionEnd, dayStart, dayEnd);
      if (workedMs <= 0) continue;

      let breakMs = 0;
      for (const b of breaksByEntry.get(session.id) ?? []) {
        const bStart = new Date(b.breakStart).getTime();
        const bEnd = new Date(b.breakEnd!).getTime();
        if (bEnd <= bStart) continue;
        breakMs += overlapMs(bStart, bEnd, dayStart, dayEnd);
      }

      const netMs = Math.max(0, workedMs - breakMs);
      if (netMs <= 0) continue;

      const byEmployee = totals.get(date) ?? new Map<string, { name: string; hours: number }>();
      const existing = byEmployee.get(session.employeeId) ?? { name: session.employeeName, hours: 0 };
      existing.hours += netMs / 3_600_000;
      byEmployee.set(session.employeeId, existing);
      totals.set(date, byEmployee);
    }
  }

  const result: DailyEmployeeHours[] = [];
  for (const [date, byEmployee] of totals) {
    for (const [employeeId, { name, hours }] of byEmployee) {
      result.push({ date, employeeId, employeeName: name, hours: Math.round(hours * 100) / 100 });
    }
  }
  result.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
  return result;
}
