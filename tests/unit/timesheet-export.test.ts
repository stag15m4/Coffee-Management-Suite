import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase-queries', () => ({ supabase: {} }));
import { aggregateHoursByEmployee } from '@/components/time-clock/gusto-export';
import { payPeriodBounds } from '@/lib/timesheet-snapshot';
import type { TimeClockEntry } from '@/hooks/use-time-clock';
import type { UnifiedEmployee } from '@/hooks/use-all-employees';

const employees = [{ user_profile_id: 'employee', name: 'Employee' }] as UnifiedEmployee[];
function entry(start: string, end: string, breaks: { break_start: string; break_end: string }[] = []) {
  return { employee_id: 'employee', clock_in: start, clock_out: end, breaks } as TimeClockEntry;
}

describe('pay period export boundaries', () => {
  it('includes only the selected day of an overnight session, deducting breaks in that day', () => {
    const result = aggregateHoursByEmployee(
      [
        entry('2026-09-27T22:00:00', '2026-09-28T02:00:00', [
          { break_start: '2026-09-27T23:00:00', break_end: '2026-09-27T23:30:00' },
          { break_start: '2026-09-28T00:30:00', break_end: '2026-09-28T01:00:00' },
        ]),
      ],
      employees,
      [{ label: 'week', days: ['2026-09-28'] }]
    );
    expect(result.get('employee')?.regularHours).toBe(1.5);
  });
  it('splits hours across weeks before calculating overtime', () => {
    const result = aggregateHoursByEmployee(
      [
        entry('2026-09-27T00:00:00', '2026-09-27T23:00:00'),
        entry('2026-09-26T00:00:00', '2026-09-26T18:00:00'),
        entry('2026-09-27T23:00:00', '2026-09-28T02:00:00'),
      ],
      employees,
      [
        { label: 'first', days: ['2026-09-26', '2026-09-27'] },
        { label: 'second', days: ['2026-09-28'] },
      ]
    );
    expect(result.get('employee')).toMatchObject({ regularHours: 42, overtimeHours: 2 });
  });
  it('uses the following local midnight as the exclusive end of the period', () => {
    const bounds = payPeriodBounds('2026-09-28', '2026-10-11');
    expect(bounds.start).toBe(new Date('2026-09-28T00:00:00').toISOString());
    expect(bounds.end).toBe(new Date('2026-10-12T00:00:00').toISOString());
  });
});
