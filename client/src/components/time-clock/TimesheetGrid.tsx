import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { TimeClockEntry } from '@/hooks/use-time-clock';
import type { Shift } from '@/hooks/use-shifts';
import type { UnifiedEmployee } from '@/hooks/use-all-employees';
import type { TimesheetApproval } from '@/hooks/use-timesheet-approvals';
import { formatDayHeader } from '@/lib/pay-periods';
import { colors } from '@/lib/colors';

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

function formatHM(h: number): string {
  if (h <= 0) return '--';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

export interface EmployeeTimesheetRow {
  employeeId: string;
  name: string;
  hourlyRate: number | null;
  dayHours: Map<string, number>; // YYYY-MM-DD → net hours
  totalHours: number;
  totalPay: number | null;
  approvalStatus: string | null; // 'approved' | 'rejected' | 'pending' | null (draft)
}

interface TimesheetGridProps {
  days: string[];
  entries: TimeClockEntry[];
  employees: UnifiedEmployee[];
  approvals: TimesheetApproval[];
  searchQuery: string;
  statusFilter: string;
  onEmployeeClick: (employeeId: string) => void;
}

export function TimesheetGrid({
  days,
  entries,
  employees,
  approvals,
  searchQuery,
  statusFilter,
  onEmployeeClick,
}: TimesheetGridProps) {
  const rows = useMemo<EmployeeTimesheetRow[]>(() => {
    // Group entries by employee and day
    const entryMap = new Map<string, Map<string, TimeClockEntry[]>>();
    for (const entry of entries) {
      const empId = entry.employee_id;
      const day = new Date(entry.clock_in).toLocaleDateString('sv-SE'); // YYYY-MM-DD
      if (!entryMap.has(empId)) entryMap.set(empId, new Map());
      const dayMap = entryMap.get(empId)!;
      if (!dayMap.has(day)) dayMap.set(day, []);
      dayMap.get(day)!.push(entry);
    }

    // Build approval map
    const approvalMap = new Map<string, TimesheetApproval>();
    for (const a of approvals) {
      approvalMap.set(a.employee_id, a);
    }

    // Build rows for employees who have entries OR are in the employee list with profiles
    const employeesWithEntries = new Set(entryMap.keys());
    const profileEmployees = employees.filter((e) => e.user_profile_id);

    const result: EmployeeTimesheetRow[] = [];
    const processedIds = new Set<string>();

    for (const emp of profileEmployees) {
      const empId = emp.user_profile_id!;
      processedIds.add(empId);

      const dayMap = entryMap.get(empId);
      const dayHours = new Map<string, number>();
      let totalHours = 0;

      for (const day of days) {
        const dayEntries = dayMap?.get(day) || [];
        let netHours = 0;
        for (const e of dayEntries) {
          const total = calcHours(e.clock_in, e.clock_out);
          const breakH = calcBreakHours(e.breaks ?? []);
          netHours += Math.max(0, total - breakH);
        }
        dayHours.set(day, netHours);
        totalHours += netHours;
      }

      // Skip employees with no hours unless they have entries
      if (totalHours === 0 && !employeesWithEntries.has(empId)) continue;

      const approval = approvalMap.get(empId);
      result.push({
        employeeId: empId,
        name: emp.name,
        hourlyRate: emp.hourly_rate,
        dayHours,
        totalHours,
        totalPay: emp.hourly_rate ? totalHours * emp.hourly_rate : null,
        approvalStatus: approval?.status ?? null,
      });
    }

    // Also include any entries from unknown employees (shouldn't normally happen)
    for (const empId of Array.from(employeesWithEntries)) {
      if (processedIds.has(empId)) continue;
      const dayMap = entryMap.get(empId)!;
      const dayHours = new Map<string, number>();
      let totalHours = 0;
      for (const day of days) {
        const dayEntries = dayMap.get(day) || [];
        let netHours = 0;
        for (const e of dayEntries) {
          const total = calcHours(e.clock_in, e.clock_out);
          const breakH = calcBreakHours(e.breaks ?? []);
          netHours += Math.max(0, total - breakH);
        }
        dayHours.set(day, netHours);
        totalHours += netHours;
      }

      const firstEntry = entries.find((e) => e.employee_id === empId);
      result.push({
        employeeId: empId,
        name: firstEntry?.employee_name || 'Unknown',
        hourlyRate: null,
        dayHours,
        totalHours,
        totalPay: null,
        approvalStatus: approvalMap.get(empId)?.status ?? null,
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [days, entries, employees, approvals]);

  // Apply filters
  const filteredRows = useMemo(() => {
    let filtered = rows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'draft') {
        filtered = filtered.filter((r) => !r.approvalStatus);
      } else {
        filtered = filtered.filter((r) => r.approvalStatus === statusFilter);
      }
    }
    return filtered;
  }, [rows, searchQuery, statusFilter]);

  // Summary totals
  const grandTotalHours = filteredRows.reduce((sum, r) => sum + r.totalHours, 0);
  const grandTotalPay = filteredRows.reduce((sum, r) => sum + (r.totalPay ?? 0), 0);

  const statusBadge = (status: string | null) => {
    if (!status) return null;
    const styles: Record<string, { bg: string; color: string }> = {
      approved: { bg: colors.green, color: '#fff' },
      rejected: { bg: colors.red, color: '#fff' },
      pending: { bg: colors.yellow, color: colors.brown },
    };
    const s = styles[status] || { bg: colors.brownLight, color: '#fff' };
    return (
      <Badge className="text-[10px]" style={{ backgroundColor: s.bg, color: s.color }}>
        {status}
      </Badge>
    );
  };

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center gap-4 py-2 px-1 text-xs flex-wrap" style={{ color: colors.brownLight }}>
        <span><strong style={{ color: colors.brown }}>{formatHM(grandTotalHours)}</strong> Total Paid Hours</span>
        {grandTotalPay > 0 && (
          <span className="ml-auto font-semibold" style={{ color: colors.brown }}>
            ${grandTotalPay.toFixed(2)} Pay per dates
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `2px solid ${colors.creamDark}` }}>
              <th className="text-left py-2 px-2 sticky left-0 z-10" style={{ color: colors.brownLight, backgroundColor: colors.white, minWidth: 140 }}>
                Full name
              </th>
              {days.map((day) => (
                <th key={day} className="text-center py-2 px-1 whitespace-nowrap" style={{ color: colors.brownLight, minWidth: 60 }}>
                  {formatDayHeader(day)}
                </th>
              ))}
              <th className="text-right py-2 px-2" style={{ color: colors.brownLight, minWidth: 60 }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={days.length + 2} className="text-center py-8 text-sm" style={{ color: colors.brownLight }}>
                  No timesheet data for this period.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.employeeId}
                  className="cursor-pointer hover:opacity-80"
                  style={{ borderBottom: `1px solid ${colors.cream}` }}
                  onClick={() => onEmployeeClick(row.employeeId)}
                >
                  <td className="py-2 px-2 sticky left-0 z-10" style={{ backgroundColor: colors.white }}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: colors.brown }}>{row.name}</span>
                      {statusBadge(row.approvalStatus)}
                    </div>
                  </td>
                  {days.map((day) => {
                    const hrs = row.dayHours.get(day) || 0;
                    return (
                      <td key={day} className="text-center py-2 px-1" style={{ color: hrs > 0 ? colors.brown : colors.brownLight }}>
                        {hrs > 0 ? formatHM(hrs) : '--'}
                      </td>
                    );
                  })}
                  <td className="text-right py-2 px-2 font-semibold" style={{ color: colors.brown }}>
                    {row.totalHours > 0 ? formatHM(row.totalHours) : '--'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
