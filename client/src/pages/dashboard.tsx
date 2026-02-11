import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, CheckCircle, Clock, ListTodo, Users, Building2, AlertTriangle } from 'lucide-react';
import { StoreCard } from '@/components/dashboard/StoreCard';
import { MyDashboardCard } from '@/components/dashboard/MyDashboardCard';
import { useAllStoreMetrics } from '@/hooks/use-store-metrics';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-queries';
import { colors } from '@/lib/colors';
import { useLocation } from 'wouter';

interface MyTask {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
}

export default function Dashboard() {
  const { profile, primaryTenant, canAccessModule, hasRole } = useAuth();
  const { locations, queries } = useAllStoreMetrics();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const [, navigate] = useLocation();
  const parentTenantId = primaryTenant?.id;
  const isManager = hasRole?.('manager');
  const isOwner = hasRole?.('owner');

  // Employee tasks
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const loadMyTasks = useCallback(async () => {
    if (!profile?.id || !canAccessModule('admin-tasks')) return;
    const { data } = await supabase
      .from('admin_tasks')
      .select('id, title, priority, status, due_date')
      .eq('assigned_to', profile.id)
      .in('status', ['pending', 'in_progress'])
      .order('due_date', { ascending: true })
      .limit(5);
    setMyTasks(data || []);
  }, [profile?.id, canAccessModule]);

  useEffect(() => { loadMyTasks(); }, [loadMyTasks]);

  // Owner aggregate metrics
  const ownerAggregates = locations.length > 1 ? {
    totalEmployees: queries.reduce((sum, q) => sum + (q?.data?.employeeCount || 0), 0),
    totalActionItems: queries.reduce((sum, q) => sum + (q?.data?.actionItems?.length || 0), 0),
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
      loadMyTasks();
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
                : isManager
                  ? 'Your store overview'
                  : 'Your schedule and tasks'}
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

        {/* Personal Dashboard */}
        {canAccessModule('calendar-workforce') && <MyDashboardCard />}

        {/* Employee: My Tasks section */}
        {!isManager && canAccessModule('admin-tasks') && myTasks.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2" style={{ color: colors.brown }}>
                  <ListTodo className="w-4 h-4" />
                  My Tasks
                </h3>
                <button
                  onClick={() => navigate('/admin-tasks')}
                  className="text-xs font-medium hover:underline"
                  style={{ color: colors.gold }}
                >
                  View all
                </button>
              </div>
              <div className="space-y-2">
                {myTasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                    style={{ backgroundColor: colors.cream }}
                  >
                    {task.status === 'in_progress' ? (
                      <Clock className="w-4 h-4 flex-shrink-0" style={{ color: colors.gold }} />
                    ) : (
                      <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: colors.brownLight }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: colors.brown }}>{task.title}</div>
                      {task.due_date && (
                        <div className="text-xs" style={{ color: new Date(task.due_date) < new Date() ? '#ef4444' : colors.brownLight }}>
                          Due {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: task.priority === 'high' ? '#fef2f2' : task.priority === 'medium' ? '#fefce8' : colors.cream,
                        color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#ca8a04' : colors.brownLight,
                      }}
                    >
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
