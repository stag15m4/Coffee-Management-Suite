import type { TimeClockEntry } from '@/hooks/use-time-clock';

export function timesheetSnapshot(entries: TimeClockEntry[]) {
  return entries.map(({ id, employee_id, clock_in, clock_out, updated_at }) => ({
    id,
    employee_id,
    clock_in,
    clock_out,
    updated_at,
  }));
}

export function payPeriodBounds(start: string, end: string) {
  const finish = new Date(`${end}T00:00:00`);
  finish.setDate(finish.getDate() + 1);
  return { start: new Date(`${start}T00:00:00`).toISOString(), end: finish.toISOString() };
}
