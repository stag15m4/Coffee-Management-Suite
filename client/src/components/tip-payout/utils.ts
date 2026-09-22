export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0);
};

export const formatHoursMinutes = (decimalHours: number) => {
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

/**
 * Parses the paired Hours + Minutes entry into total decimal hours.
 *
 * The Hours field previously went through `parseInt`, which silently
 * truncated a value like "35.25" down to 35 — a quarter hour vanished with
 * no error. Minutes remains the intended way to enter a partial hour, but a
 * decimal typed directly into the Hours field is honored instead of
 * discarded.
 *
 * Returns null (invalid, caller should reject) when:
 * - both fields are blank
 * - either field is not a finite number
 * - hours or minutes is negative
 * - minutes is 60 or more (partial hours belong in the Hours field)
 * - the resulting total is zero or negative
 */
export const parseHoursAndMinutes = (hoursStr: string, minutesStr: string): number | null => {
  const hTrimmed = hoursStr.trim();
  const mTrimmed = minutesStr.trim();
  if (hTrimmed === '' && mTrimmed === '') return null;

  const hours = hTrimmed === '' ? 0 : Number(hTrimmed);
  const minutes = mTrimmed === '' ? 0 : Number(mTrimmed);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || minutes < 0 || minutes >= 60) return null;

  const total = hours + minutes / 60;
  return total > 0 ? total : null;
};

export const getMonday = (date: Date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  // Use local date formatting to avoid UTC timezone shift
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
};

export interface TimeclockBreak {
  break_start: string;
  break_end: string | null;
  is_paid: boolean;
}

export interface TimeclockEntry {
  id: string;
  employee_id: string | null;
  tip_employee_id: string | null;
  employee_name: string | null;
  clock_in: string;
  clock_out: string | null;
  time_clock_breaks: TimeclockBreak[];
}

export const calcNetHoursFromEntry = (entry: TimeclockEntry): number => {
  if (!entry.clock_out) return 0;
  const gross = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3_600_000;
  const unpaidBreaks = (entry.time_clock_breaks || []).reduce((sum, b) => {
    if (!b.break_end || b.is_paid) return sum;
    return sum + (new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 3_600_000;
  }, 0);
  return Math.max(0, gross - unpaidBreaks);
};

export const getWeekRange = (weekKey: string) => {
  const monday = new Date(weekKey + 'T00:00:00');
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
    end: sunday.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
  };
};
