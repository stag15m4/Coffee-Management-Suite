import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase-queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { colors } from '@/lib/colors';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Calendar,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// Date helpers
function startOfMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function endOfMonth(date: Date): string {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface CashEntry {
  id: string;
  drawer_date: string;
  gross_revenue: number;
  tip_pool: number;
  owner_tips: number;
  actual_deposit: number;
  calculated_deposit: number;
  flagged: boolean;
  excluded_from_average: boolean;
}

interface TaskRow {
  id: string;
  status: string;
  priority: string;
  due_date: string | null;
}

interface TipWeekRow {
  week_key: string;
  cash_entries: number[];
  cc_entries: number[];
}

const PIE_COLORS = [colors.gold, colors.brown, '#6B8E23', '#CD853F', '#8B4513'];

export default function Reporting() {
  const { tenant, canAccessModule, hasRole } = useAuth();
  const tenantId = tenant?.id;
  const isManager = hasRole?.('manager') || hasRole?.('owner');

  const [period, setPeriod] = useState<'this-month' | 'last-month' | 'last-3'>('this-month');
  const [cashData, setCashData] = useState<CashEntry[]>([]);
  const [prevCashData, setPrevCashData] = useState<CashEntry[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [tipData, setTipData] = useState<TipWeekRow[]>([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'this-month') {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    } else if (period === 'last-month') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    } else {
      const threeAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { start: startOfMonth(threeAgo), end: endOfMonth(now) };
    }
  }, [period]);

  // Previous period for comparison
  const prevDateRange = useMemo(() => {
    const s = new Date(dateRange.start + 'T00:00:00');
    const e = new Date(dateRange.end + 'T00:00:00');
    const durationMs = e.getTime() - s.getTime();
    const prevEnd = new Date(s.getTime() - 86400000); // day before start
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return {
      start: `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2, '0')}-${String(prevStart.getDate()).padStart(2, '0')}`,
      end: `${prevEnd.getFullYear()}-${String(prevEnd.getMonth() + 1).padStart(2, '0')}-${String(prevEnd.getDate()).padStart(2, '0')}`,
    };
  }, [dateRange]);

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);

    try {
      const queries = [];

      // Cash deposits for current period
      if (canAccessModule('cash-deposit')) {
        queries.push(
          supabase
            .from('cash_activity')
            .select('id, drawer_date, gross_revenue, tip_pool, owner_tips, actual_deposit, calculated_deposit, flagged, excluded_from_average')
            .eq('tenant_id', tenantId)
            .gte('drawer_date', dateRange.start)
            .lte('drawer_date', dateRange.end)
            .order('drawer_date')
            .then(({ data }) => setCashData((data as CashEntry[]) || []))
        );
        // Previous period for comparison
        queries.push(
          supabase
            .from('cash_activity')
            .select('id, drawer_date, gross_revenue, tip_pool, owner_tips, actual_deposit, calculated_deposit, flagged, excluded_from_average')
            .eq('tenant_id', tenantId)
            .gte('drawer_date', prevDateRange.start)
            .lte('drawer_date', prevDateRange.end)
            .then(({ data }) => setPrevCashData((data as CashEntry[]) || []))
        );
      }

      // Tasks
      if (canAccessModule('admin-tasks')) {
        queries.push(
          supabase
            .from('admin_tasks')
            .select('id, status, priority, due_date')
            .eq('tenant_id', tenantId)
            .then(({ data }) => setTasks((data as TaskRow[]) || []))
        );
      }

      // Tips
      if (canAccessModule('tip-payout')) {
        queries.push(
          supabase
            .from('tip_weekly_data')
            .select('week_key, cash_entries, cc_entries')
            .eq('tenant_id', tenantId)
            .gte('week_key', dateRange.start)
            .lte('week_key', dateRange.end)
            .order('week_key')
            .then(({ data }) => setTipData((data as TipWeekRow[]) || []))
        );
      }

      // Employee count
      queries.push(
        supabase
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .then(({ count }) => setEmployeeCount(count || 0))
      );

      await Promise.all(queries);
    } catch (error) {
      console.error('Error loading reporting data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId, dateRange, prevDateRange, canAccessModule]);

  useEffect(() => { loadData(); }, [loadData]);

  // Revenue metrics
  const revenueMetrics = useMemo(() => {
    const total = cashData.reduce((sum, e) => sum + (Number(e.gross_revenue) || 0), 0);
    const prevTotal = prevCashData.reduce((sum, e) => sum + (Number(e.gross_revenue) || 0), 0);
    const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;
    const daysWithData = cashData.filter(e => !e.excluded_from_average).length;
    const avgDaily = daysWithData > 0
      ? cashData.filter(e => !e.excluded_from_average).reduce((s, e) => s + (Number(e.gross_revenue) || 0), 0) / daysWithData
      : 0;
    return { total, prevTotal, change, avgDaily, daysWithData };
  }, [cashData, prevCashData]);

  // Cash accuracy
  const cashAccuracy = useMemo(() => {
    const entries = cashData.filter(e => Number(e.actual_deposit) > 0);
    const variances = entries.map(e => ({
      date: e.drawer_date,
      variance: Number(e.actual_deposit) - Number(e.calculated_deposit),
    }));
    const flagged = cashData.filter(e => e.flagged).length;
    const totalVariance = variances.reduce((s, v) => s + Math.abs(v.variance), 0);
    const accurate = entries.filter(e => Math.abs(Number(e.actual_deposit) - Number(e.calculated_deposit)) < 1).length;
    const accuracyPct = entries.length > 0 ? (accurate / entries.length) * 100 : 100;
    return { variances, flagged, totalVariance, accuracyPct, entryCount: entries.length };
  }, [cashData]);

  // Tip summary
  const tipMetrics = useMemo(() => {
    let totalCash = 0;
    let totalCC = 0;
    for (const week of tipData) {
      totalCash += (week.cash_entries || []).reduce((s: number, v: number) => s + (v || 0), 0);
      totalCC += (week.cc_entries || []).reduce((s: number, v: number) => s + (v || 0), 0);
    }
    return { totalCash, totalCC, total: totalCash + totalCC };
  }, [tipData]);

  // Task metrics
  const taskMetrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length;
    const byPriority = {
      high: tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length,
      medium: tasks.filter(t => t.priority === 'medium' && t.status !== 'completed').length,
      low: tasks.filter(t => (t.priority === 'low' || !t.priority) && t.status !== 'completed').length,
    };
    return { total, completed, pending, inProgress, overdue, byPriority, completionRate: total > 0 ? (completed / total) * 100 : 0 };
  }, [tasks]);

  // Revenue chart data
  const revenueChartData = useMemo(() =>
    cashData.map(e => ({
      date: formatShortDate(e.drawer_date),
      revenue: Number(e.gross_revenue) || 0,
    }))
  , [cashData]);

  // Variance chart data
  const varianceChartData = useMemo(() =>
    cashAccuracy.variances.slice(-30).map(v => ({
      date: formatShortDate(v.date),
      variance: Number(v.variance.toFixed(2)),
    }))
  , [cashAccuracy.variances]);

  // Tip breakdown pie
  const tipPieData = useMemo(() => [
    { name: 'Cash Tips', value: tipMetrics.totalCash },
    { name: 'CC Tips', value: tipMetrics.totalCC },
  ].filter(d => d.value > 0), [tipMetrics]);

  // Task status pie
  const taskPieData = useMemo(() => [
    { name: 'Completed', value: taskMetrics.completed },
    { name: 'In Progress', value: taskMetrics.inProgress },
    { name: 'Pending', value: taskMetrics.pending },
  ].filter(d => d.value > 0), [taskMetrics]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-6 h-6" style={{ color: colors.gold }} />
            <h1 className="text-2xl font-bold" style={{ color: colors.brown }}>Reporting</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} style={{ backgroundColor: colors.white }}>
                <CardContent className="pt-6">
                  <div className="h-20 rounded animate-pulse" style={{ backgroundColor: colors.cream }} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header + period selector */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6" style={{ color: colors.gold }} />
            <h1 className="text-2xl font-bold" style={{ color: colors.brown }}>Reporting</h1>
          </div>
          <div className="flex gap-2">
            {(['this-month', 'last-month', 'last-3'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-4 py-2 rounded-lg font-medium text-sm transition-all"
                style={{
                  backgroundColor: period === p ? colors.gold : colors.white,
                  color: period === p ? colors.white : colors.brown,
                  border: `1px solid ${period === p ? colors.gold : colors.creamDark}`,
                }}
              >
                {p === 'this-month' ? 'This Month' : p === 'last-month' ? 'Last Month' : 'Last 3 Months'}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Revenue */}
          {canAccessModule('cash-deposit') && (
            <Card style={{ backgroundColor: colors.white }}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: colors.brownLight }}>Gross Revenue</span>
                  <DollarSign className="w-4 h-4" style={{ color: colors.gold }} />
                </div>
                <div className="text-2xl font-bold" style={{ color: colors.brown }}>
                  {formatCurrency(revenueMetrics.total)}
                </div>
                {revenueMetrics.prevTotal > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {revenueMetrics.change >= 0 ? (
                      <TrendingUp className="w-3 h-3" style={{ color: '#16a34a' }} />
                    ) : (
                      <TrendingDown className="w-3 h-3" style={{ color: '#ef4444' }} />
                    )}
                    <span className="text-xs font-medium" style={{ color: revenueMetrics.change >= 0 ? '#16a34a' : '#ef4444' }}>
                      {Math.abs(revenueMetrics.change).toFixed(1)}% vs prior period
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Daily Average */}
          {canAccessModule('cash-deposit') && (
            <Card style={{ backgroundColor: colors.white }}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: colors.brownLight }}>Avg Daily Revenue</span>
                  <Calendar className="w-4 h-4" style={{ color: colors.gold }} />
                </div>
                <div className="text-2xl font-bold" style={{ color: colors.brown }}>
                  {formatCurrency(revenueMetrics.avgDaily)}
                </div>
                <div className="text-xs mt-1" style={{ color: colors.brownLight }}>
                  {revenueMetrics.daysWithData} day{revenueMetrics.daysWithData !== 1 ? 's' : ''} of data
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cash Accuracy */}
          {canAccessModule('cash-deposit') && isManager && (
            <Card style={{ backgroundColor: colors.white }}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: colors.brownLight }}>Cash Accuracy</span>
                  {cashAccuracy.accuracyPct >= 95 ? (
                    <CheckCircle className="w-4 h-4" style={{ color: '#16a34a' }} />
                  ) : (
                    <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                  )}
                </div>
                <div className="text-2xl font-bold" style={{ color: cashAccuracy.accuracyPct >= 95 ? colors.brown : '#ef4444' }}>
                  {cashAccuracy.accuracyPct.toFixed(0)}%
                </div>
                <div className="text-xs mt-1" style={{ color: colors.brownLight }}>
                  {cashAccuracy.flagged > 0 ? `${cashAccuracy.flagged} flagged` : 'No flagged entries'}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team */}
          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: colors.brownLight }}>Team Size</span>
                <Users className="w-4 h-4" style={{ color: colors.gold }} />
              </div>
              <div className="text-2xl font-bold" style={{ color: colors.brown }}>
                {employeeCount}
              </div>
              <div className="text-xs mt-1" style={{ color: colors.brownLight }}>
                Active members
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1: Revenue + Variance */}
        {canAccessModule('cash-deposit') && revenueChartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <Card style={{ backgroundColor: colors.white }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base" style={{ color: colors.brown }}>Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.creamDark} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: colors.brownLight }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: colors.brownLight }}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                        contentStyle={{ backgroundColor: colors.white, borderColor: colors.creamDark, borderRadius: 8 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke={colors.gold}
                        strokeWidth={2}
                        dot={{ fill: colors.gold, r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Cash Variance */}
            {isManager && varianceChartData.length > 0 && (
              <Card style={{ backgroundColor: colors.white }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base" style={{ color: colors.brown }}>
                    Deposit Variance (Actual − Expected)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={varianceChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.creamDark} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: colors.brownLight }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: colors.brownLight }}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'Variance']}
                          contentStyle={{ backgroundColor: colors.white, borderColor: colors.creamDark, borderRadius: 8 }}
                        />
                        <Bar
                          dataKey="variance"
                          radius={[4, 4, 0, 0]}
                          fill={colors.gold}
                        >
                          {varianceChartData.map((entry, index) => (
                            <Cell
                              key={index}
                              fill={entry.variance >= 0 ? '#16a34a' : '#ef4444'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Charts Row 2: Tips + Tasks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tip Breakdown */}
          {canAccessModule('tip-payout') && tipMetrics.total > 0 && (
            <Card style={{ backgroundColor: colors.white }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base" style={{ color: colors.brown }}>Tip Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="h-48 w-48 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={tipPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {tipPieData.map((_, index) => (
                            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{ backgroundColor: colors.white, borderColor: colors.creamDark, borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 flex-1">
                    <div>
                      <div className="text-sm" style={{ color: colors.brownLight }}>Total Tips</div>
                      <div className="text-xl font-bold" style={{ color: colors.brown }}>{formatCurrency(tipMetrics.total)}</div>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.gold }} />
                          <span className="text-xs" style={{ color: colors.brownLight }}>Cash</span>
                        </div>
                        <div className="font-semibold text-sm" style={{ color: colors.brown }}>{formatCurrency(tipMetrics.totalCash)}</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.brown }} />
                          <span className="text-xs" style={{ color: colors.brownLight }}>Credit Card</span>
                        </div>
                        <div className="font-semibold text-sm" style={{ color: colors.brown }}>{formatCurrency(tipMetrics.totalCC)}</div>
                      </div>
                    </div>
                    {tipMetrics.total > 0 && (
                      <div className="text-xs" style={{ color: colors.brownLight }}>
                        {((tipMetrics.totalCash / tipMetrics.total) * 100).toFixed(0)}% cash / {((tipMetrics.totalCC / tipMetrics.total) * 100).toFixed(0)}% CC
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Task Status */}
          {canAccessModule('admin-tasks') && taskMetrics.total > 0 && (
            <Card style={{ backgroundColor: colors.white }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base" style={{ color: colors.brown }}>Task Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="h-48 w-48 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={taskPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {taskPieData.map((_, index) => (
                            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: colors.white, borderColor: colors.creamDark, borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 flex-1">
                    <div>
                      <div className="text-sm" style={{ color: colors.brownLight }}>Completion Rate</div>
                      <div className="text-xl font-bold" style={{ color: colors.brown }}>{taskMetrics.completionRate.toFixed(0)}%</div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
                        <span style={{ color: colors.brown }}>{taskMetrics.completed} completed</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-3.5 h-3.5" style={{ color: colors.gold }} />
                        <span style={{ color: colors.brown }}>{taskMetrics.inProgress} in progress</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                        <span style={{ color: colors.brown }}>{taskMetrics.overdue} overdue</span>
                      </div>
                    </div>
                    {(taskMetrics.byPriority.high > 0) && (
                      <div className="text-xs px-2 py-1 rounded inline-block" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
                        {taskMetrics.byPriority.high} high-priority open
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Empty state when no data modules are accessible */}
        {!canAccessModule('cash-deposit') && !canAccessModule('tip-payout') && !canAccessModule('admin-tasks') && (
          <Card style={{ backgroundColor: colors.white }}>
            <CardContent className="py-12 text-center">
              <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: colors.brownLight }} />
              <h3 className="text-lg font-semibold mb-1" style={{ color: colors.brown }}>No report data available</h3>
              <p className="text-sm" style={{ color: colors.brownLight }}>
                Enable modules like Cash Deposit, Tip Payout, or Tasks to see reporting data here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
