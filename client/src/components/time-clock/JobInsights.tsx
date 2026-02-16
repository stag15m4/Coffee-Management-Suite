import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TimeClockEntry } from '@/hooks/use-time-clock';
import type { Shift } from '@/hooks/use-shifts';
import type { UnifiedEmployee } from '@/hooks/use-all-employees';
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
  if (h <= 0) return '0:00';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}:${String(mins).padStart(2, '0')}`;
}

interface JobInsight {
  job: string;
  totalHours: number;
  totalPay: number;
  shiftCount: number;
  avgHoursPerShift: number;
}

interface JobInsightsProps {
  entries: TimeClockEntry[];
  shifts: Shift[];
  employees: UnifiedEmployee[];
}

export function JobInsights({ entries, shifts, employees }: JobInsightsProps) {
  const insights = useMemo<JobInsight[]>(() => {
    // Map employee_id to hourly rate
    const rateMap = new Map<string, number>();
    for (const emp of employees) {
      if (emp.user_profile_id && emp.hourly_rate) {
        rateMap.set(emp.user_profile_id, emp.hourly_rate);
      }
    }

    // Map employee_id to position from shifts
    const positionMap = new Map<string, string>();
    for (const s of shifts) {
      if (s.employee_id && s.position) {
        positionMap.set(s.employee_id, s.position);
      }
    }

    // Group entries by position/job
    const jobMap = new Map<string, { totalHours: number; totalPay: number; shiftCount: number }>();

    for (const entry of entries) {
      const position = (entry as any).position || positionMap.get(entry.employee_id) || 'Unassigned';
      const totalH = calcHours(entry.clock_in, entry.clock_out);
      const breakH = calcBreakHours(entry.breaks ?? []);
      const netH = Math.max(0, totalH - breakH);
      const rate = rateMap.get(entry.employee_id) ?? 0;
      const pay = netH * rate;

      if (!jobMap.has(position)) {
        jobMap.set(position, { totalHours: 0, totalPay: 0, shiftCount: 0 });
      }
      const j = jobMap.get(position)!;
      j.totalHours += netH;
      j.totalPay += pay;
      j.shiftCount += 1;
    }

    return Array.from(jobMap.entries()).map(([job, data]) => ({
      job,
      totalHours: data.totalHours,
      totalPay: data.totalPay,
      shiftCount: data.shiftCount,
      avgHoursPerShift: data.shiftCount > 0 ? data.totalHours / data.shiftCount : 0,
    })).sort((a, b) => b.totalHours - a.totalHours);
  }, [entries, shifts, employees]);

  if (insights.length === 0) return null;

  return (
    <Card style={{ backgroundColor: colors.white }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm" style={{ color: colors.brown }}>
          Job insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.creamDark}` }}>
                <th className="text-left py-2 px-2" style={{ color: colors.brownLight }}>Job</th>
                <th className="text-right py-2 px-2" style={{ color: colors.brownLight }}>Total hours</th>
                <th className="text-right py-2 px-2" style={{ color: colors.brownLight }}>Total pay</th>
                <th className="text-right py-2 px-2" style={{ color: colors.brownLight }}>Avg hours per shift</th>
              </tr>
            </thead>
            <tbody>
              {insights.map((row) => (
                <tr key={row.job} style={{ borderBottom: `1px solid ${colors.cream}` }}>
                  <td className="py-2 px-2" style={{ color: colors.brown }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.green }} />
                      {row.job}
                    </div>
                  </td>
                  <td className="text-right py-2 px-2 font-medium" style={{ color: colors.brown }}>
                    {formatHM(row.totalHours)}
                  </td>
                  <td className="text-right py-2 px-2" style={{ color: colors.brown }}>
                    {row.totalPay > 0 ? `$${row.totalPay.toFixed(2)}` : '--'}
                  </td>
                  <td className="text-right py-2 px-2" style={{ color: colors.brownLight }}>
                    {formatHM(row.avgHoursPerShift)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
