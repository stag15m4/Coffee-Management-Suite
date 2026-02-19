import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { useTodayShifts, type Shift } from '@/hooks/use-shifts';
import { useTimeClockEntries, useActiveClockedIn, type TimeClockEntry } from '@/hooks/use-time-clock';
import type { UnifiedEmployee } from '@/hooks/use-all-employees';
import { ClockInOutCard } from './ClockInOutCard';
import { EditRequestsList } from './EditRequestsList';
import { ManagerClockOutDialog } from './ManagerClockOutDialog';
import { CalendarDays, Users, AlertTriangle } from 'lucide-react';
import { colors } from '@/lib/colors';

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return m > 0 ? `${hr}:${String(m).padStart(2, '0')} ${suffix}` : `${hr} ${suffix}`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function calcHours(clockIn: string, clockOut: string | null): number {
  if (!clockOut) return 0;
  return (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3_600_000;
}

function calcBreakHours(breaks: { break_start: string; break_end: string | null }[]): number {
  return breaks.reduce((sum, b) => {
    if (!b.break_end) return sum;
    return sum + (new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 3_600_000;
  }, 0);
}

function formatHoursMinutes(h: number): string {
  if (h <= 0) return '--';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

interface TodayRow {
  employeeId: string;
  name: string;
  avatar?: string | null;
  schedule: string | null; // e.g. "01:00 PM-06:00 PM (05:00h)"
  position: string | null;
  type: string | null; // "Shift" or null
  clockIn: string | null;
  clockOut: string | null;
  dailyTotal: number; // hours
  breakHours: number;
  isLateClockOut: boolean;
  hasSquareEntries: boolean;
  entries: TimeClockEntry[];
}

interface TodayViewProps {
  tenantId: string;
  canApprove: boolean;
  canViewAll: boolean;
  currentUserId: string;
  employees: UnifiedEmployee[];
  hideClockCard?: boolean;
}

export function TodayView({ tenantId, canApprove, canViewAll, currentUserId, employees, hideClockCard }: TodayViewProps) {
  const [clockOutEntry, setClockOutEntry] = useState<{ entry: TimeClockEntry; name: string } | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const { data: todayShifts, isLoading: loadingShifts } = useTodayShifts(tenantId || undefined);
  const { data: todayEntries, isLoading: loadingEntries } = useTimeClockEntries(today, today);
  // Also fetch all currently-active (clocked-in) entries regardless of date
  const { data: activeClockedIn, isLoading: loadingActive } = useActiveClockedIn(canViewAll ? tenantId : undefined);

  const rows = useMemo<TodayRow[]>(() => {
    // Build a map of employee_id -> shifts
    const shiftsByEmployee = new Map<string, Shift[]>();
    for (const s of (todayShifts ?? [])) {
      const empId = s.employee_id;
      if (!empId) continue;
      const existing = shiftsByEmployee.get(empId) || [];
      existing.push(s);
      shiftsByEmployee.set(empId, existing);
    }

    // Build a map of employee_id -> entries (merge today's entries + active from other days)
    const entriesByEmployee = new Map<string, TimeClockEntry[]>();
    const seenEntryIds = new Set<string>();

    for (const e of (todayEntries ?? [])) {
      seenEntryIds.add(e.id);
      const existing = entriesByEmployee.get(e.employee_id) || [];
      existing.push(e);
      entriesByEmployee.set(e.employee_id, existing);
    }

    // Merge in active clock entries from previous days (still clocked in)
    for (const e of (activeClockedIn ?? [])) {
      if (seenEntryIds.has(e.id)) continue; // already in today's entries
      const existing = entriesByEmployee.get(e.employee_id) || [];
      existing.push(e);
      entriesByEmployee.set(e.employee_id, existing);
    }

    // Build the set of employee IDs to display
    const allEmployeeIds = new Set<string>();

    if (canViewAll) {
      // Show ALL team members so manager sees full roster
      for (const emp of employees) {
        if (emp.user_profile_id) allEmployeeIds.add(emp.user_profile_id);
      }
      // Also include anyone with shifts or entries (in case they're not in the employee list)
      shiftsByEmployee.forEach((_, id) => allEmployeeIds.add(id));
      entriesByEmployee.forEach((_, id) => allEmployeeIds.add(id));
    } else {
      allEmployeeIds.add(currentUserId);
    }

    const result: TodayRow[] = [];
    for (const empId of Array.from(allEmployeeIds)) {
      const empShifts = shiftsByEmployee.get(empId) || [];
      const empEntries = entriesByEmployee.get(empId) || [];

      // Get employee info
      const employee = employees.find((e) => e.user_profile_id === empId);
      const name = employee?.name || empEntries[0]?.employee_name || 'Unknown';

      // Schedule from shifts
      let schedule: string | null = null;
      let position: string | null = null;
      let shiftType: string | null = null;
      if (empShifts.length > 0) {
        const s = empShifts[0];
        const dur = calcShiftDuration(s.start_time, s.end_time);
        schedule = `${formatTime(s.start_time)}-${formatTime(s.end_time)} (${dur})`;
        position = s.position;
        shiftType = 'Shift';
      }

      // Clock in/out from entries
      let clockIn: string | null = null;
      let clockOut: string | null = null;
      let dailyTotal = 0;
      let breakHours = 0;
      let isLateClockOut = false;
      let hasSquareEntries = false;

      for (const entry of empEntries) {
        if (!clockIn || new Date(entry.clock_in) < new Date(clockIn)) {
          clockIn = entry.clock_in;
        }
        if (entry.clock_out) {
          if (!clockOut || new Date(entry.clock_out) > new Date(clockOut)) {
            clockOut = entry.clock_out;
          }
        }
        dailyTotal += calcHours(entry.clock_in, entry.clock_out);
        breakHours += calcBreakHours(entry.breaks ?? []);
        if ((entry as any).source === 'square') hasSquareEntries = true;

        // Late clock-out: shift ended but not clocked out
        if (!entry.clock_out && empShifts.length > 0) {
          const now = new Date();
          const shiftEnd = empShifts[0].end_time;
          const [eh, em] = shiftEnd.split(':').map(Number);
          const endToday = new Date();
          endToday.setHours(eh, em, 0, 0);
          if (now > endToday) {
            isLateClockOut = true;
          }
        }
      }

      // If no entry position, use shift position
      if (!position && empEntries.length > 0) {
        position = (empEntries[0] as any).position ?? null;
      }

      result.push({
        employeeId: empId,
        name,
        schedule,
        position,
        type: shiftType,
        clockIn,
        clockOut,
        dailyTotal,
        breakHours,
        isLateClockOut,
        hasSquareEntries,
        entries: empEntries,
      });
    }

    // Sort: clocked-in first, then scheduled, then by name
    result.sort((a, b) => {
      const aActive = a.clockIn && !a.clockOut ? 1 : 0;
      const bActive = b.clockIn && !b.clockOut ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      if (a.schedule && !b.schedule) return -1;
      if (!a.schedule && b.schedule) return 1;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [todayShifts, todayEntries, activeClockedIn, employees, canViewAll, currentUserId]);

  const scheduledCount = rows.filter((r) => r.schedule).length;
  const clockedInCount = rows.filter((r) => r.clockIn && !r.clockOut).length;
  const lateClockOutCount = rows.filter((r) => r.isLateClockOut).length;

  const isLoading = loadingShifts || loadingEntries || loadingActive;

  return (
    <div className="space-y-4">
      {/* Clock In/Out for current user */}
      {!hideClockCard && <ClockInOutCard />}

      {/* Summary cards */}
      {canViewAll && (
        <div className="grid grid-cols-3 gap-3">
          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold" style={{ color: colors.brown }}>{scheduledCount}</p>
              <p className="text-xs" style={{ color: colors.brownLight }}>Scheduled</p>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold" style={{ color: colors.brown }}>{clockedInCount}</p>
              <p className="text-xs" style={{ color: colors.brownLight }}>Clocked In</p>
            </CardContent>
          </Card>
          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold" style={{ color: lateClockOutCount > 0 ? colors.red : colors.brown }}>
                {lateClockOutCount}
              </p>
              <p className="text-xs" style={{ color: colors.brownLight }}>Late clock-outs</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Today's attendance table */}
      {canViewAll && (
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-4">
            {isLoading ? (
              <CoffeeLoader text="Loading today's data..." />
            ) : rows.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: colors.brownLight }}>
                No team members found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.creamDark}` }}>
                      <th className="text-left py-2 px-2" style={{ color: colors.brownLight }}>Full name</th>
                      <th className="text-left py-2 px-2" style={{ color: colors.brownLight }}>Schedule</th>
                      <th className="text-left py-2 px-2" style={{ color: colors.brownLight }}>Job</th>
                      <th className="text-left py-2 px-2" style={{ color: colors.brownLight }}>Clock in</th>
                      <th className="text-left py-2 px-2" style={{ color: colors.brownLight }}>Clock out</th>
                      <th className="text-right py-2 px-2" style={{ color: colors.brownLight }}>Daily total</th>
                      <th className="text-right py-2 px-2" style={{ color: colors.brownLight }}>Breaks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.employeeId} style={{ borderBottom: `1px solid ${colors.cream}` }}>
                        <td className="py-2 px-2 font-medium" style={{ color: colors.brown }}>
                          <span className="flex items-center gap-1">
                            {row.name}
                            {row.hasSquareEntries && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0" style={{ borderColor: colors.blue, color: colors.blue }}>
                                Square
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-xs" style={{ color: colors.brownLight }}>
                          {row.schedule || '--'}
                        </td>
                        <td className="py-2 px-2" style={{ color: colors.brown }}>
                          {row.position ? (
                            <Badge style={{ backgroundColor: colors.gold, color: colors.white }} className="text-xs">
                              {row.position}
                            </Badge>
                          ) : '--'}
                        </td>
                        <td className="py-2 px-2" style={{ color: colors.brown }}>
                          {row.clockIn ? formatTimestamp(row.clockIn) : '--'}
                        </td>
                        <td className="py-2 px-2" style={{ color: colors.brown }}>
                          {row.clockOut ? formatTimestamp(row.clockOut) : row.clockIn ? (
                            (() => {
                              const activeEntry = row.entries.find(e => !e.clock_out);
                              const badge = row.isLateClockOut ? (
                                <Badge style={{ backgroundColor: colors.red, color: '#fff' }} className="gap-1 text-xs">
                                  <AlertTriangle className="w-3 h-3" /> Late
                                </Badge>
                              ) : (
                                <Badge style={{ backgroundColor: colors.green, color: '#fff' }} className="text-xs">Active</Badge>
                              );
                              return canViewAll && activeEntry ? (
                                <button onClick={() => setClockOutEntry({ entry: activeEntry, name: row.name })}
                                  className="cursor-pointer">
                                  {badge}
                                </button>
                              ) : badge;
                            })()
                          ) : '--'}
                        </td>
                        <td className="text-right py-2 px-2 font-medium" style={{ color: colors.brown }}>
                          {row.dailyTotal > 0 ? formatHoursMinutes(row.dailyTotal) : '--'}
                        </td>
                        <td className="text-right py-2 px-2" style={{ color: colors.brownLight }}>
                          {row.breakHours > 0 ? formatHoursMinutes(row.breakHours) : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit requests */}
      <EditRequestsList canApprove={canApprove} currentUserId={currentUserId} />

      {/* Manager clock-out dialog */}
      {clockOutEntry && (
        <ManagerClockOutDialog
          entry={clockOutEntry.entry}
          employeeName={clockOutEntry.name}
          onClose={() => setClockOutEntry(null)}
        />
      )}
    </div>
  );
}

function calcShiftDuration(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}h`;
}
