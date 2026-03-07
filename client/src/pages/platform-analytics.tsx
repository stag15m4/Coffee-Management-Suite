import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';
import { CoffeeLoader } from '@/components/CoffeeLoader';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Percent,
  ChevronDown,
  ChevronUp,
  Save,
  ArrowLeft,
  LayoutDashboard,
  Building2,
  Database,
  Settings,
  Bug,
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
  Area,
  AreaChart,
  Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformOverview {
  tenantsByPlan: Array<{
    subscription_plan: string;
    subscription_status: string;
    billing_interval: string;
    count: number;
    total_locations: number;
  }>;
  totalActiveUsers: number;
  totalActiveTenants: number;
  monthlyGrowth: Array<{
    month: string;
    new_tenants: number;
    direct: number;
    wholesale: number;
  }>;
  moduleAdoption: Array<{
    module_id: string;
    module_name: string;
    subscriber_count: number;
  }>;
  resellers: Array<{
    id: string;
    name: string;
    tier: string;
    seats_used: number;
    seats_total: number;
    wholesale_rate_per_seat: number;
    total_invoiced: number;
    total_paid: number;
  }>;
  plans: Array<{
    id: string;
    name: string;
    monthly_price: number;
    annual_price: number;
  }>;
}

interface CostSettings {
  hosting: number;
  supabase: number;
  stripe_fee_percent: number;
  support_labor: number;
  other: number;
  notes?: string;
}

interface ForecastRow {
  month: string;
  currentMrr: number;
  projected: number;
  costs: number;
  profit: number;
  tenants: number;
  users: number;
  supabaseCost: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatCurrencyDecimal(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

// Plan tiers we show sliders for (excludes free/beta which are internal)
const FORECAST_PLAN_IDS = ['starter', 'essential', 'professional', 'alacarte', 'premium'];

const PIE_COLORS = ['#3b82f6', '#f59e0b'];

// Wholesale reseller tiers — official pricing (Feb 2026)
// Rates = what we receive per seat (discount off Professional $99/mo retail)
const WHOLESALE_TIERS = [
  { id: 'authorized', label: 'Authorized', discount: 0.20, rate: 79.20 },
  { id: 'silver', label: 'Silver', discount: 0.30, rate: 69.30 },
  { id: 'gold', label: 'Gold', discount: 0.40, rate: 59.40 },
];

// Supabase pricing constants (2026 Pro & Team plans)
const SUPABASE_PRICING = {
  pro: { base: 25, includedMAU: 100000, includedStorageGB: 8, label: 'Pro ($25/mo)' },
  team: { base: 599, includedMAU: 100000, includedStorageGB: 8, label: 'Team ($599/mo)' },
  mauOverageRate: 0.00325, // per MAU above included
  storageOverageRate: 0.125, // per GB above included
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlatformAnalytics() {
  const { platformAdmin, isPlatformAdmin, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Data state
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [costs, setCosts] = useState<CostSettings>({
    hosting: 0,
    supabase: 0,
    stripe_fee_percent: 2.9,
    support_labor: 0,
    other: 0,
  });
  const [loading, setLoading] = useState(true);
  const [savingCosts, setSavingCosts] = useState(false);
  const [costsOpen, setCostsOpen] = useState(false);

  // Forecasting controls — per-tier acquisition
  const [newPerTier, setNewPerTier] = useState<Record<string, number>>({
    starter: 0,
    essential: 2,
    professional: 1,
  });
  const [newWholesalePerTier, setNewWholesalePerTier] = useState<Record<string, number>>({
    authorized: 5,
    silver: 3,
    gold: 1,
  });
  const [forecastMonths, setForecastMonths] = useState(6);

  // Supabase cost scaling
  const [supabasePlan, setSupabasePlan] = useState<'pro' | 'team'>('pro');
  const [usersPerTenant, setUsersPerTenant] = useState(5);
  const [storageMbPerTenant, setStorageMbPerTenant] = useState(50);

  // ─── Auth guard ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading && !isPlatformAdmin) {
      setLocation('/login');
    }
  }, [authLoading, isPlatformAdmin, setLocation]);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const getAuthHeaders = useCallback(async () => {
    const { getAuthHeaders: getHeaders } = await import('@/lib/api-helpers');
    const headers = await getHeaders();
    return { ...headers, 'Content-Type': 'application/json' };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [overviewRes, costsRes] = await Promise.all([
        fetch('/api/analytics/platform-overview', { headers }),
        fetch('/api/analytics/platform-costs', { headers }),
      ]);

      if (overviewRes.ok) {
        setOverview(await overviewRes.json());
      } else {
        console.error('Overview fetch failed:', overviewRes.status, await overviewRes.text());
      }
      if (costsRes.ok) {
        const costsData = await costsRes.json();
        if (costsData) {
          setCosts({
            hosting: Number(costsData.hosting) || 0,
            supabase: Number(costsData.supabase) || 0,
            stripe_fee_percent: Number(costsData.stripe_fee_percent) || 2.9,
            support_labor: Number(costsData.support_labor) || 0,
            other: Number(costsData.other) || 0,
            notes: costsData.notes || '',
          });
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error loading analytics',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, toast]);

  useEffect(() => {
    if (isPlatformAdmin) loadData();
  }, [isPlatformAdmin, loadData]);

  // ─── Computed: Plan prices lookup ─────────────────────────────────────────

  const planPrices = useMemo(() => {
    if (!overview) return {} as Record<string, { monthly: number; annual: number; name: string }>;
    const map: Record<string, { monthly: number; annual: number; name: string }> = {};
    for (const p of overview.plans) {
      map[p.id] = {
        monthly: Number(p.monthly_price) || 0,
        annual: Number(p.annual_price) || Number(p.monthly_price) || 0,
        name: p.name,
      };
    }
    return map;
  }, [overview]);

  // Plans available for forecasting sliders
  const forecastPlans = useMemo(() => {
    if (!overview) return [];
    return overview.plans
      .filter((p) => FORECAST_PLAN_IDS.includes(p.id))
      .sort((a, b) => Number(a.monthly_price) - Number(b.monthly_price));
  }, [overview]);

  // ─── Computed: MRR ────────────────────────────────────────────────────────

  const mrr = useMemo(() => {
    if (!overview) return { total: 0, direct: 0, wholesale: 0, byPlan: {} as Record<string, number>, trialCount: 0 };

    let directMrr = 0;
    let trialCount = 0;
    const byPlan: Record<string, number> = {};

    for (const row of overview.tenantsByPlan) {
      // Count trial tenants separately for display
      if (row.subscription_status === 'trial') {
        trialCount += Number(row.count);
      }
      // Include both active and trial in MRR (trials represent potential/current usage)
      if (row.subscription_status !== 'active' && row.subscription_status !== 'trial') continue;
      const prices = planPrices[row.subscription_plan];
      if (!prices) continue;
      const monthlyRate =
        row.billing_interval === 'annual' ? prices.annual : prices.monthly;
      const contribution = Number(row.count) * monthlyRate;
      directMrr += contribution;
      byPlan[row.subscription_plan] =
        (byPlan[row.subscription_plan] || 0) + contribution;
    }

    let wholesaleMrr = 0;
    for (const r of overview.resellers) {
      wholesaleMrr +=
        Number(r.seats_used) * Number(r.wholesale_rate_per_seat || 0);
    }

    return {
      total: directMrr + wholesaleMrr,
      direct: directMrr,
      wholesale: wholesaleMrr,
      byPlan,
      trialCount,
    };
  }, [overview, planPrices]);

  // ─── Computed: Current Supabase cost ──────────────────────────────────────

  const currentSupabaseCost = useMemo(() => {
    const pricing = SUPABASE_PRICING[supabasePlan];
    const totalUsers = overview?.totalActiveUsers || 0;
    const totalTenants = overview?.totalActiveTenants || 1;
    const storageGB = (totalTenants * storageMbPerTenant) / 1024;

    const mauOverage = Math.max(0, totalUsers - pricing.includedMAU) * SUPABASE_PRICING.mauOverageRate;
    const storageOverage = Math.max(0, storageGB - pricing.includedStorageGB) * SUPABASE_PRICING.storageOverageRate;

    return pricing.base + mauOverage + storageOverage;
  }, [overview, supabasePlan, storageMbPerTenant]);

  // ─── Computed: Total costs ────────────────────────────────────────────────

  const totalMonthlyCosts = useMemo(() => {
    const fixedCosts = costs.hosting + costs.support_labor + costs.other;
    const stripeFees = mrr.total * (costs.stripe_fee_percent / 100);
    return fixedCosts + currentSupabaseCost + stripeFees;
  }, [costs, mrr, currentSupabaseCost]);

  const costPerUser = useMemo(() => {
    if (!overview || overview.totalActiveUsers === 0) return 0;
    return totalMonthlyCosts / overview.totalActiveUsers;
  }, [totalMonthlyCosts, overview]);

  const grossMargin = useMemo(() => {
    if (mrr.total === 0) return 0;
    return ((mrr.total - totalMonthlyCosts) / mrr.total) * 100;
  }, [mrr, totalMonthlyCosts]);

  // ─── Computed: Chart data ─────────────────────────────────────────────────

  const revenueBreakdownData = useMemo(() => {
    return [
      { name: 'Direct', value: mrr.direct },
      { name: 'Wholesale', value: mrr.wholesale },
    ].filter((d) => d.value > 0);
  }, [mrr]);

  const planRevenueData = useMemo(() => {
    if (!overview) return [];
    return overview.plans
      .map((p) => ({
        plan: p.name,
        revenue: mrr.byPlan[p.id] || 0,
      }))
      .filter((d) => d.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [overview, mrr]);

  const moduleAdoptionData = useMemo(() => {
    if (!overview) return [];
    const totalTenants = overview.totalActiveTenants || 1;
    return overview.moduleAdoption.map((m) => ({
      name: m.module_name,
      count: m.subscriber_count,
      percent: Math.round((m.subscriber_count / totalTenants) * 100),
    }));
  }, [overview]);

  // ─── Computed: Forecast ───────────────────────────────────────────────────

  // Official wholesale rates per tier (from pricing-reference.pdf)
  const wholesaleRateByTier = useMemo(() => {
    const result: Record<string, number> = {};
    for (const tier of WHOLESALE_TIERS) {
      result[tier.id] = tier.rate;
    }
    return result;
  }, []);

  const forecast = useMemo((): ForecastRow[] => {
    if (!overview) return [];

    // Per-month new revenue from all tier sliders
    const newDirectRevenuePerMonth = Object.entries(newPerTier)
      .reduce((sum, [planId, count]) => sum + count * (planPrices[planId]?.monthly || 0), 0);
    const newWholesaleRevenuePerMonth = Object.entries(newWholesalePerTier)
      .reduce((sum, [tier, count]) => sum + count * (wholesaleRateByTier[tier] || 30), 0);
    const newTenantsPerMonth = Object.values(newPerTier).reduce((a, b) => a + b, 0);

    let projectedRevenue = mrr.total;
    let cumulativeNewTenants = 0;
    const currentTenants = overview.totalActiveTenants;
    const currentUsers = overview.totalActiveUsers;
    const months: ForecastRow[] = [];

    for (let i = 0; i <= forecastMonths; i++) {
      const projectedTenants = currentTenants + cumulativeNewTenants;
      const projectedUsers = currentUsers + (cumulativeNewTenants * usersPerTenant);
      const projectedStorageGB = (projectedTenants * storageMbPerTenant) / 1024;

      // Supabase scaling cost for this month
      const pricing = SUPABASE_PRICING[supabasePlan];
      const mauOverage = Math.max(0, projectedUsers - pricing.includedMAU) * SUPABASE_PRICING.mauOverageRate;
      const storageOverage = Math.max(0, projectedStorageGB - pricing.includedStorageGB) * SUPABASE_PRICING.storageOverageRate;
      const supabaseCost = pricing.base + mauOverage + storageOverage;

      // Total costs for this month
      const stripeFees = projectedRevenue * (costs.stripe_fee_percent / 100);
      const totalCosts = costs.hosting + supabaseCost + costs.support_labor + costs.other + stripeFees;

      months.push({
        month: i === 0 ? 'Now' : `Mo ${i}`,
        currentMrr: mrr.total,
        projected: Math.round(projectedRevenue),
        costs: Math.round(totalCosts),
        profit: Math.round(projectedRevenue - totalCosts),
        tenants: projectedTenants,
        users: projectedUsers,
        supabaseCost: Math.round(supabaseCost),
      });

      // Grow for next iteration
      projectedRevenue += newDirectRevenuePerMonth + newWholesaleRevenuePerMonth;
      cumulativeNewTenants += newTenantsPerMonth;
    }

    return months;
  }, [overview, mrr, costs, newPerTier, newWholesalePerTier, forecastMonths,
      usersPerTenant, storageMbPerTenant, supabasePlan, planPrices, wholesaleRateByTier]);

  const breakEvenMonth = useMemo(() => {
    if (mrr.total >= totalMonthlyCosts) return 0;
    const idx = forecast.findIndex((f) => f.projected > f.costs);
    return idx >= 0 ? idx : null;
  }, [forecast, mrr, totalMonthlyCosts]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleSaveCosts = async () => {
    setSavingCosts(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/analytics/platform-costs', {
        method: 'PUT',
        headers,
        body: JSON.stringify(costs),
      });
      if (res.ok) {
        toast({ title: 'Cost settings saved' });
      } else {
        const err = await res.text();
        toast({ title: 'Error saving costs', description: err, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error saving costs', description: error.message, variant: 'destructive' });
    } finally {
      setSavingCosts(false);
    }
  };

  const updateTierCount = (planId: string, value: number) => {
    setNewPerTier((prev) => ({ ...prev, [planId]: value }));
  };

  const updateWholesaleTierCount = (tierId: string, value: number) => {
    setNewWholesalePerTier((prev) => ({ ...prev, [tierId]: value }));
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return <CoffeeLoader fullScreen />;
  }

  if (!isPlatformAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: colors.cream }}>
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header
        className="px-6 py-4 border-b"
        style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8" style={{ color: colors.gold }} />
            <div>
              <h1 className="text-xl font-bold" style={{ color: colors.brown }}>
                Platform Analytics
              </h1>
              <p className="text-sm hidden sm:block" style={{ color: colors.brownLight }}>
                {platformAdmin?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setLocation('/')}
              style={{ backgroundColor: colors.gold, color: colors.white }}
            >
              <LayoutDashboard className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Platform nav tabs */}
      <nav className="border-b px-6" style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
        <div className="max-w-7xl mx-auto flex gap-1">
          {[
            { href: '/platform-admin', label: 'Businesses', icon: Settings, active: false },
            { href: '/platform-analytics', label: 'Analytics', icon: BarChart3, active: true },
            { href: '/platform-bug-reports', label: 'Bug Triage', icon: Bug, active: false },
          ].map((tab) => (
            <button
              key={tab.href}
              onClick={() => setLocation(tab.href)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: tab.active ? colors.gold : 'transparent',
                color: tab.active ? colors.gold : colors.brownLight,
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 space-y-8">
        {/* ─── Section 1: KPI Cards ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* MRR */}
          <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: colors.brownLight }}>
                  Monthly Recurring Revenue
                </span>
                <DollarSign className="w-4 h-4" style={{ color: colors.gold }} />
              </div>
              <div className="text-3xl font-bold" style={{ color: colors.brown }}>
                {formatCurrency(mrr.total)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs" style={{ color: colors.brownLight }}>
                  {formatCurrency(mrr.total * 12)} ARR
                </span>
                {mrr.trialCount > 0 && (
                  <Badge variant="outline" style={{ borderColor: '#eab308', color: '#ca8a04', fontSize: 10 }}>
                    {mrr.trialCount} on trial
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Total Active Users */}
          <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: colors.brownLight }}>
                  Active Users
                </span>
                <Users className="w-4 h-4" style={{ color: colors.gold }} />
              </div>
              <div className="text-3xl font-bold" style={{ color: colors.brown }}>
                {overview?.totalActiveUsers || 0}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Building2 className="w-3 h-3" style={{ color: colors.brownLight }} />
                <span className="text-xs" style={{ color: colors.brownLight }}>
                  {overview?.totalActiveTenants || 0} businesses
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Cost Per User */}
          <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: colors.brownLight }}>
                  Cost Per User
                </span>
                <DollarSign className="w-4 h-4" style={{ color: colors.gold }} />
              </div>
              <div className="text-3xl font-bold" style={{ color: colors.brown }}>
                {formatCurrencyDecimal(costPerUser)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs" style={{ color: colors.brownLight }}>
                  {formatCurrency(totalMonthlyCosts)} total costs/mo
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Gross Margin */}
          <Card style={{ backgroundColor: colors.white, borderColor: colors.creamDark }}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: colors.brownLight }}>
                  Gross Margin
                </span>
                <Percent className="w-4 h-4" style={{ color: colors.gold }} />
              </div>
              <div
                className="text-3xl font-bold"
                style={{
                  color: grossMargin >= 50 ? '#16a34a' : grossMargin >= 20 ? '#ca8a04' : '#ef4444',
                }}
              >
                {grossMargin.toFixed(1)}%
              </div>
              <div className="flex items-center gap-2 mt-1">
                {grossMargin >= 50 ? (
                  <TrendingUp className="w-3 h-3" style={{ color: '#16a34a' }} />
                ) : (
                  <TrendingDown className="w-3 h-3" style={{ color: '#ef4444' }} />
                )}
                <span className="text-xs" style={{ color: colors.brownLight }}>
                  {formatCurrency(mrr.total - totalMonthlyCosts)} net/mo
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Section 2: Revenue Breakdown ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Direct vs Wholesale Pie */}
          <Card style={{ backgroundColor: colors.white }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base" style={{ color: colors.brown }}>
                Revenue by Channel
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenueBreakdownData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueBreakdownData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                      >
                        {revenueBreakdownData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: colors.white,
                          borderColor: colors.creamDark,
                          borderRadius: 8,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-sm" style={{ color: colors.brownLight }}>
                  No revenue data yet
                </div>
              )}
              <div className="flex items-center justify-center gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[0] }} />
                  <span className="text-sm" style={{ color: colors.brownLight }}>
                    Direct ({formatCurrency(mrr.direct)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[1] }} />
                  <span className="text-sm" style={{ color: colors.brownLight }}>
                    Wholesale ({formatCurrency(mrr.wholesale)})
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue by Plan Tier */}
          <Card style={{ backgroundColor: colors.white }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base" style={{ color: colors.brown }}>
                Revenue by Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              {planRevenueData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={planRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.creamDark} />
                      <XAxis dataKey="plan" tick={{ fontSize: 11, fill: colors.brownLight }} />
                      <YAxis tick={{ fontSize: 11, fill: colors.brownLight }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                        contentStyle={{ backgroundColor: colors.white, borderColor: colors.creamDark, borderRadius: 8 }}
                      />
                      <Bar dataKey="revenue" fill={colors.gold} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-sm" style={{ color: colors.brownLight }}>
                  No plan revenue data yet
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Section 3: Growth Trend ────────────────────────────────── */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base" style={{ color: colors.brown }}>
              Tenant Growth (Last 12 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview && overview.monthlyGrowth.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.monthlyGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.creamDark} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: colors.brownLight }}
                      tickFormatter={(v) => {
                        const [, m] = v.split('-');
                        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        return months[parseInt(m, 10) - 1] || v;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: colors.brownLight }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: colors.white, borderColor: colors.creamDark, borderRadius: 8 }}
                    />
                    <Legend />
                    <Bar dataKey="direct" name="Direct" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="wholesale" name="Wholesale" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm" style={{ color: colors.brownLight }}>
                No growth data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Section 4: Revenue Forecasting ─────────────────────────── */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader>
            <CardTitle style={{ color: colors.brown }}>Revenue Forecasting</CardTitle>
            <CardDescription style={{ color: colors.brownLight }}>
              Model growth by adjusting new customer acquisition per plan tier
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Direct retail acquisition sliders */}
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: colors.brown }}>
                Direct Retail — New Tenants Per Month
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                {forecastPlans.map((plan) => (
                  <div key={plan.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm" style={{ color: colors.brown }}>
                        {plan.name}{' '}
                        <span style={{ color: colors.brownLight }}>
                          (${Number(plan.monthly_price)}/mo)
                        </span>
                      </Label>
                      <span className="text-sm font-bold tabular-nums" style={{ color: colors.gold }}>
                        {newPerTier[plan.id] || 0}
                      </span>
                    </div>
                    <Slider
                      value={[newPerTier[plan.id] || 0]}
                      onValueChange={([v]) => updateTierCount(plan.id, v)}
                      min={0}
                      max={50}
                      step={1}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Wholesale per-tier acquisition sliders */}
            <div>
              <h3 className="text-sm font-semibold mb-3" style={{ color: colors.brown }}>
                Wholesale — New Seats Per Month by Reseller Tier
              </h3>
              <p className="text-xs mb-3" style={{ color: colors.brownLight }}>
                Based on Professional plan ($99/mo retail). Rates are what we receive per seat after reseller discount.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-4">
                {WHOLESALE_TIERS.map((tier) => (
                  <div key={tier.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm" style={{ color: colors.brown }}>
                        {tier.label}{' '}
                        <span style={{ color: colors.brownLight }}>
                          ({tier.discount * 100}% off — {formatCurrencyDecimal(tier.rate)}/seat)
                        </span>
                      </Label>
                      <span className="text-sm font-bold tabular-nums" style={{ color: colors.gold }}>
                        {newWholesalePerTier[tier.id] || 0}
                      </span>
                    </div>
                    <Slider
                      value={[newWholesalePerTier[tier.id] || 0]}
                      onValueChange={([v]) => updateWholesaleTierCount(tier.id, v)}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Forecast period */}
            <div className="w-full sm:w-48">
              <Label className="text-sm" style={{ color: colors.brown }}>Forecast Period</Label>
              <Select value={String(forecastMonths)} onValueChange={(v) => setForecastMonths(Number(v))}>
                <SelectTrigger style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 months</SelectItem>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months</SelectItem>
                  <SelectItem value="24">24 months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Supabase cost scaling controls */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: colors.cream, border: `1px solid ${colors.creamDark}` }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-4 h-4" style={{ color: colors.gold }} />
                <h3 className="text-sm font-semibold" style={{ color: colors.brown }}>
                  Supabase Cost Scaling
                </h3>
                <span className="text-xs ml-auto" style={{ color: colors.brownLight }}>
                  Current: {formatCurrencyDecimal(currentSupabaseCost)}/mo
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm" style={{ color: colors.brown }}>Supabase Plan</Label>
                  <Select value={supabasePlan} onValueChange={(v) => setSupabasePlan(v as 'pro' | 'team')}>
                    <SelectTrigger style={{ backgroundColor: colors.white, borderColor: colors.gold }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pro">{SUPABASE_PRICING.pro.label}</SelectItem>
                      <SelectItem value="team">{SUPABASE_PRICING.team.label}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm" style={{ color: colors.brown }}>Est. users per tenant</Label>
                    <span className="text-sm font-bold tabular-nums" style={{ color: colors.gold }}>
                      {usersPerTenant}
                    </span>
                  </div>
                  <Slider
                    value={[usersPerTenant]}
                    onValueChange={([v]) => setUsersPerTenant(v)}
                    min={1}
                    max={30}
                    step={1}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm" style={{ color: colors.brown }}>Est. storage per tenant</Label>
                    <span className="text-sm font-bold tabular-nums" style={{ color: colors.gold }}>
                      {storageMbPerTenant} MB
                    </span>
                  </div>
                  <Slider
                    value={[storageMbPerTenant]}
                    onValueChange={([v]) => setStorageMbPerTenant(v)}
                    min={10}
                    max={500}
                    step={10}
                  />
                </div>
              </div>
            </div>

            {/* Forecast Chart */}
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.creamDark} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: colors.brownLight }} />
                  <YAxis
                    tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                    tick={{ fontSize: 11, fill: colors.brownLight }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    contentStyle={{ backgroundColor: colors.white, borderColor: colors.creamDark, borderRadius: 8 }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="projected"
                    name="Projected Revenue"
                    stroke={colors.gold}
                    fill={colors.goldLight}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="currentMrr"
                    name="Current MRR (flat)"
                    stroke={colors.brownLight}
                    strokeDasharray="5 5"
                    strokeWidth={1}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="costs"
                    name="Total Costs"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Break-even + summary badges */}
            <div className="flex items-center gap-3 flex-wrap">
              {breakEvenMonth === 0 && (
                <Badge style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}>
                  Already profitable
                </Badge>
              )}
              {breakEvenMonth !== null && breakEvenMonth > 0 && (
                <Badge style={{ backgroundColor: colors.goldLight, color: colors.gold }}>
                  Break-even in ~{breakEvenMonth} month{breakEvenMonth > 1 ? 's' : ''}
                </Badge>
              )}
              {breakEvenMonth === null && (
                <Badge style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
                  Not profitable within forecast window
                </Badge>
              )}
              {forecast.length > 0 && (
                <span className="text-xs" style={{ color: colors.brownLight }}>
                  End-of-period MRR:{' '}
                  <strong>{formatCurrency(forecast[forecast.length - 1]?.projected || 0)}</strong>
                  {' | '}Costs:{' '}
                  <strong>{formatCurrency(forecast[forecast.length - 1]?.costs || 0)}</strong>
                </span>
              )}
            </div>

            {/* Forecast Summary Table */}
            {forecast.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${colors.creamDark}` }}>
                      {['Month', 'Revenue', 'Supabase', 'Total Costs', 'Profit', 'Margin', 'Tenants', 'Users'].map((h) => (
                        <th
                          key={h}
                          className={`py-2 px-2 font-medium ${h === 'Month' ? 'text-left' : 'text-right'}`}
                          style={{ color: colors.brownLight }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.map((row) => {
                      const margin = row.projected > 0
                        ? ((row.projected - row.costs) / row.projected * 100)
                        : 0;
                      return (
                        <tr key={row.month} style={{ borderBottom: `1px solid ${colors.cream}` }}>
                          <td className="py-1.5 px-2 font-medium" style={{ color: colors.brown }}>
                            {row.month}
                          </td>
                          <td className="py-1.5 px-2 text-right" style={{ color: colors.brown }}>
                            {formatCurrency(row.projected)}
                          </td>
                          <td className="py-1.5 px-2 text-right" style={{ color: colors.brownLight }}>
                            {formatCurrency(row.supabaseCost)}
                          </td>
                          <td className="py-1.5 px-2 text-right" style={{ color: '#ef4444' }}>
                            {formatCurrency(row.costs)}
                          </td>
                          <td
                            className="py-1.5 px-2 text-right font-medium"
                            style={{ color: row.profit >= 0 ? '#16a34a' : '#ef4444' }}
                          >
                            {formatCurrency(row.profit)}
                          </td>
                          <td
                            className="py-1.5 px-2 text-right"
                            style={{ color: margin >= 50 ? '#16a34a' : margin >= 20 ? '#ca8a04' : '#ef4444' }}
                          >
                            {margin.toFixed(0)}%
                          </td>
                          <td className="py-1.5 px-2 text-right" style={{ color: colors.brown }}>
                            {row.tenants}
                          </td>
                          <td className="py-1.5 px-2 text-right" style={{ color: colors.brown }}>
                            {row.users}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Section 5: Cost & Margin Settings ──────────────────────── */}
        <Collapsible open={costsOpen} onOpenChange={setCostsOpen}>
          <Card style={{ backgroundColor: colors.white }}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle style={{ color: colors.brown }}>Fixed Cost Settings</CardTitle>
                  {costsOpen ? (
                    <ChevronUp className="w-5 h-5" style={{ color: colors.brownLight }} />
                  ) : (
                    <ChevronDown className="w-5 h-5" style={{ color: colors.brownLight }} />
                  )}
                </div>
                <CardDescription style={{ color: colors.brownLight }}>
                  Your monthly operating costs (Supabase scaling is modeled above)
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm" style={{ color: colors.brown }}>Hosting ($/mo)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={costs.hosting || ''}
                      onChange={(e) => setCosts((prev) => ({ ...prev, hosting: Number(e.target.value) || 0 }))}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm" style={{ color: colors.brown }}>Support/Labor ($/mo)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={costs.support_labor || ''}
                      onChange={(e) => setCosts((prev) => ({ ...prev, support_labor: Number(e.target.value) || 0 }))}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm" style={{ color: colors.brown }}>Other ($/mo)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={costs.other || ''}
                      onChange={(e) => setCosts((prev) => ({ ...prev, other: Number(e.target.value) || 0 }))}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm" style={{ color: colors.brown }}>Stripe Fee (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={costs.stripe_fee_percent || ''}
                      onChange={(e) => setCosts((prev) => ({ ...prev, stripe_fee_percent: Number(e.target.value) || 0 }))}
                      style={{ backgroundColor: colors.inputBg, borderColor: colors.gold }}
                    />
                  </div>
                </div>

                <div
                  className="flex items-center justify-between pt-4 border-t"
                  style={{ borderColor: colors.creamDark }}
                >
                  <div>
                    <span className="text-sm font-medium" style={{ color: colors.brownLight }}>
                      Total Monthly Costs:{' '}
                    </span>
                    <span className="text-lg font-bold" style={{ color: colors.brown }}>
                      {formatCurrency(totalMonthlyCosts)}
                    </span>
                    <span className="text-xs ml-2" style={{ color: colors.brownLight }}>
                      (Supabase: {formatCurrencyDecimal(currentSupabaseCost)} + Stripe: {formatCurrency(mrr.total * costs.stripe_fee_percent / 100)} + Fixed: {formatCurrency(costs.hosting + costs.support_labor + costs.other)})
                    </span>
                  </div>
                  <Button
                    onClick={handleSaveCosts}
                    disabled={savingCosts}
                    style={{ backgroundColor: colors.gold, color: colors.white }}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingCosts ? 'Saving...' : 'Save Costs'}
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* ─── Section 6: Module Adoption ─────────────────────────────── */}
        <Card style={{ backgroundColor: colors.white }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base" style={{ color: colors.brown }}>
              Module Adoption
            </CardTitle>
            <CardDescription style={{ color: colors.brownLight }}>
              Number of tenants subscribed to each module
            </CardDescription>
          </CardHeader>
          <CardContent>
            {moduleAdoptionData.length > 0 ? (
              <div style={{ height: Math.max(200, moduleAdoptionData.length * 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={moduleAdoptionData} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.creamDark} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: colors.brownLight }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: colors.brownLight }} width={110} />
                    <Tooltip
                      formatter={(value: number, _name: string, props: any) => [
                        `${value} tenants (${props.payload.percent}%)`,
                        'Subscribers',
                      ]}
                      contentStyle={{ backgroundColor: colors.white, borderColor: colors.creamDark, borderRadius: 8 }}
                    />
                    <Bar dataKey="count" fill={colors.gold} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm" style={{ color: colors.brownLight }}>
                No module adoption data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Section 7: Reseller Performance ────────────────────────── */}
        {overview && overview.resellers.length > 0 && (
          <Card style={{ backgroundColor: colors.white }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base" style={{ color: colors.brown }}>
                Reseller Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${colors.creamDark}` }}>
                      <th className="text-left py-3 px-2 font-medium" style={{ color: colors.brownLight }}>Name</th>
                      <th className="text-left py-3 px-2 font-medium" style={{ color: colors.brownLight }}>Tier</th>
                      <th className="text-right py-3 px-2 font-medium" style={{ color: colors.brownLight }}>Seats</th>
                      <th className="text-right py-3 px-2 font-medium" style={{ color: colors.brownLight }}>Rate/Seat</th>
                      <th className="text-right py-3 px-2 font-medium" style={{ color: colors.brownLight }}>Monthly Rev</th>
                      <th className="text-right py-3 px-2 font-medium" style={{ color: colors.brownLight }}>Total Invoiced</th>
                      <th className="text-right py-3 px-2 font-medium" style={{ color: colors.brownLight }}>Total Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.resellers.map((r) => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${colors.cream}` }}>
                        <td className="py-2.5 px-2 font-medium" style={{ color: colors.brown }}>{r.name}</td>
                        <td className="py-2.5 px-2">
                          <Badge
                            variant="outline"
                            style={{ borderColor: colors.gold, color: colors.gold, textTransform: 'capitalize' }}
                          >
                            {r.tier}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-2 text-right" style={{ color: colors.brown }}>
                          {r.seats_used}/{r.seats_total}
                        </td>
                        <td className="py-2.5 px-2 text-right" style={{ color: colors.brown }}>
                          {formatCurrencyDecimal(Number(r.wholesale_rate_per_seat))}
                        </td>
                        <td className="py-2.5 px-2 text-right font-medium" style={{ color: colors.brown }}>
                          {formatCurrency(Number(r.seats_used) * Number(r.wholesale_rate_per_seat))}
                        </td>
                        <td className="py-2.5 px-2 text-right" style={{ color: colors.brown }}>
                          {formatCurrency(Number(r.total_invoiced))}
                        </td>
                        <td className="py-2.5 px-2 text-right" style={{ color: '#16a34a' }}>
                          {formatCurrency(Number(r.total_paid))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
