import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Users, Building2, AlertTriangle } from 'lucide-react';
import { StoreCard } from '@/components/dashboard/StoreCard';
import { MyDashboardCard } from '@/components/dashboard/MyDashboardCard';
import EmployeeDashboard from '@/components/dashboard/EmployeeDashboard';
import { SetupWizard } from '@/components/dashboard/SetupWizard';
import { useAllStoreMetrics } from '@/hooks/use-store-metrics';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { colors } from '@/lib/colors';

export default function Dashboard() {
  const { hasRole } = useAuth();

  // Employees and leads get the simplified, clock-in-focused dashboard
  if (!hasRole?.('manager')) {
    return <EmployeeDashboard />;
  }

  return <ManagerOwnerDashboard />;
}

function ManagerOwnerDashboard() {
  const { profile, primaryTenant, canAccessModule, hasRole } = useAuth();
  const { locations, queries } = useAllStoreMetrics();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const parentTenantId = primaryTenant?.id;
  const isOwner = hasRole?.('owner');

  // Owner aggregate metrics
  const ownerAggregates = locations.length > 1 ? {
    totalEmployees: queries.reduce((sum, q) => sum + (q?.data?.employeeCount || 0), 0),
    totalOverdue: queries.reduce((sum, q) => sum + (q?.data?.redFlags?.overdueMaintenanceCount || 0) + (q?.data?.redFlags?.overdueTaskCount || 0), 0),
  } : null;

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
              {isOwner && locations.length > 1
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

        {/* Setup wizard for new tenants */}
        <SetupWizard />

        {/* Owner: Multi-location summary */}
        {isOwner && ownerAggregates && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-5 pb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
                  <Building2 className="w-5 h-5" style={{ color: colors.brown }} />
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: colors.brown }}>{locations.length}</div>
                  <div className="text-xs" style={{ color: colors.brownLight }}>Locations</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.cream }}>
                  <Users className="w-5 h-5" style={{ color: colors.brown }} />
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: colors.brown }}>{ownerAggregates.totalEmployees}</div>
                  <div className="text-xs" style={{ color: colors.brownLight }}>Team members</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: ownerAggregates.totalOverdue > 0 ? '#fef2f2' : colors.cream }}>
                  <AlertTriangle className="w-5 h-5" style={{ color: ownerAggregates.totalOverdue > 0 ? '#ef4444' : colors.brownLight }} />
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: ownerAggregates.totalOverdue > 0 ? '#ef4444' : colors.brown }}>
                    {ownerAggregates.totalOverdue}
                  </div>
                  <div className="text-xs" style={{ color: colors.brownLight }}>Overdue items</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Manager/Owner personal schedule (if calendar module enabled) */}
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
