import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Clock } from 'lucide-react';
import { StoreCard } from '@/components/dashboard/StoreCard';
import { useAllStoreMetrics } from '@/hooks/use-store-metrics';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

const colors = {
  gold: '#C9A227',
  brown: '#4A3728',
  brownLight: '#6B5344',
  cream: '#F5F0E1',
  creamDark: '#E8E0CC',
  white: '#FFFDF7',
};

export default function Dashboard() {
  const { profile, primaryTenant, tenant } = useAuth();
  const { locations, queries } = useAllStoreMetrics();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const parentTenantId = primaryTenant?.id;

  // Trial countdown
  const isTrial = tenant?.subscription_plan === 'free' || !tenant?.subscription_plan;
  const trialEndsAt = tenant?.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
  const trialProgress = trialEndsAt ? Math.max(0, Math.min(100, ((14 - trialDaysLeft) / 14) * 100)) : 0;
  const showTrialBanner = isTrial && trialEndsAt && trialDaysLeft >= 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['store-metrics'] });
      toast({ title: 'Dashboard refreshed' });
    } catch {
      toast({ title: 'Failed to refresh', variant: 'destructive' });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.cream }}>
      <div className="max-w-4xl mx-auto p-6">
        {/* Welcome + refresh */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2
              className="text-2xl font-bold mb-1"
              style={{ color: colors.brown }}
            >
              Welcome, {profile?.full_name?.split(' ')[0] || 'User'}
            </h2>
            <p style={{ color: colors.brownLight }}>
              {locations.length > 1
                ? `Overview of your ${locations.length} locations`
                : 'Your store overview'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ borderColor: colors.creamDark, color: colors.brown }}
            data-testid="button-refresh"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>

        {/* Trial Countdown Banner */}
        {showTrialBanner && (
          <Link href="/billing">
            <div
              className="mb-6 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
              style={{ backgroundColor: colors.white, border: `2px solid ${colors.gold}` }}
            >
              <div className="shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: trialDaysLeft <= 3 ? '#fef2f2' : '#eff6ff' }}>
                  <Clock className="w-6 h-6" style={{ color: trialDaysLeft <= 3 ? '#ef4444' : '#3b82f6' }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold" style={{ color: colors.brown }}>
                    {trialDaysLeft > 0
                      ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left on your free trial`
                      : 'Your free trial has expired'}
                  </p>
                  <span className="text-xs font-medium shrink-0 ml-2" style={{ color: colors.gold }}>
                    Upgrade
                  </span>
                </div>
                <Progress value={trialProgress} className="h-1.5" />
                <p className="text-xs mt-1" style={{ color: colors.brownLight }}>
                  {trialDaysLeft > 0
                    ? `Trial ends ${trialEndsAt!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'Subscribe to keep using all features'}
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* Store Cards */}
        <div className="space-y-6">
          {locations.map((location, index) => {
            const query = queries[index];
            return (
              <StoreCard
                key={location.id}
                location={location}
                metrics={query?.data}
                isLoading={query?.isLoading ?? true}
                isError={query?.isError ?? false}
                isParent={location.id === parentTenantId}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
