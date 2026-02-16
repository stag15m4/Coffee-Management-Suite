import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import { usePayPeriod } from '@/hooks/use-pay-period';
import { usePayPeriodTimeClockEntries, type TimeClockEntry } from '@/hooks/use-time-clock';
import { useShifts, type Shift } from '@/hooks/use-shifts';
import { useTimesheetApprovals } from '@/hooks/use-timesheet-approvals';
import type { UnifiedEmployee } from '@/hooks/use-all-employees';
import { PayPeriodNav } from './PayPeriodNav';
import { TimesheetGrid } from './TimesheetGrid';
import { EmployeeTimesheetView } from './EmployeeTimesheetView';
import { JobInsights } from './JobInsights';
import { Download, Search, Filter } from 'lucide-react';
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

interface TimesheetsViewProps {
  tenantId: string;
  canApprove: boolean;
  canExport: boolean;
  currentUserId: string;
  employees: UnifiedEmployee[];
}

export function TimesheetsView({ tenantId, canApprove, canExport, currentUserId, employees }: TimesheetsViewProps) {
  const { period, days, weeks, goNext, goPrev } = usePayPeriod();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const { data: entries = [], isLoading: loadingEntries } = usePayPeriodTimeClockEntries(period.start, period.end);
  const { data: shifts = [], isLoading: loadingShifts } = useShifts(period.start, period.end);
  const { data: approvals = [] } = useTimesheetApprovals(period.start, period.end);

  const handleExport = useCallback(() => {
    if (!entries.length) return;

    const headers = ['Employee', 'Date', 'Clock In', 'Clock Out', 'Total Hours', 'Break Hours', 'Net Hours', 'Position'];
    const rows = entries.map((e) => {
      const totalHrs = calcHours(e.clock_in, e.clock_out);
      const breakHrs = calcBreakHours(e.breaks ?? []);
      return [
        e.employee_name || 'Unknown',
        new Date(e.clock_in).toLocaleDateString(),
        new Date(e.clock_in).toLocaleString(),
        e.clock_out ? new Date(e.clock_out).toLocaleString() : '',
        totalHrs.toFixed(2),
        breakHrs.toFixed(2),
        Math.max(0, totalHrs - breakHrs).toFixed(2),
        (e as any).position || '',
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll_${period.start}_${period.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [entries, period]);

  // If an employee is selected, show their drill-down
  if (selectedEmployee) {
    return (
      <EmployeeTimesheetView
        employeeId={selectedEmployee}
        employees={employees}
        entries={entries}
        shifts={shifts}
        period={period}
        days={days}
        weeks={weeks}
        canApprove={canApprove}
        onBack={() => setSelectedEmployee(null)}
        goNext={goNext}
        goPrev={goPrev}
      />
    );
  }

  const isLoading = loadingEntries || loadingShifts;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card style={{ backgroundColor: colors.white }}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <PayPeriodNav period={period} onPrev={goPrev} onNext={goNext} />

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: colors.brownLight }} />
                <Input
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 w-[160px] text-sm"
                  style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[140px] text-sm" style={{ backgroundColor: colors.inputBg, borderColor: colors.creamDark }}>
                  <Filter className="w-3 h-3 mr-1" style={{ color: colors.brownLight }} />
                  <SelectValue placeholder="Status filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              {canExport && (
                <Button size="sm" onClick={handleExport} disabled={!entries.length}
                  style={{ backgroundColor: colors.gold, color: colors.white }}>
                  <Download className="w-4 h-4 mr-1" /> Export
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      <Card style={{ backgroundColor: colors.white }}>
        <CardContent className="pt-4">
          {isLoading ? (
            <CoffeeLoader text="Loading timesheets..." />
          ) : (
            <TimesheetGrid
              days={days}
              entries={entries}
              employees={employees}
              approvals={approvals}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              onEmployeeClick={setSelectedEmployee}
            />
          )}
        </CardContent>
      </Card>

      {/* Job insights */}
      {!isLoading && entries.length > 0 && (
        <JobInsights entries={entries} shifts={shifts} employees={employees} />
      )}
    </div>
  );
}
