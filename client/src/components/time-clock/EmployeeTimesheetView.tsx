import { payPeriodBounds } from '@/lib/timesheet-snapshot';
import { useState, useMemo, useCallback, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { TimeClockEntry } from '@/hooks/use-time-clock';
import type { Shift } from '@/hooks/use-shifts';
import type { UnifiedEmployee } from '@/hooks/use-all-employees';
import { useEmployeeTimesheetApproval, useApproveTimesheet, useRejectTimesheet } from '@/hooks/use-timesheet-approvals';
import { useRunAccrual } from '@/hooks/use-time-off-policies';
import { PayPeriodNav } from './PayPeriodNav';
import { EditRequestDialog } from './EditRequestDialog';
import { useTimeClockEdits } from '@/hooks/use-time-clock-edits';
import { TimeCorrectionHistory } from './TimeCorrectionHistory';
import { WorkSessionEditor } from './WorkSessionEditor';
import { SessionHistoryPanel } from './SessionHistoryPanel';
import { MissingSessionRequests } from './MissingSessionRequests';
import type { PayPeriod, WeekGroup } from '@/lib/pay-periods';
import { ChevronLeft, Check, X, Download, Edit2, Plus } from 'lucide-react';
import { colors } from '@/lib/colors';

/* ─── helpers ─── */

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
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

function formatHM(h: number): string {
  if (h <= 0) return '--';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDiff(diff: number): { text: string; color: string } {
  if (Math.abs(diff) < 0.01) return { text: '--', color: colors.brownLight };
  const sign = diff > 0 ? '+' : '-';
  const abs = Math.abs(diff);
  const hrs = Math.floor(abs);
  const mins = Math.round((abs - hrs) * 60);
  return { text: `${sign}${hrs}:${String(mins).padStart(2, '0')}`, color: diff > 0 ? colors.green : colors.red };
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.toLocaleDateString('en-US', { weekday: 'short' });
  return `${dow} ${m}/${d}`;
}

/* ─── types ─── */

interface EntryRow {
  entry: TimeClockEntry;
  in1: string | null;
  out1: string | null;
  in2: string | null;
  out2: string | null;
  breakId: string | null;
  netHours: number;
}

interface DayData {
  date: string;
  dayLabel: string;
  entryRows: EntryRow[];
  scheduledHours: number;
  totalNetHours: number;
  difference: number;
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

/* ─── component ─── */

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
  const { user, hasRole, hasPermission } = useAuth();

  const [approvalNotes, setApprovalNotes] = useState('');
  const [sessionEditor, setSessionEditor] = useState<{ day: string; entry?: TimeClockEntry } | null>(null);
  const [editEntry, setEditEntry] = useState<TimeClockEntry | null>(null); // employee edit-request
  const [saveNotice, setSaveNotice] = useState('');
  const { data: corrections = [], isLoading: loadingCorrections, isError: correctionsError } = useTimeClockEdits();
  const entryIds = useMemo(
    () => new Set(entries.filter((e) => e.employee_id === employeeId).map((e) => e.id)),
    [entries, employeeId]
  );
  const employeeCorrections = corrections.filter(
    (r) => r.employee_id === employeeId && entryIds.has(r.time_clock_entry_id)
  );
  const pendingEntryIds = new Set(
    employeeCorrections.filter((r) => r.status === 'pending').map((r) => r.time_clock_entry_id)
  );
  const canEditTimes = canApprove && hasRole('manager');
  const canRequestEdit = user?.id === employeeId && !canEditTimes;

  const employee = employees.find((e) => e.user_profile_id === employeeId);
  const firstEntry = entries.find((e) => e.employee_id === employeeId);
  const employeeName = employee?.name || firstEntry?.employee_name || 'Unknown';

  const { data: approval } = useEmployeeTimesheetApproval(employeeId, period.start, period.end);
  const approveTimesheet = useApproveTimesheet();
  const rejectTimesheet = useRejectTimesheet();
  const runAccrual = useRunAccrual();

  const empEntries = useMemo(
    () =>
      entries
        .filter((e) => e.employee_id === employeeId)
        .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()),
    [entries, employeeId]
  );

  const empShifts = useMemo(() => shifts.filter((s) => s.employee_id === employeeId), [shifts, employeeId]);

  /* ── build day data (with overnight split) ── */
  const dayDataMap = useMemo<Map<string, DayData>>(() => {
    const shiftsByDay = new Map<string, Shift[]>();
    for (const s of empShifts) {
      const arr = shiftsByDay.get(s.date) || [];
      arr.push(s);
      shiftsByDay.set(s.date, arr);
    }

    // Build entry rows per day, splitting overnight entries at midnight
    const rowsByDay = new Map<string, EntryRow[]>();

    for (const e of empEntries) {
      const inDate = new Date(e.clock_in);
      const inDay = inDate.toLocaleDateString('sv-SE');
      const outDate = e.clock_out ? new Date(e.clock_out) : null;
      const outDay = outDate ? outDate.toLocaleDateString('sv-SE') : null;
      const brk = (e.breaks ?? [])[0];

      if (!outDay || inDay === outDay) {
        // Same day or still clocked in — no split needed
        const total = calcHours(e.clock_in, e.clock_out);
        const brkHrs = calcBreakHours(e.breaks ?? []);
        const row: EntryRow = {
          entry: e,
          in1: e.clock_in,
          out1: brk?.break_start ?? null,
          in2: brk?.break_end ?? null,
          out2: e.clock_out,
          breakId: brk?.id ?? null,
          netHours: Math.max(0, total - brkHrs),
        };
        const arr = rowsByDay.get(inDay) || [];
        arr.push(row);
        rowsByDay.set(inDay, arr);
      } else {
        // Overnight: split at midnight boundary for each day spanned
        // outDate is guaranteed non-null here (outDay is truthy in this branch)
        if (!outDate) continue;
        const midnightAfterIn = new Date(inDate);
        midnightAfterIn.setDate(midnightAfterIn.getDate() + 1);
        midnightAfterIn.setHours(0, 0, 0, 0);
        const midnightISO = midnightAfterIn.toISOString();

        // Helper: calc break hours within a time window
        const breakHoursInWindow = (windowStart: Date, windowEnd: Date) =>
          (e.breaks ?? []).reduce((total, item) => {
            if (!item.break_end) return total;
            const overlapStart = Math.max(new Date(item.break_start).getTime(), windowStart.getTime());
            const overlapEnd = Math.min(new Date(item.break_end).getTime(), windowEnd.getTime());
            return total + Math.max(0, overlapEnd - overlapStart) / 3_600_000;
          }, 0);

        // Day A (clock_in day): clock_in to midnight
        const dayAHours = (midnightAfterIn.getTime() - inDate.getTime()) / 3_600_000;
        const dayABreak = breakHoursInWindow(inDate, midnightAfterIn);
        const brkStartDate = brk?.break_start ? new Date(brk.break_start) : null;
        const brkEndDate = brk?.break_end ? new Date(brk.break_end) : null;
        const brkOnDayA = brkStartDate && brkStartDate < midnightAfterIn;
        const rowA: EntryRow = {
          entry: e,
          in1: e.clock_in,
          out1: brkOnDayA ? brk.break_start : null,
          in2: brkOnDayA && brkEndDate && brkEndDate < midnightAfterIn ? brk.break_end : null,
          out2: midnightISO,
          breakId: brkOnDayA ? (brk?.id ?? null) : null,
          netHours: Math.max(0, dayAHours - dayABreak),
        };
        const arrA = rowsByDay.get(inDay) || [];
        arrA.push(rowA);
        rowsByDay.set(inDay, arrA);

        // For multi-day spans (rare but possible), fill full-day rows
        let cursor = new Date(midnightAfterIn);
        while (true) {
          const nextMid = new Date(cursor);
          nextMid.setDate(nextMid.getDate() + 1);
          nextMid.setHours(0, 0, 0, 0);
          const curDay = cursor.toLocaleDateString('sv-SE');

          if (outDate <= nextMid) {
            // Day B (clock_out day): midnight to clock_out
            const dayBHours = (outDate.getTime() - cursor.getTime()) / 3_600_000;
            const dayBBreak = breakHoursInWindow(cursor, outDate);
            const brkOnDayB = brkStartDate && brkStartDate >= cursor && brkStartDate < outDate;
            const rowB: EntryRow = {
              entry: e,
              in1: cursor.toISOString(),
              out1: brkOnDayB ? brk.break_start : null,
              in2: brkOnDayB ? (brk?.break_end ?? null) : null,
              out2: e.clock_out,
              breakId: brkOnDayB ? (brk?.id ?? null) : null,
              netHours: Math.max(0, dayBHours - dayBBreak),
            };
            const arrB = rowsByDay.get(curDay) || [];
            arrB.push(rowB);
            rowsByDay.set(curDay, arrB);
            break;
          } else {
            // Full intermediate day: midnight to midnight
            const fullDayHours = 24;
            const fullDayBreak = breakHoursInWindow(cursor, nextMid);
            const brkOnMid = brkStartDate && brkStartDate >= cursor && brkStartDate < nextMid;
            const rowM: EntryRow = {
              entry: e,
              in1: cursor.toISOString(),
              out1: brkOnMid ? brk.break_start : null,
              in2: brkOnMid && brkEndDate && brkEndDate < nextMid ? brk.break_end : null,
              out2: nextMid.toISOString(),
              breakId: brkOnMid ? (brk?.id ?? null) : null,
              netHours: Math.max(0, fullDayHours - fullDayBreak),
            };
            const arrM = rowsByDay.get(curDay) || [];
            arrM.push(rowM);
            rowsByDay.set(curDay, arrM);
            cursor = nextMid;
          }
        }
      }
    }

    const result = new Map<string, DayData>();
    for (const day of days) {
      const dayShifts = shiftsByDay.get(day) || [];
      const entryRows = rowsByDay.get(day) || [];

      let scheduledHours = 0;
      for (const s of dayShifts) scheduledHours += calcShiftHours(s.start_time, s.end_time);

      const totalNetHours = entryRows.reduce((s, r) => s + r.netHours, 0);
      result.set(day, {
        date: day,
        dayLabel: formatDayLabel(day),
        entryRows,
        scheduledHours,
        totalNetHours,
        difference: scheduledHours > 0 ? totalNetHours - scheduledHours : 0,
      });
    }
    return result;
  }, [days, empEntries, empShifts]);

  /* ── summary ── */
  const summary = useMemo(() => {
    let regularHours = 0;
    const bounds = payPeriodBounds(period.start, period.end);
    const startMs = new Date(bounds.start).getTime();
    const endMs = new Date(bounds.end).getTime();
    const breakHoursTotal = empEntries.reduce(
      (sum, entry) =>
        sum +
        (entry.breaks ?? []).reduce((subtotal, b) => {
          if (!b.break_end) return subtotal;
          return (
            subtotal +
            Math.max(
              0,
              Math.min(new Date(b.break_end).getTime(), endMs) - Math.max(new Date(b.break_start).getTime(), startMs)
            ) /
              3_600_000
          );
        }, 0),
      0
    );
    let workedDays = 0;
    let totalScheduled = 0;
    for (const data of Array.from(dayDataMap.values())) {
      regularHours += data.totalNetHours;
      totalScheduled += data.scheduledHours;
      if (data.totalNetHours > 0) workedDays++;
    }
    return {
      regularHours,
      breakHours: breakHoursTotal,
      workedDays,
      totalScheduled,
      totalDifference: regularHours - totalScheduled,
      totalPay: employee?.hourly_rate ? regularHours * employee.hourly_rate : null,
    };
  }, [dayDataMap, employee, empEntries, period]);

  /* ── approval ── */
  const handleApprove = useCallback(async () => {
    try {
      const approved = await approveTimesheet.mutateAsync({
        employeeId,
        periodStart: period.start,
        periodEnd: period.end,
        managerNotes: approvalNotes || undefined,
        entries: empEntries,
      });

      let accrualWarning: string | undefined;
      // Award PTO once; corrected-period balance adjustments require separate review.
      if (approved.approval_count === 1 && Number(approved.total_regular_hours) > 0) {
        try {
          await runAccrual.mutateAsync({
            employeeId,
            hoursWorked: Number(approved.total_regular_hours),
            referenceId: approved.id,
            periodDescription: `${period.start} to ${period.end}`,
            employeeStartDate: employee?.start_date ?? undefined,
          });
        } catch {
          accrualWarning = 'PTO accrual failed. Review the employee balance separately.';
        }
      }

      toast({
        title: 'Timesheet approved',
        description:
          accrualWarning ??
          (approved.approval_count > 1
            ? 'PTO was not awarded again. Review any PTO balance adjustment separately.'
            : undefined),
      });
      setApprovalNotes('');
    } catch (error) {
      toast({
        title: 'Approval not saved',
        description:
          error instanceof Error
            ? error.message
            : (error as { message?: string })?.message || 'Failed to approve timesheet.',
        variant: 'destructive',
      });
    }
  }, [approveTimesheet, runAccrual, employeeId, period, approvalNotes, empEntries, employee, toast]);

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

  /* ── export ── */
  const handleExport = useCallback(() => {
    const headers = [
      'Date',
      'Clock In',
      'Break Out',
      'Break In',
      'Clock Out',
      'Net Hours',
      'Scheduled',
      'Difference',
      'Record Type',
    ];
    const csvRows: string[][] = [];
    for (const day of days) {
      const data = dayDataMap.get(day);
      if (!data) continue;
      if (data.entryRows.length === 0) {
        csvRows.push([data.dayLabel, '', '', '', '', '0.00', data.scheduledHours.toFixed(2), '0.00']);
      } else {
        for (const row of data.entryRows) {
          csvRows.push([
            data.dayLabel,
            row.in1 ? formatTime(row.in1) : '',
            row.out1 ? formatTime(row.out1) : '',
            row.in2 ? formatTime(row.in2) : '',
            row.out2 ? formatTime(row.out2) : '',
            row.netHours.toFixed(2),
            data.scheduledHours.toFixed(2),
            data.difference.toFixed(2),
          ]);
        }
      }
    }
    const csv = [headers, ...csvRows.map((row) => [...row, 'Review copy - not payroll approval'])]
      .map((r) => r.map((c) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timesheet_review_${employeeName.replace(/\s+/g, '_')}_${period.start}_${period.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [days, dayDataMap, employeeName, period]);

  /* ─── JSX ─── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <Card style={{ backgroundColor: colors.white }}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2" style={{ color: colors.brown }}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <span className="text-lg font-bold" style={{ color: colors.brown }}>
              {employeeName}
            </span>
            <div className="ml-auto">
              <PayPeriodNav period={period} onPrev={goPrev} onNext={goNext} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border p-3 text-sm" style={{ borderColor: colors.creamDark, color: colors.brown }}>
        {canEditTimes
          ? 'Manager edits update recorded hours when you save. Changes to approved time require the pay period to be approved again.'
          : 'Requested corrections stay pending until a manager approves them. Totals show the current recorded hours.'}
      </div>
      {saveNotice && (
        <div
          role="status"
          className="rounded-lg border p-3 text-sm font-medium"
          style={{ color: colors.green, borderColor: colors.green }}
        >
          {saveNotice}
        </div>
      )}
      {correctionsError && (
        <p role="alert" className="text-sm" style={{ color: colors.red }}>
          Correction status could not load. Refresh before submitting another request.
        </p>
      )}
      {loadingCorrections && (
        <p role="status" className="text-sm">
          Loading correction status…
        </p>
      )}
      <TimeCorrectionHistory
        requests={employeeCorrections}
        canReview={hasRole('manager') && hasPermission('approve_time_edits')}
        currentUserId={user?.id ?? ''}
        disabled={!!sessionEditor}
      />

      <MissingSessionRequests
        employeeId={employeeId}
        currentUserId={user?.id ?? ''}
        period={period}
        canReview={hasRole('manager') && hasPermission('approve_time_edits')}
      />
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-lg font-bold" style={{ color: colors.brown }}>
              {formatHM(summary.regularHours)}
            </p>
            <p className="text-[10px]" style={{ color: colors.brownLight }}>
              Total Paid Hours
            </p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-lg font-bold" style={{ color: colors.brown }}>
              {summary.workedDays}
            </p>
            <p className="text-[10px]" style={{ color: colors.brownLight }}>
              Worked Days
            </p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-lg font-bold" style={{ color: colors.brown }}>
              {formatHM(summary.breakHours)}
            </p>
            <p className="text-[10px]" style={{ color: colors.brownLight }}>
              Breaks
            </p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: colors.white }}>
          <CardContent className="pt-3 pb-3 text-center">
            <p className="text-lg font-bold" style={{ color: summary.totalPay ? colors.brown : colors.brownLight }}>
              {summary.totalPay !== null ? `$${summary.totalPay.toFixed(2)}` : '--'}
            </p>
            <p className="text-[10px]" style={{ color: colors.brownLight }}>
              Est. Pay
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {(canApprove || user?.id === employeeId) && (
          <>
            {approval?.status === 'approved' ? (
              <Badge style={{ backgroundColor: colors.green, color: '#fff' }}>Pay period approved</Badge>
            ) : approval?.invalidated_at ? (
              <Badge style={{ backgroundColor: colors.yellow, color: colors.brown }}>Needs reapproval</Badge>
            ) : approval?.status === 'rejected' ? (
              <Badge style={{ backgroundColor: colors.red, color: '#fff' }}>Rejected</Badge>
            ) : null}
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            style={{ borderColor: colors.creamDark, color: colors.brown }}
          >
            <Download className="w-4 h-4 mr-1" /> Export review copy
          </Button>
          {canApprove && approval?.status !== 'approved' && (
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={approveTimesheet.isPending}
              style={{ backgroundColor: colors.green, color: '#fff' }}
            >
              <Check className="w-4 h-4 mr-1" /> Approve pay period
            </Button>
          )}
        </div>
      </div>

      {/* Weekly tables */}
      {weeks.map((week) => {
        let weeklyTotal = 0;
        week.days.forEach((day) => {
          const d = dayDataMap.get(day);
          if (d) weeklyTotal += d.totalNetHours;
        });

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
                      <th className="text-left py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>
                        Date
                      </th>
                      <th className="text-left py-1.5 px-1 text-xs" style={{ color: colors.brownLight }}>
                        In
                      </th>
                      <th className="text-left py-1.5 px-1 text-xs" style={{ color: colors.brownLight }}>
                        Break
                      </th>
                      <th className="text-left py-1.5 px-1 text-xs" style={{ color: colors.brownLight }}>
                        Return
                      </th>
                      <th className="text-left py-1.5 px-1 text-xs" style={{ color: colors.brownLight }}>
                        Out
                      </th>
                      <th className="text-right py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>
                        Hours
                      </th>
                      <th className="text-right py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>
                        Sched.
                      </th>
                      <th className="text-right py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>
                        Diff
                      </th>
                      <th className="py-1.5 px-1 text-xs" style={{ width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {week.days.map((day) => {
                      const data = dayDataMap.get(day);
                      if (!data) return null;
                      const diff = formatDiff(data.difference);
                      return (
                        <Fragment key={day}>
                          {data.entryRows.length === 0 ? (
                            <tr>
                              <td className="px-2 py-3 font-medium">{data.dayLabel}</td>
                              <td colSpan={8} className="px-2 py-3 text-xs">
                                No recorded session
                              </td>
                            </tr>
                          ) : (
                            data.entryRows.map((row, index) => (
                              <tr key={row.entry.id} className="border-b">
                                <td className="px-2 py-3 font-medium">
                                  {data.dayLabel}
                                  {data.entryRows.length > 1 && (
                                    <div className="text-xs font-normal">Session {index + 1}</div>
                                  )}
                                  {pendingEntryIds.has(row.entry.id) && (
                                    <Badge variant="outline">Pending manager approval</Badge>
                                  )}
                                  {row.entry.is_edited && (
                                    <div className="text-xs font-normal">
                                      Edited
                                      {row.entry.edited_at ? ` ${new Date(row.entry.edited_at).toLocaleString()}` : ''}
                                    </div>
                                  )}
                                </td>
                                <td className="px-1 py-3 text-xs">{row.in1 ? formatTime(row.in1) : '--'}</td>
                                <td className="px-1 py-3 text-xs">
                                  {row.out1 ? formatTime(row.out1) : '--'}
                                  {(row.entry.breaks?.length ?? 0) > 1 && (
                                    <div>+{row.entry.breaks!.length - 1} more breaks</div>
                                  )}
                                </td>
                                <td className="px-1 py-3 text-xs">{row.in2 ? formatTime(row.in2) : '--'}</td>
                                <td className="px-1 py-3 text-xs">{row.out2 ? formatTime(row.out2) : '--'}</td>
                                <td className="px-2 py-3 text-right font-medium">{formatHM(row.netHours)}</td>
                                <td className="px-2 py-3 text-right text-xs">
                                  {index === 0 && data.scheduledHours > 0 ? formatHM(data.scheduledHours) : '--'}
                                </td>
                                <td className="px-2 py-3 text-right text-xs" style={{ color: diff.color }}>
                                  {index === 0 && data.scheduledHours > 0 ? diff.text : '--'}
                                </td>
                                <td className="px-1 py-3">
                                  {canEditTimes ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSaveNotice('');
                                        setSessionEditor({ day, entry: row.entry });
                                      }}
                                    >
                                      <Edit2 className="w-3 h-3 mr-1" />
                                      Edit session
                                    </Button>
                                  ) : (
                                    canRequestEdit &&
                                    row.entry.source !== 'square' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                          pendingEntryIds.has(row.entry.id) || loadingCorrections || correctionsError
                                        }
                                        onClick={() => setEditEntry(row.entry)}
                                      >
                                        Request correction
                                      </Button>
                                    )
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                          <tr className="border-b">
                            <td colSpan={5} className="px-2 py-2">
                              {(canEditTimes || canRequestEdit) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSaveNotice('');
                                    setSessionEditor({ day });
                                  }}
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  {canEditTimes ? 'Add work session' : 'Request missed session'}
                                </Button>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right font-semibold">
                              <span className="block text-xs font-normal">Daily total</span>
                              {formatHM(data.totalNetHours)}
                            </td>
                            <td colSpan={3} />
                          </tr>
                        </Fragment>
                      );
                    })}
                    {/* Weekly total */}
                    <tr style={{ borderTop: `2px solid ${colors.creamDark}` }}>
                      <td
                        colSpan={5}
                        className="py-1.5 px-2 text-right text-xs font-medium"
                        style={{ color: colors.brownLight }}
                      >
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
              <Button
                onClick={handleApprove}
                disabled={approveTimesheet.isPending}
                style={{ backgroundColor: colors.green, color: '#fff' }}
              >
                <Check className="w-4 h-4 mr-1" /> Approve pay period
              </Button>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={rejectTimesheet.isPending}
                style={{ borderColor: colors.red, color: colors.red }}
              >
                <X className="w-4 h-4 mr-1" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <SessionHistoryPanel employeeId={employeeId} />
      {sessionEditor && (
        <WorkSessionEditor
          employeeId={employeeId}
          entry={sessionEditor.entry}
          day={sessionEditor.day}
          requestOnly={!canEditTimes}
          onClose={() => setSessionEditor(null)}
          onSaved={setSaveNotice}
        />
      )}
      {/* Employee edit-request dialog */}
      {editEntry && canRequestEdit && (
        <EditRequestDialog
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSubmitted={() => setSaveNotice('Correction pending manager approval. Recorded hours have not changed.')}
        />
      )}
    </div>
  );
}
