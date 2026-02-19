import { useState, useMemo, useCallback, Fragment } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { useEditTimeClockEntry } from '@/hooks/use-time-clock';
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
import { ChevronLeft, Check, X, Download, Trash2, Edit2 } from 'lucide-react';
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

/** Extract "HH:MM" from ISO timestamp for <input type="time"> */
function toTimeInput(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Combine "YYYY-MM-DD" + "HH:MM" → ISO timestamp in local tz */
function toISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.toLocaleDateString('en-US', { weekday: 'short' });
  return `${dow} ${m}/${d}`;
}

/** Parse flexible time input → "HH:MM" (24h) or null */
function parseTimeInput(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const ampm = s.match(/^(\d{1,2}):?(\d{2})\s*(am|pm|a|p)$/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = parseInt(ampm[2]);
    const isPM = /p/i.test(ampm[3]);
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
    if (h > 23 || m > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const mil = s.match(/^(\d{1,2}):(\d{2})$/);
  if (mil) {
    const h = parseInt(mil[1]);
    const m = parseInt(mil[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return null;
}

/** Format ISO timestamp → "h:mm AM" for pre-populating text inputs */
function formatTimeForEdit(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  const { tenant } = useAuth();
  const queryClient = useQueryClient();
  const editTimeClockEntry = useEditTimeClockEntry();

  const [approvalNotes, setApprovalNotes] = useState('');
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [dayEditValues, setDayEditValues] = useState<Record<string, { in1: string; out1: string; in2: string; out2: string }>>({});
  const [editEntry, setEditEntry] = useState<TimeClockEntry | null>(null); // employee edit-request

  const employee = employees.find((e) => e.user_profile_id === employeeId);
  const firstEntry = entries.find((e) => e.employee_id === employeeId);
  const employeeName = employee?.name || firstEntry?.employee_name || 'Unknown';

  const { data: approval } = useEmployeeTimesheetApproval(employeeId, period.start, period.end);
  const approveTimesheet = useApproveTimesheet();
  const rejectTimesheet = useRejectTimesheet();

  const empEntries = useMemo(() =>
    entries.filter((e) => e.employee_id === employeeId)
      .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()),
    [entries, employeeId],
  );

  const empShifts = useMemo(() =>
    shifts.filter((s) => s.employee_id === employeeId),
    [shifts, employeeId],
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['time-clock'] });
  }, [queryClient]);

  /* ── build day data ── */
  const dayDataMap = useMemo<Map<string, DayData>>(() => {
    const shiftsByDay = new Map<string, Shift[]>();
    for (const s of empShifts) {
      const arr = shiftsByDay.get(s.date) || [];
      arr.push(s);
      shiftsByDay.set(s.date, arr);
    }

    const entriesByDay = new Map<string, TimeClockEntry[]>();
    for (const e of empEntries) {
      const day = new Date(e.clock_in).toLocaleDateString('sv-SE');
      const arr = entriesByDay.get(day) || [];
      arr.push(e);
      entriesByDay.set(day, arr);
    }

    const result = new Map<string, DayData>();
    for (const day of days) {
      const dayShifts = shiftsByDay.get(day) || [];
      const dayEntries = entriesByDay.get(day) || [];

      let scheduledHours = 0;
      for (const s of dayShifts) scheduledHours += calcShiftHours(s.start_time, s.end_time);

      const entryRows: EntryRow[] = dayEntries.map((e) => {
        const brk = (e.breaks ?? [])[0];
        const total = calcHours(e.clock_in, e.clock_out);
        const brkHrs = calcBreakHours(e.breaks ?? []);
        return {
          entry: e,
          in1: e.clock_in,
          out1: brk?.break_start ?? null,
          in2: brk?.break_end ?? null,
          out2: e.clock_out,
          breakId: brk?.id ?? null,
          netHours: Math.max(0, total - brkHrs),
        };
      });

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
    let breakHoursTotal = 0;
    let workedDays = 0;
    let totalScheduled = 0;
    for (const data of Array.from(dayDataMap.values())) {
      regularHours += data.totalNetHours;
      totalScheduled += data.scheduledHours;
      if (data.totalNetHours > 0) workedDays++;
      for (const row of data.entryRows) breakHoursTotal += calcBreakHours(row.entry.breaks ?? []);
    }
    return {
      regularHours,
      breakHours: breakHoursTotal,
      workedDays,
      totalScheduled,
      totalDifference: regularHours - totalScheduled,
      totalPay: employee?.hourly_rate ? regularHours * employee.hourly_rate : null,
    };
  }, [dayDataMap, employee]);

  /* ── inline edit helpers ── */
  const startDayEdit = useCallback((day: string, rows: EntryRow[]) => {
    setEditingDay(day);
    const vals: Record<string, { in1: string; out1: string; in2: string; out2: string }> = {};
    for (const row of rows) {
      vals[row.entry.id] = {
        in1: row.in1 ? formatTimeForEdit(row.in1) : '',
        out1: row.out1 ? formatTimeForEdit(row.out1) : '',
        in2: row.in2 ? formatTimeForEdit(row.in2) : '',
        out2: row.out2 ? formatTimeForEdit(row.out2) : '',
      };
    }
    if (rows.length === 0) {
      vals[`new:${day}`] = { in1: '', out1: '', in2: '', out2: '' };
    }
    setDayEditValues(vals);
  }, []);

  const cancelDayEdit = useCallback(() => {
    setEditingDay(null);
    setDayEditValues({});
  }, []);

  /* ── save all punches for a day ── */
  const handleSaveDay = useCallback(async () => {
    if (!editingDay) return;
    try {
      const dayData = dayDataMap.get(editingDay);

      // Handle new entry creation
      const newVals = dayEditValues[`new:${editingDay}`];
      if (newVals) {
        const in1 = parseTimeInput(newVals.in1);
        if (in1) {
          const out2 = parseTimeInput(newVals.out2);
          const { data: created, error } = await supabase.from('time_clock_entries').insert({
            tenant_id: tenant?.id,
            employee_id: employeeId,
            clock_in: toISO(editingDay, in1),
            clock_out: out2 ? toISO(editingDay, out2) : null,
            employee_name: employeeName,
            source: 'manual',
          }).select().single();
          if (error) throw error;
          const out1 = parseTimeInput(newVals.out1);
          const in2 = parseTimeInput(newVals.in2);
          if (out1 && created) {
            const { error: bErr } = await supabase.from('time_clock_breaks').insert({
              tenant_id: tenant?.id,
              time_clock_entry_id: created.id,
              break_start: toISO(editingDay, out1),
              break_end: in2 ? toISO(editingDay, in2) : null,
              break_type: 'break',
            });
            if (bErr) throw bErr;
          }
        }
      }

      // Handle existing entry edits
      if (dayData) {
        for (const row of dayData.entryRows) {
          const vals = dayEditValues[row.entry.id];
          if (!vals) continue; // entry was deleted during edit

          const date = new Date(row.entry.clock_in).toLocaleDateString('sv-SE');
          const newIn1 = parseTimeInput(vals.in1);
          const newOut1 = parseTimeInput(vals.out1);
          const newIn2 = parseTimeInput(vals.in2);
          const newOut2 = parseTimeInput(vals.out2);

          // Cleared clock-in → delete entry
          if (!newIn1) {
            await supabase.from('time_clock_entries').delete().eq('id', row.entry.id);
            continue;
          }

          // Detect changes to clock_in / clock_out
          const origIn1 = row.in1 ? toTimeInput(row.in1) : null;
          const origOut2 = row.out2 ? toTimeInput(row.out2) : null;
          const hasClockInChange = newIn1 !== origIn1;
          const hasClockOutChange = (newOut2 ?? null) !== (origOut2 ?? null);
          if (hasClockInChange || hasClockOutChange) {
            await editTimeClockEntry.mutateAsync({
              id: row.entry.id,
              ...(hasClockInChange && { clock_in: toISO(date, newIn1) }),
              ...(hasClockOutChange && { clock_out: newOut2 ? toISO(date, newOut2) : undefined }),
            });
            // If clearing clock_out, do it directly since the hook doesn't accept null
            if (hasClockOutChange && !newOut2) {
              await supabase.from('time_clock_entries').update({ clock_out: null, updated_at: new Date().toISOString() }).eq('id', row.entry.id);
            }
          }

          // Handle break changes
          const brk = (row.entry.breaks ?? [])[0];
          const origOut1 = row.out1 ? toTimeInput(row.out1) : null;
          const origIn2 = row.in2 ? toTimeInput(row.in2) : null;
          if (newOut1) {
            if (brk) {
              const brkUp: Record<string, string | null> = {};
              if (newOut1 !== origOut1) brkUp.break_start = toISO(date, newOut1);
              if ((newIn2 ?? null) !== (origIn2 ?? null)) brkUp.break_end = newIn2 ? toISO(date, newIn2) : null;
              if (Object.keys(brkUp).length > 0) {
                const { error } = await supabase.from('time_clock_breaks').update(brkUp).eq('id', brk.id);
                if (error) throw error;
              }
            } else {
              const { error } = await supabase.from('time_clock_breaks').insert({
                tenant_id: tenant?.id,
                time_clock_entry_id: row.entry.id,
                break_start: toISO(date, newOut1),
                break_end: newIn2 ? toISO(date, newIn2) : null,
                break_type: 'break',
              });
              if (error) throw error;
            }
          } else if (brk) {
            const { error } = await supabase.from('time_clock_breaks').delete().eq('id', brk.id);
            if (error) throw error;
          }
        }
      }

      invalidate();
      toast({ title: 'Saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save', variant: 'destructive' });
    }
    cancelDayEdit();
  }, [editingDay, dayEditValues, dayDataMap, tenant, employeeId, employeeName, editTimeClockEntry, invalidate, cancelDayEdit, toast]);

  /* ── delete entry ── */
  const handleDeleteEntry = useCallback(async (entryId: string) => {
    if (!confirm('Delete this time entry?')) return;
    try {
      const { error } = await supabase.from('time_clock_entries').delete().eq('id', entryId);
      if (error) throw error;
      // Remove from edit state if currently editing
      if (editingDay) {
        setDayEditValues(prev => {
          const next = { ...prev };
          delete next[entryId];
          return next;
        });
      }
      invalidate();
      toast({ title: 'Entry deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete', variant: 'destructive' });
    }
  }, [editingDay, invalidate, toast]);

  /* ── approval ── */
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

  /* ── export ── */
  const handleExport = useCallback(() => {
    const headers = ['Date', 'Clock In', 'Break Out', 'Break In', 'Clock Out', 'Net Hours', 'Scheduled', 'Difference'];
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
    const csv = [headers, ...csvRows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timesheet_${employeeName.replace(/\s+/g, '_')}_${period.start}_${period.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [days, dayDataMap, employeeName, period]);

  /* ── render a single punch cell ── */
  const renderPunchCell = (entryKey: string, field: 'in1' | 'out1' | 'in2' | 'out2', value: string | null) => {
    const vals = dayEditValues[entryKey];
    if (vals) {
      return (
        <input
          type="text"
          value={vals[field]}
          onChange={(e) => setDayEditValues(prev => ({
            ...prev,
            [entryKey]: { ...prev[entryKey], [field]: e.target.value }
          }))}
          placeholder="0:00 AM"
          className="w-[5.5rem] px-1 py-0.5 text-xs rounded border"
          style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
        />
      );
    }
    return (
      <span className="text-xs" style={{ color: value ? colors.brown : colors.brownLight }}>
        {value ? formatTime(value) : '--'}
      </span>
    );
  };

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
            <p className="text-[10px]" style={{ color: colors.brownLight }}>Est. Pay</p>
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
          <Button size="sm" variant="outline" onClick={handleExport} style={{ borderColor: colors.creamDark, color: colors.brown }}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          {canApprove && approval?.status !== 'approved' && (
            <Button size="sm" onClick={handleApprove} disabled={approveTimesheet.isPending} style={{ backgroundColor: colors.green, color: '#fff' }}>
              <Check className="w-4 h-4 mr-1" /> Approve
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
                      <th className="text-left py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>Date</th>
                      <th className="text-left py-1.5 px-1 text-xs" style={{ color: colors.brownLight }}>In</th>
                      <th className="text-left py-1.5 px-1 text-xs" style={{ color: colors.brownLight }}>Break</th>
                      <th className="text-left py-1.5 px-1 text-xs" style={{ color: colors.brownLight }}>Return</th>
                      <th className="text-left py-1.5 px-1 text-xs" style={{ color: colors.brownLight }}>Out</th>
                      <th className="text-right py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>Hours</th>
                      <th className="text-right py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>Sched.</th>
                      <th className="text-right py-1.5 px-2 text-xs" style={{ color: colors.brownLight }}>Diff</th>
                      <th className="py-1.5 px-1 text-xs" style={{ width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {week.days.map((day) => {
                      const data = dayDataMap.get(day);
                      if (!data) return null;
                      const diff = formatDiff(data.difference);
                      const isDayEditing = editingDay === day;

                      /* Empty day — no entries */
                      if (data.entryRows.length === 0) {
                        return (
                          <Fragment key={day}>
                            <tr style={{ borderBottom: isDayEditing ? undefined : `1px solid ${colors.cream}` }}>
                              <td className="py-1.5 px-2 font-medium" style={{ color: colors.brown }}>
                                {data.dayLabel}
                                {canApprove && !isDayEditing && (
                                  <button onClick={() => startDayEdit(day, [])} className="ml-1.5 align-middle opacity-40 hover:opacity-100" style={{ color: colors.gold }}>
                                    <Edit2 className="w-3 h-3 inline" />
                                  </button>
                                )}
                              </td>
                              <td className="py-1.5 px-1">{isDayEditing ? renderPunchCell(`new:${day}`, 'in1', null) : <span className="text-xs" style={{ color: colors.brownLight }}>--</span>}</td>
                              <td className="py-1.5 px-1">{isDayEditing ? renderPunchCell(`new:${day}`, 'out1', null) : <span className="text-xs" style={{ color: colors.brownLight }}>--</span>}</td>
                              <td className="py-1.5 px-1">{isDayEditing ? renderPunchCell(`new:${day}`, 'in2', null) : <span className="text-xs" style={{ color: colors.brownLight }}>--</span>}</td>
                              <td className="py-1.5 px-1">{isDayEditing ? renderPunchCell(`new:${day}`, 'out2', null) : <span className="text-xs" style={{ color: colors.brownLight }}>--</span>}</td>
                              <td className="text-right py-1.5 px-2" style={{ color: colors.brownLight }}>--</td>
                              <td className="text-right py-1.5 px-2" style={{ color: colors.brownLight }}>
                                {data.scheduledHours > 0 ? formatHM(data.scheduledHours) : '--'}
                              </td>
                              <td className="text-right py-1.5 px-2" style={{ color: colors.brownLight }}>--</td>
                              <td />
                            </tr>
                            {isDayEditing && (
                              <tr style={{ borderBottom: `1px solid ${colors.cream}` }}>
                                <td colSpan={9} className="py-1.5 px-2 text-right">
                                  <button onClick={handleSaveDay} className="text-xs font-semibold mr-3 px-3 py-1 rounded" style={{ backgroundColor: colors.green, color: '#fff' }}>Save</button>
                                  <button onClick={cancelDayEdit} className="text-xs px-3 py-1 rounded border" style={{ color: colors.brownLight, borderColor: colors.creamDark }}>Cancel</button>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      }

                      /* Day with entries */
                      return (
                        <Fragment key={day}>
                          {data.entryRows.map((row, idx) => {
                            const eid = row.entry.id;
                            const isFirst = idx === 0;
                            const isLast = idx === data.entryRows.length - 1;

                            return (
                              <tr key={eid} style={{ borderBottom: isLast && !isDayEditing ? `1px solid ${colors.cream}` : undefined }}>
                                <td className="py-1.5 px-2 font-medium" style={{ color: colors.brown }}>
                                  {isFirst ? (
                                    <>
                                      {data.dayLabel}
                                      {canApprove && !isDayEditing && (
                                        <button onClick={() => startDayEdit(day, data.entryRows)} className="ml-1.5 align-middle opacity-40 hover:opacity-100" style={{ color: colors.gold }}>
                                          <Edit2 className="w-3 h-3 inline" />
                                        </button>
                                      )}
                                    </>
                                  ) : ''}
                                </td>
                                <td className="py-1.5 px-1">{renderPunchCell(eid, 'in1', row.in1)}</td>
                                <td className="py-1.5 px-1">{renderPunchCell(eid, 'out1', row.out1)}</td>
                                <td className="py-1.5 px-1">{renderPunchCell(eid, 'in2', row.in2)}</td>
                                <td className="py-1.5 px-1">{renderPunchCell(eid, 'out2', row.out2)}</td>
                                <td className="text-right py-1.5 px-2 font-medium" style={{ color: row.netHours > 0 ? colors.brown : colors.brownLight }}>
                                  {row.netHours > 0 ? formatHM(row.netHours) : '--'}
                                </td>
                                <td className="text-right py-1.5 px-2" style={{ color: colors.brownLight }}>
                                  {isFirst && data.scheduledHours > 0 ? formatHM(data.scheduledHours) : '--'}
                                </td>
                                <td className="text-right py-1.5 px-2" style={{ color: isFirst ? diff.color : colors.brownLight }}>
                                  {isFirst && data.scheduledHours > 0 ? diff.text : '--'}
                                </td>
                                <td className="py-1.5 px-1 text-center">
                                  {canApprove ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteEntry(eid)}
                                      className="h-5 w-5 p-0"
                                      title="Delete entry"
                                      style={{ color: colors.brownLight }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  ) : (
                                    (row.entry as any).source !== 'square' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditEntry(row.entry)}
                                        className="h-5 w-5 p-0"
                                        title="Request edit"
                                        style={{ color: colors.brownLight }}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                    )
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {isDayEditing && (
                            <tr style={{ borderBottom: `1px solid ${colors.cream}` }}>
                              <td colSpan={9} className="py-1.5 px-2 text-right">
                                <button onClick={handleSaveDay} className="text-xs font-semibold mr-3 px-3 py-1 rounded" style={{ backgroundColor: colors.green, color: '#fff' }}>Save</button>
                                <button onClick={cancelDayEdit} className="text-xs px-3 py-1 rounded border" style={{ color: colors.brownLight, borderColor: colors.creamDark }}>Cancel</button>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {/* Weekly total */}
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
              <Button onClick={handleApprove} disabled={approveTimesheet.isPending} style={{ backgroundColor: colors.green, color: '#fff' }}>
                <Check className="w-4 h-4 mr-1" /> Approve Timesheet
              </Button>
              <Button variant="outline" onClick={handleReject} disabled={rejectTimesheet.isPending} style={{ borderColor: colors.red, color: colors.red }}>
                <X className="w-4 h-4 mr-1" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee edit-request dialog */}
      {editEntry && !canApprove && (
        <EditRequestDialog entry={editEntry} onClose={() => setEditEntry(null)} />
      )}
    </div>
  );
}
