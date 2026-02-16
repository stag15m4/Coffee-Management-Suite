import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { useToast } from '@/hooks/use-toast';
import type { TimeClockEntry } from '@/hooks/use-time-clock';
import type { Shift } from '@/hooks/use-shifts';
import type { UnifiedEmployee } from '@/hooks/use-all-employees';
import {
  useEmployeeTimesheetApproval,
  useApproveTimesheet,
  useRejectTimesheet,
} from '@/hooks/use-timesheet-approvals';
import { PayPeriodNav } from './PayPeriodNav';
import { EditRequestDialog } from './EditRequestDialog';
import type { PayPeriod, WeekGroup } from '@/lib/pay-periods';
import { ChevronLeft, Check, X, Edit2, Download } from 'lucide-react';
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

function calcShiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

function formatHM(h: number): string {
  if (h <= 0) return '--';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDiff(diff: number): { text: string; color: string } {
  if (Math.abs(diff) < 0.01) return { text: '--', color: colors.brownLight };
  const sign = diff > 0 ? '+' : '-';
  const abs = Math.abs(diff);
  const hrs = Math.floor(abs);
  const mins = Math.round((abs - hrs) * 60);
  const text = `${sign} ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  return { text, color: diff > 0 ? colors.green : colors.red };
}

interface DayRow {
  date: string;
  dayLabel: string;
  type: string | null;
  job: string | null;
  start: string | null;
  end: string | null;
  totalHours: number;
  breakHours: number;
  netHours: number;
  scheduledHours: number;
  difference: number;
  entries: TimeClockEntry[];
}

interface EmployeeTimesheetViewProps {
  employeeId: string;
  employees: UnifiedEmployee[];
  entries: TimeClockEntry[];
  shifts: Shift[];
  period: PayPeriod;
  days: string[];
  weeks: WeekGroup[];
  canApprove: boolean;
  onBack: () => void;
  goNext: () => void;
  goPrev: () => void;
}

export function EmployeeTimesheetView({
  employeeId,
  employees,
  entries,
  shifts,
  period,
  days,
  weeks,
  canApprove,
  onBack,
  goNext,
  goPrev,
}: EmployeeTimesheetViewProps) {
  const { toast } = useToast();
  const [approvalNotes, setApprovalNotes] = useState('');
  const [editEntry, setEditEntry] = useState<TimeClockEntry | null>(null);

  const employee = employees.find((e) => e.user_profile_id === employeeId);
  const employeeName = employee?.name || 'Unknown';

  const { data: approval } = useEmployeeTimesheetApproval(employeeId, period.start, period.end);
  const approveTimesheet = useApproveTimesheet();
  const rejectTimesheet = useRejectTimesheet();

  // Filter entries and shifts for this employee
  const empEntries = useMemo(() =>
    entries.filter((e) => e.employee_id === employeeId)
      .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()),
    [entries, employeeId]
  );

  const empShifts = useMemo(() =>
    shifts.filter((s) => s.employee_id === employeeId),
    [shifts, employeeId]
  );

  // Build day rows grouped by week
  const dayRows = useMemo<Map<string, DayRow>>(() => {
    const shiftsByDay = new Map<string, Shift[]>();
    for (const s of empShifts) {
      const existing = shiftsByDay.get(s.date) || [];
      existing.push(s);
      shiftsByDay.set(s.date, existing);
    }

    const entriesByDay = new Map<string, TimeClockEntry[]>();
    for (const e of empEntries) {
      const day = new Date(e.clock_in).toLocaleDateString('sv-SE');
      const existing = entriesByDay.get(day) || [];
      existing.push(e);
      entriesByDay.set(day, existing);
    }

    const result = new Map<string, DayRow>();
    for (const day of days) {
      const dayShifts = shiftsByDay.get(day) || [];
      const dayEntries = entriesByDay.get(day) || [];

      // Calculate scheduled hours from shifts
      let scheduledHours = 0;
      let position: string | null = null;
      for (const s of dayShifts) {
        scheduledHours += calcShiftHours(s.start_time, s.end_time);
        if (s.position) position = s.position;
      }

      // Calculate actual hours from entries
      let totalHours = 0;
      let breakHours = 0;
      let firstStart: string | null = null;
      let lastEnd: string | null = null;

      for (const e of dayEntries) {
        totalHours += calcHours(e.clock_in, e.clock_out);
        breakHours += calcBreakHours(e.breaks ?? []);
        if (!firstStart || new Date(e.clock_in) < new Date(firstStart)) firstStart = e.clock_in;
        if (e.clock_out && (!lastEnd || new Date(e.clock_out) > new Date(lastEnd))) lastEnd = e.clock_out;
        if (!position && (e as any).position) position = (e as any).position;
      }

      const netHours = Math.max(0, totalHours - breakHours);
      const difference = scheduledHours > 0 ? netHours - scheduledHours : 0;

      // Skip days with no data
      if (dayEntries.length === 0 && dayShifts.length === 0) {
        // Still add the row with zeros for display
        result.set(day, {
          date: day,
          dayLabel: formatDayLabel(day),
          type: null,
          job: null,
          start: null,
          end: null,
          totalHours: 0,
          breakHours: 0,
          netHours: 0,
          scheduledHours,
          difference: 0,
          entries: [],
        });
        continue;
      }

      result.set(day, {
        date: day,
        dayLabel: formatDayLabel(day),
        type: dayShifts.length > 0 ? 'Shift' : dayEntries.length > 0 ? 'Extra' : null,
        job: position,
        start: firstStart ? formatTimestamp(firstStart) : null,
        end: lastEnd ? formatTimestamp(lastEnd) : null,
        totalHours,
        breakHours,
        netHours,
        scheduledHours,
        difference,
        entries: dayEntries,
      });
    }

    return result;
  }, [days, empEntries, empShifts]);

  // Summary stats
  const summary = useMemo(() => {
    let regularHours = 0;
    let breakHoursTotal = 0;
    let workedDays = 0;
    let totalScheduled = 0;

    for (const row of Array.from(dayRows.values())) {
      regularHours += row.netHours;
      breakHoursTotal += row.breakHours;
      totalScheduled += row.scheduledHours;
      if (row.netHours > 0) workedDays++;
    }

    return {
      regularHours,
      breakHours: breakHoursTotal,
      workedDays,
      totalScheduled,
      totalDifference: regularHours - totalScheduled,
      totalPay: employee?.hourly_rate ? regularHours * employee.hourly_rate : null,
    };
  }, [dayRows, employee]);

  const handleApprove = useCallback(async () => {
    try {
      await approveTimesheet.mutateAsync({
        employeeId,
        periodStart: period.start,
        periodEnd: period.end,
        managerNotes: approvalNotes || undefined,
        totalRegularHours: summary.regularHours,
        totalBreakHours: summary.breakHours,
      });
      toast({ title: 'Timesheet approved' });
      setApprovalNotes('');
    } catch {
      toast({ title: 'Error', description: 'Failed to approve timesheet.', variant: 'destructive' });
    }
  }, [approveTimesheet, employeeId, period, approvalNotes, summary, toast]);

  const handleReject = useCallback(async () => {
    try {
      await rejectTimesheet.mutateAsync({
        employeeId,
        periodStart: period.start,
        periodEnd: period.end,
        managerNotes: approvalNotes || undefined,
      });
      toast({ title: 'Timesheet rejected' });
      setApprovalNotes('');
    } catch {
      toast({ title: 'Error', description: 'Failed to reject timesheet.', variant: 'destructive' });
    }
  }, [rejectTimesheet, employeeId, period, approvalNotes, toast]);

  const handleExport = useCallback(() => {
    const headers = ['Date', 'Type', 'Job', 'Start', 'End', 'Total Hours', 'Break Hours', 'Net Hours', 'Scheduled', 'Difference'];
    const csvRows = days.map((day) => {
      const row = dayRows.get(day);
      if (!row) return null;
      return [
        row.dayLabel,
        row.type || '',
        row.job || '',
        row.start || '',
        row.end || '',
        row.totalHours.toFixed(2),
        row.breakHours.toFixed(2),
        row.netHours.toFixed(2),
        row.scheduledHours.toFixed(2),
        row.difference.toFixed(2),
      ];
    }).filter(Boolean) as string[][];

    const csv = [headers, ...csvRows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timesheet_${employeeName.replace(/\s+/g, '_')}_${period.start}_${period.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [days, dayRows, employeeName, period]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card style={{ backgroundColor: colors.white }}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={onBack}
              className="h-8 px-2" style={{ color: colors.brown }}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <span className="text-lg font-bold" style={{ color: colors.brown }}>{employeeName}</span>
            <div className="ml-auto">
              <PayPeriodNav period={period} onPrev={goPrev} onNext={goNext} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-lg font-bold" style={{ color: colors.brown }}>{formatHM(summary.regularHours)}</p>
            <p className="text-[10px]" style={{ color: colors.brownLight }}>Total Paid Hours</p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-lg font-bold" style={{ color: colors.brown }}>{summary.workedDays}</p>
            <p className="text-[10px]" style={{ color: colors.brownLight }}>Worked Days</p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-lg font-bold" style={{ color: colors.brown }}>{formatHM(summary.breakHours)}</p>
            <p className="text-[10px]" style={{ color: colors.brownLight }}>Breaks</p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-lg font-bold" style={{ color: summary.totalPay ? colors.brown : colors.brownLight }}>
              {summary.totalPay !== null ? `$${summary.totalPay.toFixed(2)}` : '--'}
            </p>
            <p className="text-[10px]" style={{ color: colors.brownLight }}>Pay per dates</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {canApprove && (
          <>
            {approval?.status === 'approved' ? (
              <Badge style={{ backgroundColor: colors.green, color: '#fff' }}>Approved</Badge>
            ) : approval?.status === 'rejected' ? (
              <Badge style={{ backgroundColor: colors.red, color: '#fff' }}>Rejected</Badge>
            ) : null}
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExport}
            style={{ borderColor: colors.creamDark, color: colors.brown }}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          {canApprove && approval?.status !== 'approved' && (
            <Button size="sm" onClick={handleApprove}
              disabled={approveTimesheet.isPending}
              style={{ backgroundColor: colors.green, color: '#fff' }}>
              <Check className="w-4 h-4 mr-1" /> Approve
            </Button>
          )}
        </div>
      </div>

      {/* Detailed table grouped by week */}
      {weeks.map((week) => {
        let weeklyTotal = 0;
        const weekRows = week.days.map((day) => {
          const row = dayRows.get(day);
          if (row) weeklyTotal += row.netHours;
          return row;
        }).filter(Boolean) as DayRow[];

        return (
          <Card key={week.label} style={{ backgroundColor: colors.white }}>
            <CardHeader className="pb-1 pt-3">
              <CardTitle className="text-xs font-normal" style={{ color: colors.brownLight }}>
                {week.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.creamDark}` }}>
                      <th className="text-left py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>Date</th>
                      <th className="text-left py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>Type</th>
                      <th className="text-left py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>Job</th>
                      <th className="text-left py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>Start</th>
                      <th className="text-left py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>End</th>
                      <th className="text-right py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>Total hours</th>
                      <th className="text-right py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>Scheduled</th>
                      <th className="text-right py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>Difference</th>
                      <th className="py-1.5 px-2 text-xs" />
                    </tr>
                  </thead>
                  <tbody>
                    {week.days.map((day, dayIdx) => {
                      const row = dayRows.get(day);
                      if (!row) return null;
                      const hasData = row.type || row.netHours > 0 || row.scheduledHours > 0;
                      const diff = formatDiff(row.difference);
                      const isLastInWeek = dayIdx === week.days.length - 1;

                      return (
                        <tr key={day} style={{ borderBottom: `1px solid ${colors.cream}` }}>
                          <td className="py-1.5 px-2 font-medium" style={{ color: colors.brown }}>
                            {row.dayLabel}
                          </td>
                          <td className="py-1.5 px-2" style={{ color: colors.brownLight }}>
                            {row.type || '--'}
                          </td>
                          <td className="py-1.5 px-2">
                            {row.job ? (
                              <Badge style={{ backgroundColor: colors.gold, color: colors.white }} className="text-[10px]">
                                {row.job}
                              </Badge>
                            ) : '--'}
                          </td>
                          <td className="py-1.5 px-2" style={{ color: colors.brown }}>
                            {row.start || '--'}
                          </td>
                          <td className="py-1.5 px-2" style={{ color: colors.brown }}>
                            {row.end || '--'}
                          </td>
                          <td className="text-right py-1.5 px-2 font-medium" style={{ color: hasData ? colors.brown : colors.brownLight }}>
                            {row.netHours > 0 ? formatHM(row.netHours) : '--'}
                          </td>
                          <td className="text-right py-1.5 px-2" style={{ color: colors.brownLight }}>
                            {row.scheduledHours > 0 ? formatHM(row.scheduledHours) : '--'}
                          </td>
                          <td className="text-right py-1.5 px-2" style={{ color: diff.color }}>
                            {hasData && row.scheduledHours > 0 ? diff.text : '--'}
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            {row.entries.length > 0 && (
                              <Button variant="ghost" size="sm" onClick={() => setEditEntry(row.entries[0])}
                                className="h-6 w-6 p-0" title="Request edit"
                                style={{ color: colors.brownLight }}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Weekly total row */}
                    <tr style={{ borderTop: `2px solid ${colors.creamDark}` }}>
                      <td colSpan={5} className="py-1.5 px-2 text-right text-xs font-medium" style={{ color: colors.brownLight }}>
                        Weekly total
                      </td>
                      <td className="text-right py-1.5 px-2 font-bold" style={{ color: colors.brown }}>
                        {weeklyTotal > 0 ? formatHM(weeklyTotal) : '--'}
                      </td>
                      <td colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Approval section for managers */}
      {canApprove && (
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-4 space-y-3">
            <Textarea
              placeholder="Manager notes (optional)"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              rows={2}
              style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
            />
            <div className="flex gap-2">
              <Button onClick={handleApprove}
                disabled={approveTimesheet.isPending}
                style={{ backgroundColor: colors.green, color: '#fff' }}>
                <Check className="w-4 h-4 mr-1" /> Approve Timesheet
              </Button>
              <Button variant="outline" onClick={handleReject}
                disabled={rejectTimesheet.isPending}
                style={{ borderColor: colors.red, color: colors.red }}>
                <X className="w-4 h-4 mr-1" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit request dialog */}
      {editEntry && (
        <EditRequestDialog entry={editEntry} onClose={() => setEditEntry(null)} />
      )}
    </div>
  );
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.toLocaleDateString('en-US', { weekday: 'short' });
  return `${dow} ${m}/${d}`;
}
