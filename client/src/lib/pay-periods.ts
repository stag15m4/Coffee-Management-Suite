/**
 * Pure pay period date math — no React dependencies.
 * Calculates pay period boundaries for weekly, biweekly, semi-monthly, and monthly cycles.
 */

export type PayPeriodType = 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly';

export interface PayPeriod {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  label: string; // e.g. "02/09 - 02/22"
}

export interface WeekGroup {
  label: string;     // e.g. "Feb 09 - Feb 15"
  days: string[];    // YYYY-MM-DD[]
}

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as YYYY-MM-DD. */
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a date string as MM/DD for period labels. */
function fmtLabel(s: string): string {
  const d = parseDate(s);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

/** Add N days to a date. */
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Last day of a given month. */
function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

function makePeriod(start: string, end: string): PayPeriod {
  return { start, end, label: `${fmtLabel(start)} - ${fmtLabel(end)}` };
}

// ─── Weekly / Biweekly ──────────────────────────────────────────────────

function getWeeklyPeriodForDate(date: Date, anchorDate: string, lengthDays: number): PayPeriod {
  const anchor = parseDate(anchorDate);
  const diffMs = date.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  const cycleOffset = Math.floor(diffDays / lengthDays);
  const start = addDays(anchor, cycleOffset * lengthDays);
  const end = addDays(start, lengthDays - 1);
  return makePeriod(fmt(start), fmt(end));
}

// ─── Semi-monthly ───────────────────────────────────────────────────────

function getSemiMonthlyPeriodForDate(date: Date): PayPeriod {
  const y = date.getFullYear();
  const m = date.getMonth();
  const day = date.getDate();
  if (day <= 15) {
    const start = new Date(y, m, 1);
    const end = new Date(y, m, 15);
    return makePeriod(fmt(start), fmt(end));
  } else {
    const start = new Date(y, m, 16);
    const end = lastDayOfMonth(y, m);
    return makePeriod(fmt(start), fmt(end));
  }
}

// ─── Monthly ────────────────────────────────────────────────────────────

function getMonthlyPeriodForDate(date: Date): PayPeriod {
  const y = date.getFullYear();
  const m = date.getMonth();
  const start = new Date(y, m, 1);
  const end = lastDayOfMonth(y, m);
  return makePeriod(fmt(start), fmt(end));
}

// ─── Public API ─────────────────────────────────────────────────────────

export function getPayPeriodForDate(date: Date, type: PayPeriodType, anchorDate: string): PayPeriod {
  switch (type) {
    case 'weekly':
      return getWeeklyPeriodForDate(date, anchorDate, 7);
    case 'biweekly':
      return getWeeklyPeriodForDate(date, anchorDate, 14);
    case 'semi_monthly':
      return getSemiMonthlyPeriodForDate(date);
    case 'monthly':
      return getMonthlyPeriodForDate(date);
  }
}

export function getCurrentPayPeriod(type: PayPeriodType, anchorDate: string): PayPeriod {
  return getPayPeriodForDate(new Date(), type, anchorDate);
}

export function getNextPayPeriod(current: PayPeriod, type: PayPeriodType, anchorDate: string): PayPeriod {
  const endDate = parseDate(current.end);
  const nextDay = addDays(endDate, 1);
  return getPayPeriodForDate(nextDay, type, anchorDate);
}

export function getPreviousPayPeriod(current: PayPeriod, type: PayPeriodType, anchorDate: string): PayPeriod {
  const startDate = parseDate(current.start);
  const prevDay = addDays(startDate, -1);
  return getPayPeriodForDate(prevDay, type, anchorDate);
}

/** Returns an array of YYYY-MM-DD strings for each day in the period. */
export function getDaysInPayPeriod(period: PayPeriod): string[] {
  const days: string[] = [];
  const start = parseDate(period.start);
  const end = parseDate(period.end);
  let current = new Date(start);
  while (current <= end) {
    days.push(fmt(current));
    current = addDays(current, 1);
  }
  return days;
}

/** Groups the days of a pay period into Mon-Sun weeks. */
export function getWeekGroupsInPeriod(period: PayPeriod): WeekGroup[] {
  const days = getDaysInPayPeriod(period);
  if (days.length === 0) return [];

  const groups: WeekGroup[] = [];
  let currentWeekDays: string[] = [];
  let currentWeekStart = '';

  for (const day of days) {
    const d = parseDate(day);
    const dow = d.getDay(); // 0=Sun, 1=Mon, ...

    // Start a new week on Monday (or on the very first day)
    if (dow === 1 && currentWeekDays.length > 0) {
      const weekEnd = currentWeekDays[currentWeekDays.length - 1];
      groups.push({
        label: formatWeekLabel(currentWeekStart, weekEnd),
        days: currentWeekDays,
      });
      currentWeekDays = [];
    }

    if (currentWeekDays.length === 0) {
      currentWeekStart = day;
    }
    currentWeekDays.push(day);
  }

  // Push the last group
  if (currentWeekDays.length > 0) {
    const weekEnd = currentWeekDays[currentWeekDays.length - 1];
    groups.push({
      label: formatWeekLabel(currentWeekStart, weekEnd),
      days: currentWeekDays,
    });
  }

  return groups;
}

function formatWeekLabel(start: string, end: string): string {
  const s = parseDate(start);
  const e = parseDate(end);
  const fmtShort = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmtShort(s)} - ${fmtShort(e)}`;
}

/** Format a day string as a short weekday name (Mon, Tue, ...). */
export function getDayOfWeekShort(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
}

/** Format a day string as a short date (Mon 2/9). */
export function formatDayHeader(dateStr: string): string {
  const d = parseDate(dateStr);
  const dow = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${dow} ${d.getMonth() + 1}/${d.getDate()}`;
}
