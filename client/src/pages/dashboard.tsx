import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { StoreCard } from '@/components/dashboard/StoreCard';
import { MyDashboardCard } from '@/components/dashboard/MyDashboardCard';
import { useAllStoreMetrics } from '@/hooks/use-store-metrics';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';

export default function Dashboard() {
  const { profile, primaryTenant, canAccessModule } = useAuth();
  const { locations, queries } = useAllStoreMetrics();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const parentTenantId = primaryTenant?.id;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['store-metrics'] }),
        queryClient.invalidateQueries({ queryKey: ['store-team'] }),
        queryClient.invalidateQueries({ queryKey: ['store-hours'] }),
        queryClient.invalidateQueries({ queryKey: ['shifts'] }),
        queryClient.invalidateQueries({ queryKey: ['time-off-mine'] }),
        queryClient.invalidateQueries({ queryKey: ['time-clock'] }),
        queryClient.invalidateQueries({ queryKey: ['time-clock-active'] }),
      ]);
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

        {/* Personal Dashboard */}
        {canAccessModule('calendar-workforce') && <MyDashboardCard />}

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
