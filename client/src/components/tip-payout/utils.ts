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
    end: sunday.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
  };
};
