import { timesheetSnapshot } from '@/lib/timesheet-snapshot';
import { supabase } from '@/lib/supabase-queries';
import type { TimeClockEntry, TimeClockBreak } from '@/hooks/use-time-clock';
import type { TimesheetApproval } from '@/hooks/use-timesheet-approvals';
import type { UnifiedEmployee } from '@/hooks/use-all-employees';
import type { WeekGroup } from '@/lib/pay-periods';

// ── Types ───────────────────────────────────────────────────────────────

interface GustoEmployeeRow {
  name: string;
  regularHours: number;
  overtimeHours: number;
  tipTotal: number;
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
export function aggregateHoursByEmployee(
  entries: TimeClockEntry[],
  employees: UnifiedEmployee[],
  weeks: WeekGroup[]
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
    const empId = entry.employee_id;
    const end = new Date(entry.clock_out);
    let cursor = new Date(entry.clock_in);
    while (cursor < end) {
      const nextMidnight = new Date(cursor);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);
      const segmentEnd = Math.min(nextMidnight.getTime(), end.getTime());
      const day = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const weekIdx = dayToWeekIdx.get(day);
      if (weekIdx !== undefined) {
        const breakMs = (entry.breaks ?? []).reduce((sum, b: TimeClockBreak) => {
          if (!b.break_end) return sum;
          return (
            sum +
            Math.max(
              0,
              Math.min(new Date(b.break_end).getTime(), segmentEnd) -
                Math.max(new Date(b.break_start).getTime(), cursor.getTime())
            )
          );
        }, 0);
        const hours = Math.max(0, segmentEnd - cursor.getTime() - breakMs) / 3_600_000;
        if (!empWeekHours.has(empId)) empWeekHours.set(empId, new Map());
        const weekMap = empWeekHours.get(empId)!;
        weekMap.set(weekIdx, (weekMap.get(weekIdx) ?? 0) + hours);
      }
      cursor = new Date(segmentEnd);
    }
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
 * Read approved weekly payouts by explicit roster-to-account link. A payroll
 * period containing a partial tip week cannot safely allocate that week's pool.
 */
async function fetchTipPayoutsForPeriod(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  employeeIds: Set<string>
): Promise<Map<string, number>> {
  const weekKeys = getWeekKeysForPeriod(periodStart, periodEnd);
  if (weekKeys.length === 0) return new Map();

  const [weeklyRes, approvalsRes, rosterRes] = await Promise.all([
    supabase
      .from('tip_weekly_data')
      .select('week_key,cash_tips,cc_tips')
      .eq('tenant_id', tenantId)
      .in('week_key', weekKeys),
    supabase
      .from('tip_payout_approvals')
      .select('week_key,status,employee_payouts')
      .eq('tenant_id', tenantId)
      .in('week_key', weekKeys),
    supabase.from('tip_employees').select('id,user_profile_id').eq('tenant_id', tenantId),
  ]);

  if (weeklyRes.error) throw weeklyRes.error;
  if (approvalsRes.error) throw approvalsRes.error;
  if (rosterRes.error) throw rosterRes.error;

  return sumApprovedTipPayouts({
    weeks: weeklyRes.data ?? [],
    approvals: approvalsRes.data ?? [],
    roster: rosterRes.data ?? [],
    periodStart,
    periodEnd,
    employeeIds,
  });
}

export function sumApprovedTipPayouts({
  weeks,
  approvals: snapshots,
  roster,
  periodStart,
  periodEnd,
  employeeIds,
}: {
  weeks: Array<{ week_key: string; cash_tips: number | string | null; cc_tips: number | string | null }>;
  approvals: Array<{
    week_key: string;
    status: string;
    employee_payouts: Array<{ employee_id: string; payout: number }>;
  }>;
  roster: Array<{ id: string; user_profile_id: string | null }>;
  periodStart: string;
  periodEnd: string;
  employeeIds: Set<string>;
}): Map<string, number> {
  const links = new Map(roster.map((person) => [person.id, person.user_profile_id]));
  const approvals = new Map(snapshots.map((approval) => [approval.week_key, approval]));
  const payoutByAccount = new Map<string, number>();
  for (const week of weeks) {
    if (Number(week.cash_tips) + Number(week.cc_tips) <= 0) continue;
    const start = new Date(`${week.week_key}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const lastDay = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    if (week.week_key < periodStart || lastDay > periodEnd) {
      throw new Error(`Tip week ${week.week_key} crosses the pay period. Review it separately.`);
    }
    const approved = approvals.get(week.week_key);
    if (approved?.status !== 'approved') {
      throw new Error(`Tip week ${week.week_key} needs manager approval before payroll review.`);
    }
    for (const payout of approved.employee_payouts) {
      const profileId = links.get(payout.employee_id);
      if (!profileId || !employeeIds.has(profileId)) {
        throw new Error(`Tip week ${week.week_key} has a payout without a linked timesheet account.`);
      }
      payoutByAccount.set(profileId, (payoutByAccount.get(profileId) ?? 0) + Number(payout.payout));
    }
  }
  return payoutByAccount;
}

// ── CSV builder ─────────────────────────────────────────────────────────

function buildGustoCsv(rows: GustoEmployeeRow[]): string {
  const headers = ['Employee', 'Regular Hours', 'Overtime Hours', 'Tip Total (Review)', 'PTO Hours'];
  const lines = [headers.map((h) => `"${h}"`).join(',')];
  const names = new Set<string>();

  for (const r of rows.sort((a, b) => a.name.localeCompare(b.name))) {
    const key = r.name.trim().toLowerCase();
    if (names.has(key))
      throw new Error(`Two payroll accounts are named ${r.name}. Match them to Gusto before exporting.`);
    names.add(key);
    const safeName = r.name.replace(/"/g, '""').replace(/^[=+@-]/, "'$&");
    lines.push(
      [
        `"${safeName}"`,
        r.regularHours.toFixed(2),
        r.overtimeHours.toFixed(2),
        r.tipTotal.toFixed(2),
        r.ptoHours.toFixed(2),
      ].join(',')
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
  const { tenantId, entries, employees, weeks, period } = params;
  // Validate the exact on-screen records against current database approvals.
  // Repeat immediately before download to detect edits while tips are loading.
  const validateApproval = async (): Promise<TimesheetApproval[]> => {
    const { data, error } = await supabase.rpc('validate_timesheet_export', {
      p_tenant: tenantId,
      p_start: period.start,
      p_end: period.end,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      p_expected: timesheetSnapshot(entries),
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  };
  const approvals = await validateApproval();

  // 1. Aggregate hours with regular/OT split
  const hoursMap = aggregateHoursByEmployee(entries, employees, weeks);

  // 2. Fetch tip payouts for the period
  const tipMap = await fetchTipPayoutsForPeriod(tenantId, period.start, period.end, new Set(hoursMap.keys()));

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
    const tipTotal = tipMap.get(empId) ?? 0;
    const ptoHours = ptoByEmpId.get(empId) ?? 0;

    rows.push({
      name: data.name,
      regularHours: data.regularHours,
      overtimeHours: data.overtimeHours,
      tipTotal,
      ptoHours,
    });
  });

  if (rows.length === 0) {
    throw new Error('No employee hours found for this pay period.');
  }

  // 5. Build CSV and trigger download
  const csv = buildGustoCsv(rows);
  const filename = `payroll_review_${period.start}_${period.end}.csv`;
  await validateApproval();
  downloadCsv(csv, filename);
}
