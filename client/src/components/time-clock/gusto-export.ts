import { supabase } from '@/lib/supabase-queries';
import type { TimeClockEntry, TimeClockBreak } from '@/hooks/use-time-clock';
import type { TimesheetApproval } from '@/hooks/use-timesheet-approvals';
import type { UnifiedEmployee } from '@/hooks/use-all-employees';
import type { WeekGroup } from '@/lib/pay-periods';
import { CC_FEE_RATE } from '@/components/tip-payout/types';

// ── Types ───────────────────────────────────────────────────────────────

interface GustoEmployeeRow {
  name: string;
  regularHours: number;
  overtimeHours: number;
  cashTips: number;
  ptoHours: number;
}

export interface GustoExportParams {
  tenantId: string;
  entries: TimeClockEntry[];
  employees: UnifiedEmployee[];
  approvals: TimesheetApproval[];
  weeks: WeekGroup[];
  period: { start: string; end: string };
}

// ── Helpers ─────────────────────────────────────────────────────────────

function calcNetHours(entry: TimeClockEntry): number {
  if (!entry.clock_out) return 0;
  const gross =
    (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3_600_000;
  const breakHrs = (entry.breaks ?? []).reduce((sum, b: TimeClockBreak) => {
    if (!b.break_end) return sum;
    return sum + (new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 3_600_000;
  }, 0);
  return Math.max(0, gross - breakHrs);
}

/** Return the YYYY-MM-DD date portion of an ISO timestamp in local time. */
function toDateStr(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Find Monday week_keys that overlap a pay period. */
function getWeekKeysForPeriod(periodStart: string, periodEnd: string): string[] {
  const keys: string[] = [];
  const start = new Date(periodStart + 'T00:00:00');
  const end = new Date(periodEnd + 'T00:00:00');

  // Walk back to Monday on or before periodStart
  const d = new Date(start);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));

  while (d <= end) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    keys.push(`${y}-${m}-${dd}`);
    d.setDate(d.getDate() + 7);
  }
  return keys;
}

// ── Hours aggregation ───────────────────────────────────────────────────

/**
 * Group time clock entries by employee & week, then split into
 * regular (≤40/week) and overtime (>40/week).
 */
function aggregateHoursByEmployee(
  entries: TimeClockEntry[],
  employees: UnifiedEmployee[],
  weeks: WeekGroup[],
): Map<string, { name: string; regularHours: number; overtimeHours: number }> {
  // Build a set of day strings per week for fast lookup
  const dayToWeekIdx = new Map<string, number>();
  weeks.forEach((w, idx) => w.days.forEach((d) => dayToWeekIdx.set(d, idx)));

  // Map employee_id → name
  const empNameById = new Map<string, string>();
  for (const e of employees) {
    if (e.user_profile_id) empNameById.set(e.user_profile_id, e.name);
  }

  // Accumulate net hours: employee_id → weekIdx → hours
  const empWeekHours = new Map<string, Map<number, number>>();
  for (const entry of entries) {
    if (!entry.clock_out) continue;
    const hrs = calcNetHours(entry);
    if (hrs <= 0) continue;

    const dateStr = toDateStr(entry.clock_in);
    const weekIdx = dayToWeekIdx.get(dateStr);
    if (weekIdx === undefined) continue;

    const empId = entry.employee_id;
    if (!empWeekHours.has(empId)) empWeekHours.set(empId, new Map());
    const weekMap = empWeekHours.get(empId)!;
    weekMap.set(weekIdx, (weekMap.get(weekIdx) ?? 0) + hrs);
  }

  // Split into regular / overtime
  const result = new Map<string, { name: string; regularHours: number; overtimeHours: number }>();
  Array.from(empWeekHours.entries()).forEach(([empId, weekMap]) => {
    let regular = 0;
    let overtime = 0;
    Array.from(weekMap.values()).forEach((weeklyHrs) => {
      if (weeklyHrs > 40) {
        regular += 40;
        overtime += weeklyHrs - 40;
      } else {
        regular += weeklyHrs;
      }
    });
    const name = empNameById.get(empId) ?? 'Unknown';
    result.set(empId, { name, regularHours: regular, overtimeHours: overtime });
  });

  return result;
}

// ── Tip payout fetch ────────────────────────────────────────────────────

/**
 * Query tip_weekly_data and tip_employee_hours from Supabase for weeks
 * overlapping the pay period, then compute each employee's tip payout.
 * Returns a Map keyed by employee name (for matching to hours data).
 */
async function fetchTipPayoutsForPeriod(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  employees: UnifiedEmployee[],
): Promise<Map<string, number>> {
  const weekKeys = getWeekKeysForPeriod(periodStart, periodEnd);
  if (weekKeys.length === 0) return new Map();

  const [weeklyRes, hoursRes] = await Promise.all([
    supabase
      .from('tip_weekly_data')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('week_key', weekKeys),
    supabase
      .from('tip_employee_hours')
      .select('*, tip_employees(id, name)')
      .eq('tenant_id', tenantId)
      .in('week_key', weekKeys),
  ]);

  if (weeklyRes.error) throw weeklyRes.error;
  if (hoursRes.error) throw hoursRes.error;

  const weeklyData = weeklyRes.data ?? [];
  const hoursData = hoursRes.data ?? [];

  // Build tip_employee_id → employee name map from UnifiedEmployee
  const tipIdToName = new Map<string, string>();
  for (const e of employees) {
    if (e.tip_employee_id) tipIdToName.set(e.tip_employee_id, e.name);
  }

  // Per-employee accumulated tip payout, keyed by name
  const payoutByName = new Map<string, number>();

  // Process each week independently
  for (const wd of weeklyData) {
    const cashTotal = parseFloat(String(wd.cash_tips)) || 0;
    const ccTotal = parseFloat(String(wd.cc_tips)) || 0;
    const pool = cashTotal + ccTotal * (1 - CC_FEE_RATE);

    // Get employee hours for this week
    const weekHours = hoursData.filter((h: any) => h.week_key === wd.week_key);
    const totalTeamHours = weekHours.reduce(
      (sum: number, h: any) => sum + (parseFloat(String(h.hours)) || 0),
      0,
    );
    if (totalTeamHours <= 0 || pool <= 0) continue;

    const hourlyTipRate = pool / totalTeamHours;

    for (const h of weekHours) {
      const empHours = parseFloat(String(h.hours)) || 0;
      if (empHours <= 0) continue;

      // Resolve employee name: first by tip_employee_id via UnifiedEmployee, then by joined name
      const tipEmpId = h.employee_id;
      let name = tipIdToName.get(tipEmpId) ?? h.tip_employees?.name ?? null;
      if (!name) continue;

      const payout = empHours * hourlyTipRate;
      payoutByName.set(name, (payoutByName.get(name) ?? 0) + payout);
    }
  }

  return payoutByName;
}

// ── CSV builder ─────────────────────────────────────────────────────────

function buildGustoCsv(rows: GustoEmployeeRow[]): string {
  const headers = ['Employee', 'Regular Hours', 'Overtime Hours', 'Cash Tips', 'PTO Hours'];
  const lines = [headers.map((h) => `"${h}"`).join(',')];

  for (const r of rows.sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(
      [
        `"${r.name}"`,
        r.regularHours.toFixed(2),
        r.overtimeHours.toFixed(2),
        r.cashTips.toFixed(2),
        r.ptoHours.toFixed(2),
      ].join(','),
    );
  }

  return lines.join('\n');
}

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Main export orchestrator ────────────────────────────────────────────

export async function exportGustoCsv(params: GustoExportParams): Promise<void> {
  const { tenantId, entries, employees, approvals, weeks, period } = params;

  // 1. Aggregate hours with regular/OT split
  const hoursMap = aggregateHoursByEmployee(entries, employees, weeks);

  // 2. Fetch tip payouts for the period
  const tipMap = await fetchTipPayoutsForPeriod(tenantId, period.start, period.end, employees);

  // 3. Build PTO lookup from approvals (employee_id → pto hours)
  const ptoByEmpId = new Map<string, number>();
  for (const a of approvals) {
    if (a.total_pto_hours && a.total_pto_hours > 0) {
      ptoByEmpId.set(a.employee_id, a.total_pto_hours);
    }
  }

  // 4. Merge into rows — only employees who have time clock hours
  const rows: GustoEmployeeRow[] = [];
  Array.from(hoursMap.entries()).forEach(([empId, data]) => {
    const cashTips = tipMap.get(data.name) ?? 0;
    const ptoHours = ptoByEmpId.get(empId) ?? 0;

    rows.push({
      name: data.name,
      regularHours: data.regularHours,
      overtimeHours: data.overtimeHours,
      cashTips,
      ptoHours,
    });
  });

  if (rows.length === 0) {
    throw new Error('No employee hours found for this pay period.');
  }

  // 5. Build CSV and trigger download
  const csv = buildGustoCsv(rows);
  const filename = `gusto_payroll_${period.start}_${period.end}.csv`;
  downloadCsv(csv, filename);
}
